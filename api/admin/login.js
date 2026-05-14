// api/admin/login.js
// ═══════════════════════════════════════════════════════════════
// 어드민 로그인 — 비밀번호 검사 + HMAC 쿠키(도장) 발급
// ═══════════════════════════════════════════════════════════════
// POST /api/admin/login
// body: { password: string }
// 성공: admin_session 쿠키 30일 발급
// 실패: 401
// ═══════════════════════════════════════════════════════════════

import crypto from 'crypto';

const COOKIE_NAME = 'admin_session';
const MAX_AGE_DAYS = 30;

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET 환경변수가 없어요');
  return secret;
}

function sign(payload, secret) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ code: 'method_not_allowed' });
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error('[admin/login] ADMIN_PASSWORD 환경변수 없음');
    return res.status(500).json({ code: 'server_error', message: '서버 설정 오류' });
  }

  const { password } = req.body || {};
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ code: 'missing_password', message: '비밀번호를 입력해주세요.' });
  }

  // 타이밍 공격 방지: 길이 다르면 즉시 거절하지 말고 비교
  // (Vercel에서 짧은 비교라 큰 의미는 없지만 관습)
  const a = Buffer.from(password);
  const b = Buffer.from(adminPassword);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!ok) {
    // 살짝 지연 (브루트포스 살짝 늦추기)
    await new Promise(r => setTimeout(r, 300));
    return res.status(401).json({ code: 'wrong_password', message: '비밀번호가 달라요.' });
  }

  // 도장 발급
  try {
    const secret = getSecret();
    const issuedAt = Date.now();
    const expiresAt = issuedAt + MAX_AGE_DAYS * 86400000;
    const token = sign({ role: 'admin', iat: issuedAt, exp: expiresAt }, secret);

    const cookieParts = [
      `${COOKIE_NAME}=${token}`,
      'Path=/',
      `Max-Age=${MAX_AGE_DAYS * 86400}`,
      'HttpOnly',
      'Secure',
      'SameSite=Lax',
    ];
    res.setHeader('Set-Cookie', cookieParts.join('; '));

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[admin/login] error:', err);
    return res.status(500).json({ code: 'server_error', message: err.message });
  }
}
