// api/recipe.js
// ═══════════════════════════════════════════════════════════════
// AI 분석 엔드포인트 (member_id 기반 + 크레딧 차감)
// ═══════════════════════════════════════════════════════════════
// 호출 주체: analyzer-7.html, cut-analyzer.html (프론트)
// 처리 흐름:
//   1. 세션 검증 (쿠키에서 member_id 추출)
//   2. 크레딧 차감 시도 (RPC) → admin은 무제한 통과
//   3. Claude API 호출
//   4. 결과 반환
//
// ⚠️ 에러 응답 규칙 (프론트에서 이 code로 분기):
//   401 { code: 'not_authenticated' }      → 로그인 필요
//   402 { code: 'insufficient_credits' }   → 크레딧 부족, 충전 유도
//   500 { code: 'server_error' }           → 내부 에러
//   502 { code: 'anthropic_error' }        → Claude API 오류
//   200 { content: [...] }                 → 정상 응답
// ═══════════════════════════════════════════════════════════════

import { getSessionFromRequest } from '../lib/session.js';
import { getSupabase } from '../lib/supabase.js';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

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

  // analyzer의 system/user 프롬프트 구조 그대로 유지
  const { model, max_tokens, system, messages } = body;
  if (!model || !messages) {
    return res.status(400).json({ code: 'missing_required_fields' });
  }

  const supabase = getSupabase();

  // ─── 3. 크레딧 차감 (RPC) ───────────────────────────────────
  const analysisRef = `analysis_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

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

  const result = Array.isArray(consumeResult) ? consumeResult[0] : consumeResult;

  // ─── 3-1. RPC 응답 해석 (스키마 호환 모드) ──────────────────
  // 신 스키마: { member_id, consumed: true/false, credits_used, credits_remaining }
  // 구 스키마: { success: true/false, reason, credits_remaining, is_admin }
  // 두 스키마 모두 대응
  const ok = result?.consumed === true || result?.success === true;

  if (!ok) {
    // 실패 사유 분기
    const reason = result?.reason;
    const remaining = Number(result?.credits_remaining ?? 0);

    if (reason === 'member_not_found') {
      // 이론상 세션 있는데 DB에 member 없음 = 비정상 상태
      return res.status(401).json({
        code: 'not_authenticated',
        message: '세션이 만료되었습니다. 다시 로그인해주세요.',
      });
    }

    // 크레딧 부족: reason 명시 or 잔액 <= 0
    if (reason === 'insufficient_credits' || remaining <= 0) {
      return res.status(402).json({
        code: 'insufficient_credits',
        message: '크레딧이 부족합니다. 충전 후 다시 시도해주세요.',
        credits_remaining: remaining,
      });
    }

    // 그 외 알 수 없는 실패
    console.error('[recipe] unknown consume reason:', result);
    return res.status(500).json({ code: 'server_error' });
  }

  // admin 여부 로깅 (차감은 안 된 경우)
  if (result.is_admin) {
    console.log('[recipe] admin bypass:', memberId);
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
      }),
    });
  } catch (err) {
    console.error('[recipe] anthropic fetch failed:', err);
    // ⚠️ 네트워크 오류 시: 크레딧은 이미 차감됨 → 환불 처리
    await refundCredit(supabase, memberId, analysisRef, result.is_admin);
    return res.status(502).json({
      code: 'anthropic_error',
      message: 'AI 서버와 연결할 수 없습니다. 크레딧은 복구되었습니다.',
    });
  }

  if (!anthropicResponse.ok) {
    const errorText = await anthropicResponse.text();
    console.error('[recipe] anthropic error:', anthropicResponse.status, errorText);
    // Anthropic 응답 오류 시 크레딧 환불
    await refundCredit(supabase, memberId, analysisRef, result.is_admin);
    return res.status(502).json({
      code: 'anthropic_error',
      message: 'AI 분석 중 오류가 발생했습니다. 크레딧은 복구되었습니다.',
    });
  }

  const aiData = await anthropicResponse.json();

  // ─── 5. 성공 응답 ────────────────────────────────────────────
  return res.status(200).json({
    content: aiData.content,
    credits_remaining: result.credits_remaining,
    is_admin: result.is_admin,
  });
}

// ============================================================
// 크레딧 환불 (Anthropic 실패 시)
// ============================================================
async function refundCredit(supabase, memberId, reference, isAdmin) {
  // admin은 애초에 차감 안 됐으므로 환불 불필요
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
    // 환불 실패는 로그만 남기고 무시 (관리자가 수동 처리)
  }
}
