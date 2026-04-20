// api/recipe.js
// v23 업데이트: 세션 기반 인증 + 크레딧 체크·차감 추가
//               (기존 재시도·로깅 로직은 그대로 유지)

import { getSessionUserId } from '../lib/session.js';
import { supabase } from '../lib/supabase.js';

// ★ Vercel Pro 활용: 60초 타임아웃 명시
export const config = {
  maxDuration: 60
};

// Anthropic 호출 + 재시도 로직 (429/5xx 시 자동 대기 후 재시도)
async function callAnthropicWithRetry(apiKey, payload, maxRetries = 3) {
  let lastError = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(payload)
      });

      // 성공 (2xx) → 바로 반환
      if (response.ok) {
        const data = await response.json();
        return { ok: true, data, status: response.status };
      }

      // 429 (Rate Limit) → retry-after 헤더 확인 후 대기
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        const waitMs = retryAfter
          ? parseInt(retryAfter) * 1000
          : Math.min(1000 * Math.pow(2, attempt), 10000); // 지수 백오프 (최대 10초)

        console.log(JSON.stringify({
          tag: 'claude_rate_limit',
          attempt: attempt + 1,
          wait_ms: waitMs,
          retry_after_header: retryAfter
        }));

        // 마지막 시도면 재시도 안 함
        if (attempt === maxRetries - 1) {
          const errData = await response.json().catch(() => ({}));
          return { ok: false, data: errData, status: 429 };
        }

        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }

      // 5xx (서버 오류) → 짧은 대기 후 재시도
      if (response.status >= 500) {
        const waitMs = 1000 * Math.pow(2, attempt); // 1초, 2초, 4초

        console.log(JSON.stringify({
          tag: 'claude_server_error',
          attempt: attempt + 1,
          status: response.status,
          wait_ms: waitMs
        }));

        if (attempt === maxRetries - 1) {
          const errData = await response.json().catch(() => ({}));
          return { ok: false, data: errData, status: response.status };
        }

        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }

      // 4xx (클라이언트 오류) → 재시도 무의미, 즉시 반환
      const errData = await response.json().catch(() => ({}));
      return { ok: false, data: errData, status: response.status };

    } catch (err) {
      // 네트워크 오류 → 짧은 대기 후 재시도
      lastError = err;
      console.log(JSON.stringify({
        tag: 'claude_fetch_retry',
        attempt: attempt + 1,
        error: err.message
      }));

      if (attempt === maxRetries - 1) break;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }

  // 모든 재시도 실패
  throw lastError || new Error('모든 재시도 실패');
}

export default async function handler(req, res) {
  /* CORS */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  /* body 파싱 */
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) {
      return res.status(400).json({ error: 'body 파싱 실패' });
    }
  }
  const { messages, system, model, max_tokens } = body || {};
  if (!messages) return res.status(400).json({ error: 'messages 없음' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API 키 미설정' });

  // ────────────────────────────────────────────────
  //  v23 신규: 세션 + 잔액 사전 체크 (호출 전 fail-fast)
  // ────────────────────────────────────────────────
  const userId = getSessionUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'not_authenticated', message: '카카오로 로그인해주세요.' });
  }

  const { data: bal, error: balErr } = await supabase
    .from('user_balance')
    .select('credits_remaining')
    .eq('user_id', userId)
    .maybeSingle();

  if (balErr) {
    console.error('[recipe] 잔액 조회 실패:', balErr);
    return res.status(500).json({ error: 'balance_check_failed' });
  }
  if (!bal || (bal.credits_remaining ?? 0) <= 0) {
    return res.status(402).json({
      error: 'insufficient_credits',
      message: '잔여 건수가 없습니다. 충전권을 구매해 주세요.',
      remaining: 0
    });
  }
  // ────────────────────────────────────────────────

  // 호출 단계 식별자 (step1/step2/recipe 등, 프론트가 metadata로 전달 가능)
  const step = body?.metadata?.step || 'recipe';

  try {
    const result = await callAnthropicWithRetry(apiKey, {
      model: model || 'claude-sonnet-4-6',
      max_tokens: max_tokens || 2048,
      system: system || '',
      messages: messages
    });

    /* 캐시 사용량 로그 */
    if (result.data?.usage) {
      const u = result.data.usage;
      console.log(JSON.stringify({
        tag: 'claude_usage',
        model: model || 'claude-sonnet-4-6',
        input_tokens: u.input_tokens || 0,
        cache_creation_input_tokens: u.cache_creation_input_tokens || 0,
        cache_read_input_tokens: u.cache_read_input_tokens || 0,
        output_tokens: u.output_tokens || 0,
        cache_hit: (u.cache_read_input_tokens || 0) > 0
      }));
    }

    /* 성공 */
    if (result.ok && result.data.content) {
      // ────────────────────────────────────────────────
      //  v23 신규: 성공 후 RPC로 크레딧 차감 (원자적)
      //  차감 실패하더라도 사용자에겐 결과는 반환
      //  (Anthropic 호출은 이미 비용 발생)
      // ────────────────────────────────────────────────
      let remaining = null;
      const { data: consumeResult, error: consumeErr } = await supabase.rpc('consume_credit', {
        p_user_id: userId,
        p_step: step
      });
      const consumed = Array.isArray(consumeResult) ? consumeResult[0] : consumeResult;

      if (consumeErr) {
        console.error('[recipe] consume_credit RPC 실패:', consumeErr);
      } else if (consumed?.success) {
        remaining = consumed.remaining;
      } else {
        console.error('[recipe] consume_credit 실패:', consumed);
      }

      return res.status(200).json({
        ...result.data,
        _balance: remaining
      });
    }

    /* 실패 → 상태 코드 보존해서 내려줌 */
    console.error(JSON.stringify({
      tag: 'claude_error',
      status: result.status,
      error: result.data?.error || result.data
    }));

    const errMsg = result.data?.error?.message || JSON.stringify(result.data);

    // 429는 사용자에게 그대로 전달 (재시도 안내 가능)
    if (result.status === 429) {
      return res.status(429).json({
        error: '지금 많은 분들이 이용 중이에요. 잠시 후 다시 시도해주세요.',
        retry_after: 5
      });
    }

    return res.status(result.status || 500).json({ error: errMsg });

  } catch (err) {
    console.error(JSON.stringify({
      tag: 'claude_fetch_error',
      message: err.message
    }));
    return res.status(500).json({ error: err.message });
  }
}
