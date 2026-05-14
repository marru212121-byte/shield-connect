// lib/admin-auth.js
// ═══════════════════════════════════════════════════════════════
// 어드민 권한 체크 헬퍼
// ═══════════════════════════════════════════════════════════════
// 현재: 임시로 모든 요청 통과 (비밀번호 시스템은 다음 채팅에서 추가)
// TODO: 비밀번호 검증 후 발급되는 admin 쿠키 검증으로 교체
// ═══════════════════════════════════════════════════════════════

/**
 * 어드민 권한 체크
 * @param {object} req
 * @returns {{ok:boolean, reason?:string}}
 */
export function checkAdmin(req) {
  // TODO(다음 채팅): admin 쿠키 검증으로 교체
  // const cookie = req.headers.cookie || '';
  // const match = cookie.match(/admin_session=([^;]+)/);
  // if (!match) return { ok: false, reason: 'no_admin_session' };
  // ... HMAC 검증 ...
  return { ok: true };
}

/**
 * 어드민 미들웨어 (API handler 첫 줄에서 호출)
 * @returns {boolean} true면 통과, false면 이미 응답 전송됨
 */
export function requireAdmin(req, res) {
  const check = checkAdmin(req);
  if (!check.ok) {
    res.status(401).json({ code: 'admin_required', message: '관리자 권한이 필요합니다.' });
    return false;
  }
  return true;
}
