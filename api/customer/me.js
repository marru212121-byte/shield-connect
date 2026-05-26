// api/customer/me.js
// ═══════════════════════════════════════════════════════════════
// 현재 로그인 회원 정보 조회
// ═══════════════════════════════════════════════════════════════
// 호출 주체: 프론트 (홈 화면 잔액 뱃지, 애널라이저 상단 등)
// 응답:
//   200 {
//     member_id: "abc123",
//     credits_remaining: 15,      // ← 만료된 경우 0으로 정리된 값
//     total_charged: 25,
//     total_used: 10,
//     role: "user" | "admin",
//     signup_bonus_given: true,
//     expired_recent: null | { amount: 30, at: "2026-..." }  // 최근 24h 내 만료 기록 (토스트용)
//   }
//   401 { code: 'not_authenticated' }  → 로그인 필요
//   404 { code: 'member_not_found' }   → 세션은 있는데 DB에 없음 (비정상)
// ═══════════════════════════════════════════════════════════════

import { getSessionFromRequest } from '../../lib/session.js';
import { getSupabase } from '../../lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ code: 'method_not_allowed' });
  }

  // 캐싱 방지 (잔액은 항상 최신)
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  const session = getSessionFromRequest(req);
  if (!session?.memberId) {
    return res.status(401).json({ code: 'not_authenticated' });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('cafe24_member_credits')
    .select('member_id, credits_remaining, total_charged, total_used, role, signup_bonus_given, credits_expire_at')
    .eq('member_id', session.memberId)
    .maybeSingle();

  if (error) {
    console.error('[customer/me] db error:', error);
    return res.status(500).json({ code: 'server_error' });
  }

  if (!data) {
    // 세션은 있는데 DB에 member 레코드가 없는 경우
    // (드문 케이스: 관리자가 수동 삭제했거나, 콜백에서 RPC 실패한 경우)
    return res.status(404).json({
      code: 'member_not_found',
      message: '회원 정보를 찾을 수 없습니다. 다시 로그인해주세요.',
    });
  }

  // ─── 만료 정리 (앱 진입 순간) ──────────────────────────────
  // 30일 지난 크레딧이면 DB에서 0으로 정리하고, 뱃지에도 0으로 내려줌.
  // 조건은 expire_credits_if_due 함수와 동일 (admin 제외).
  let creditsRemaining = data.credits_remaining;
  const expMs = data.credits_expire_at ? new Date(data.credits_expire_at).getTime() : null;
  if (data.role !== 'admin' && data.credits_remaining > 0 && expMs !== null && expMs < Date.now()) {
    try {
      await supabase.rpc('expire_credits_if_due', { p_member_id: session.memberId });
    } catch (e) {
      // 여기서 실패해도 다음 크레딧 사용 시 consume 함수가 다시 정리하므로 안전
      console.error('[customer/me] expire rpc error:', e);
    }
    creditsRemaining = 0;
  }

  // ─── 최근 만료 기록 조회 (프론트 토스트용) ──────────────────
  // 잔액이 0일 때만 확인 (성능: 잔액 있는 회원은 만료 대상이 아님)
  // 최근 24시간 내 'expire' 원장 기록이 있으면 = 최근에 만료가 일어남 → 안내 띄움
  let expiredRecent = null;
  if (creditsRemaining === 0 && data.role !== 'admin') {
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: exp } = await supabase
        .from('credit_ledger')
        .select('amount, created_at')
        .eq('member_id', session.memberId)
        .eq('type', 'expire')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (exp) {
        expiredRecent = { amount: Math.abs(exp.amount || 0), at: exp.created_at };
      }
    } catch (e) {
      // 만료 안내는 부가 기능이므로 실패해도 무시
    }
  }

  return res.status(200).json({
    member_id: data.member_id,
    credits_remaining: creditsRemaining,
    total_charged: data.total_charged,
    total_used: data.total_used,
    role: data.role,
    signup_bonus_given: data.signup_bonus_given,
    expired_recent: expiredRecent,
  });
}
