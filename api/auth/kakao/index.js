// api/auth/kakao/index.js
// GET /api/auth/kakao
// 카카오 로그인 시작 — 카카오 인증 페이지로 리다이렉트

import crypto from 'crypto';
import { buildAuthUrl } from '../../../lib/kakao.js';
import { setTempCookie } from '../../../lib/session.js';

export default function handler(req, res) {
  // CSRF 방지용 state 발급
  const state = crypto.randomBytes(16).toString('hex');
  setTempCookie(res, 'kakao_oauth_state', state, 600); // 10분
  const url = buildAuthUrl(state);
  res.writeHead(302, { Location: url });
  res.end();
}
