// api/auth/logout.js
// ═══════════════════════════════════════════════════════════════
// 로그아웃 — 세션 쿠키 제거
// ═══════════════════════════════════════════════════════════════
// 호출 주체: 설정 페이지 [로그아웃] 버튼
// 참고:
//   - 앱 쿠키만 제거함 (카페24 자사몰 로그인은 유지됨)
//   - 사용자가 카페24 자사몰에서도 로그아웃하려면 자사몰에서 직접 해야 함
//   - 보통 앱만 로그아웃하면 충분함 (다시 로그인해도 카카오 1초)
// ═══════════════════════════════════════════════════════════════

import { clearSessionCookie } from '../../lib/session.js';

export default function handler(req, res) {
  // POST 만 허용 (GET 으로 외부 링크 클릭만으로 로그아웃되는 것 방지)
  if (req.method !== 'POST') {
    return res.status(405).json({ code: 'method_not_allowed' });
  }

  clearSessionCookie(res);
  return res.status(200).json({ ok: true });
}
