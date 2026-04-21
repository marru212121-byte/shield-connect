// api/customer/me.js
// ═══════════════════════════════════════════════════════════════
// 현재 로그인 회원 정보 조회
// ═══════════════════════════════════════════════════════════════
// 호출 주체: 프론트 (홈 화면 잔액 뱃지, 애널라이저 상단 등)
// 응답:
//   200 {
//     member_id: "abc123",
//     credits_remaining: 15,
//     total_charged: 25,
//     total_used: 10,
//     role: "user" | "admin",
//     signup_bonus_given: true
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
    .select('member_id, credits_remaining, total_charged, total_used, role, signup_bonus_given')
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

  return res.status(200).json({
    member_id: data.member_id,
    credits_remaining: data.credits_remaining,
    total_charged: data.total_charged,
    total_used: data.total_used,
    role: data.role,
    signup_bonus_given: data.signup_bonus_given,
  });
}
