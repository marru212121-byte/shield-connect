// api/auth/logout.js
// POST /api/auth/logout  또는  GET /api/auth/logout
// 세션 쿠키 삭제 후 홈으로 리다이렉트

import { clearSessionCookie } from '../../lib/session.js';

export default function handler(req, res) {
  clearSessionCookie(res);
  res.writeHead(302, { Location: '/' });
  res.end();
}
