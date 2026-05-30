// api/track-install.js
// ═══════════════════════════════════════════════════════════════
// 홈 화면(standalone) 접속 1건 기록 — "설치 회원" 파악용
// ═══════════════════════════════════════════════════════════════
// POST /api/track-install
// body: { standalone: true }   ← 프론트는 standalone일 때만 호출
//   - 회원 식별은 쿠키 세션에서 member_id를 읽음 (프론트는 ID 안 보냄)
//   - 그 회원의 is_installed / last_standalone_at 두 컬럼만 갱신
//   - ★ 잔액·결제 등 다른 컬럼은 절대 건드리지 않음
// 응답: 항상 200 (부가기능 — 추적 실패가 앱 사용을 막으면 안 됨)
// ═══════════════════════════════════════════════════════════════

import { getSessionFromRequest } from '../lib/session.js';
import { getSupabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  // 부가기능 — 어떤 경우에도 앱을 막지 않도록 항상 200으로 끝냄
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(200).json({ ok: false, reason: 'method' });
  }

  try {
    // 로그인 회원만 기록 (세션에서 member_id 읽음 — 비회원/세션없음은 조용히 무시)
    const session = getSessionFromRequest(req);
    if (!session?.memberId) {
      return res.status(200).json({ ok: false, reason: 'no_session' });
    }
    const memberId = session.memberId;

    const supabase = getSupabase();

    // ★ 두 컬럼만 UPDATE. credits_remaining 등 결제 관련은 손대지 않음.
    await supabase
      .from('cafe24_member_credits')
      .update({
        is_installed: true,
        last_standalone_at: new Date().toISOString(),
      })
      .eq('member_id', memberId);

    return res.status(200).json({ ok: true });
  } catch (err) {
    // 로깅 실패가 본 흐름을 깨면 안 됨 — 절대 에러로 응답하지 않음
    console.error('[track-install] error:', err?.message || err);
    return res.status(200).json({ ok: false, reason: 'server' });
  }
}
