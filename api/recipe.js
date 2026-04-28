// api/recipe.js
// ═══════════════════════════════════════════════════════════════
// AI 분석 엔드포인트 (member_id 기반 + 크레딧 차감 + 스트리밍 지원)
// ═══════════════════════════════════════════════════════════════
// 호출 주체: analyzer.html, cut-analyzer.html (프론트)
// 처리 흐름:
//   1. 세션 검증 (쿠키에서 member_id 추출) — stage 무관 항상 수행
//   2. stage가 skip 대상이면 크레딧 차감 skip, 아니면 1크레딧 차감
//      skip 대상: 'recipe_only' (Step 2 레시피), 'customer_message' (고객 안내)
//   3. Claude API 호출
//      - body.stream === true 면 SSE 스트리밍 모드 (Anthropic SSE 그대로 클라이언트로 릴레이)
//      - 아니면 기존 non-stream 모드 (JSON 한 번에 반환)
//   4. 결과 반환
// ═══════════════════════════════════════════════════════════════

import { getSessionFromRequest } from '../lib/session.js';
import { getSupabase } from '../lib/supabase.js';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

// 크레딧 차감 skip 대상 stage
const SKIP_CHARGE_STAGES = ['recipe_only', 'customer_message'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ code: 'method_not_allowed' });
  }

  // ─── 1. 세션 검증 ────────────────────────────────────────────
  const session = getSessionFromRequest(req);
  if (!session?.memberId) {
    return res.status(401).json({
      code: 'not_authenticated',
      message: '로그인이 필요합니다.',
    });
  }
  const memberId = session.memberId;

  // ─── 2. 요청 바디 검증 ───────────────────────────────────────
  const body = req.body;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ code: 'invalid_body' });
  }

  const { model, max_tokens, system, messages, stage } = body;
  if (!model || !messages) {
    return res.status(400).json({ code: 'missing_required_fields' });
  }

  const skipCharge = SKIP_CHARGE_STAGES.includes(stage);
  const wantStream = body.stream === true;
  const supabase = getSupabase();

  // ─── 3. 크레딧 차감 (RPC) — skipCharge면 건너뜀 ─────────────
  let analysisRef = null;
  let result = null;

  if (!skipCharge) {
    analysisRef = `analysis_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const { data: consumeResult, error: consumeError } = await supabase.rpc(
      'consume_credit_by_member',
      {
        p_member_id: memberId,
        p_amount: 1,
        p_reference: analysisRef,
      }
    );

    if (consumeError) {
      console.error('[recipe] consume RPC failed:', consumeError);
      return res.status(500).json({ code: 'server_error' });
    }

    result = Array.isArray(consumeResult) ? consumeResult[0] : consumeResult;

    const ok = result?.consumed === true || result?.success === true;

    if (!ok) {
      const reason = result?.reason;
      const remaining = Number(result?.credits_remaining ?? 0);

      if (reason === 'member_not_found') {
        return res.status(401).json({
          code: 'not_authenticated',
          message: '세션이 만료되었습니다. 다시 로그인해주세요.',
        });
      }

      if (reason === 'insufficient_credits' || remaining <= 0) {
        return res.status(402).json({
          code: 'insufficient_credits',
          message: '크레딧이 부족합니다. 충전 후 다시 시도해주세요.',
          credits_remaining: remaining,
        });
      }

      console.error('[recipe] unknown consume reason:', result);
      return res.status(500).json({ code: 'server_error' });
    }

    if (result.is_admin) {
      console.log('[recipe] admin bypass:', memberId);
    }
  } else {
    console.log('[recipe] skipCharge (' + stage + '):', memberId);
  }

  // ─── 4. Claude API 호출 ─────────────────────────────────────
  let anthropicResponse;
  try {
    anthropicResponse = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: max_tokens || 2000,
        system,
        messages,
        ...(wantStream ? { stream: true } : {}),
      }),
    });
  } catch (err) {
    console.error('[recipe] anthropic fetch failed:', err);
    if (!skipCharge) {
      await refundCredit(supabase, memberId, analysisRef, result.is_admin);
    }
    return res.status(502).json({
      code: 'anthropic_error',
      message: skipCharge
        ? 'AI 서버와 연결할 수 없습니다. 잠시 후 다시 시도해주세요.'
        : 'AI 서버와 연결할 수 없습니다. 크레딧은 복구되었습니다.',
    });
  }

  if (!anthropicResponse.ok) {
    const errorText = await anthropicResponse.text();
    console.error('[recipe] anthropic error:', anthropicResponse.status, errorText);
    if (!skipCharge) {
      await refundCredit(supabase, memberId, analysisRef, result.is_admin);
    }
    return res.status(502).json({
      code: 'anthropic_error',
      message: skipCharge
        ? 'AI 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
        : 'AI 분석 중 오류가 발생했습니다. 크레딧은 복구되었습니다.',
    });
  }

  // ─── 5-A. 스트리밍 응답 (SSE 릴레이) ────────────────────────
  if (wantStream) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // anthropicResponse.body 는 ReadableStream (Node 18+ / Vercel)
    try {
      const reader = anthropicResponse.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
    } catch (err) {
      console.error('[recipe] stream relay failed:', err);
      try {
        res.write(`event: error\ndata: ${JSON.stringify({ message: 'stream interrupted' })}\n\n`);
      } catch (_) {}
    }
    res.end();
    return;
  }

  // ─── 5-B. 일반(non-stream) 응답 ────────────────────────────
  const aiData = await anthropicResponse.json();
  return res.status(200).json({
    content: aiData.content,
    credits_remaining: skipCharge ? undefined : result.credits_remaining,
    is_admin: skipCharge ? undefined : result.is_admin,
  });
}

// ============================================================
// 크레딧 환불 (Anthropic 실패 시)
// ============================================================
async function refundCredit(supabase, memberId, reference, isAdmin) {
  if (isAdmin) return;

  try {
    const { data: member } = await supabase
      .from('cafe24_member_credits')
      .select('credits_remaining, total_used')
      .eq('member_id', memberId)
      .single();

    if (member) {
      await supabase
        .from('cafe24_member_credits')
        .update({
          credits_remaining: (member.credits_remaining ?? 0) + 1,
          total_used: Math.max(0, (member.total_used ?? 0) - 1),
          updated_at: new Date().toISOString(),
        })
        .eq('member_id', memberId);

      await supabase.from('credit_ledger').insert({
        member_id: memberId,
        type: 'refund',
        amount: 1,
        balance_after: (member.credits_remaining ?? 0) + 1,
        reference,
        note: 'AI 호출 실패 자동 환불',
      });
    }
  } catch (err) {
    console.error('[recipe] refund failed:', err);
  }
}
