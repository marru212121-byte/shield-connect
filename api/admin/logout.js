// api/admin/logout.js
// ═══════════════════════════════════════════════════════════════
// 어드민 로그아웃 — admin_session 쿠키 즉시 만료
// ═══════════════════════════════════════════════════════════════
// POST /api/admin/logout
// ═══════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ code: 'method_not_allowed' });
  }

  const cookieParts = [
    'admin_session=',
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ];
  res.setHeader('Set-Cookie', cookieParts.join('; '));

  return res.status(200).json({ ok: true });
}
