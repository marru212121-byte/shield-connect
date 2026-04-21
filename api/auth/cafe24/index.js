// api/auth/cafe24/index.js
// 카페24 Customer 로그인 시작
// v24 2차: SameSite=None (카페24 크로스 사이트 리다이렉트 허용)

import crypto from 'node:crypto';
import { buildCustomerAuthorizeUrl } from '../../../lib/cafe24.js';

const STATE_COOKIE = 'sc_oauth_state';
const STATE_MAX_AGE = 10 * 60;

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  try {
    const state = crypto.randomBytes(32).toString('base64url');

    const returnTo = typeof req.query.return_to === 'string' ? req.query.return_to : '/';
    const safeReturnTo = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';

    const payload = `${state}.${Buffer.from(safeReturnTo).toString('base64url')}`;
    const signature = crypto
      .createHmac('sha256', process.env.SESSION_SECRET)
      .update(payload)
      .digest('base64url');
    const stateCookieValue = `${payload}.${signature}`;

    res.setHeader('Set-Cookie', [
      `${STATE_COOKIE}=${encodeURIComponent(stateCookieValue)}`,
      'Path=/',
      `Max-Age=${STATE_MAX_AGE}`,
      'HttpOnly',
      'Secure',
      'SameSite=None',
    ].join('; '));

    const authorizeUrl = buildCustomerAuthorizeUrl(state);
    res.writeHead(302, { Location: authorizeUrl });
    res.end();
  } catch (err) {
    console.error('[auth/cafe24] start error:', err);
    res.status(500).json({ error: 'auth_start_failed' });
  }
}
