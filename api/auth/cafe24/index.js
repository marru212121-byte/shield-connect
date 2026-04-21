// api/auth/cafe24/index.js
// 카페24 Customer 로그인 시작
// 사용자 플로우: 앱에서 [카페24로 시작하기] 클릭
//   → GET /api/auth/cafe24
//   → state 쿠키 심고 카페24 로그인 URL로 리다이렉트
//   → 카페24 로그인 → /api/auth/cafe24/callback 으로 돌아옴

import crypto from 'node:crypto';
import { buildCustomerAuthorizeUrl } from '../../../lib/cafe24.js';

const STATE_COOKIE = 'sc_oauth_state';
const STATE_MAX_AGE = 10 * 60;  // 10분

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  try {
    // CSRF 방지용 state 토큰 생성 (32바이트 랜덤)
    const state = crypto.randomBytes(32).toString('base64url');

    // 로그인 성공 후 복귀할 앱 내부 경로 (쿼리스트링으로 받음, 없으면 홈)
    const returnTo = typeof req.query.return_to === 'string' ? req.query.return_to : '/';
    const safeReturnTo = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';

    // state + returnTo를 같이 서명해서 쿠키에 저장
    const payload = `${state}.${Buffer.from(safeReturnTo).toString('base64url')}`;
    const signature = crypto
      .createHmac('sha256', process.env.SESSION_SECRET)
      .update(payload)
      .digest('base64url');
    const stateCookieValue = `${payload}.${signature}`;

    // state 쿠키 심기 (단명 쿠키, 콜백에서 검증)
    // SameSite=None: 카페24 → 우리 앱 크로스 사이트 리다이렉트에서도 쿠키 실림
    res.setHeader('Set-Cookie', [
      `${STATE_COOKIE}=${encodeURIComponent(stateCookieValue)}`,
      'Path=/',
      `Max-Age=${STATE_MAX_AGE}`,
      'HttpOnly',
      'Secure',
      'SameSite=None',
    ].join('; '));

    // 카페24 로그인 URL로 리다이렉트
    const authorizeUrl = buildCustomerAuthorizeUrl(state);
    res.writeHead(302, { Location: authorizeUrl });
    res.end();
  } catch (err) {
    console.error('[auth/cafe24] start error:', err);
    res.status(500).json({ error: 'auth_start_failed' });
  }
}
