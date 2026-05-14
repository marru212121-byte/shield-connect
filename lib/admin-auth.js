// lib/admin-auth.js
// ═══════════════════════════════════════════════════════════════
// 어드민 권한 체크 헬퍼 (v2 — 진짜 비번 보호)
// ═══════════════════════════════════════════════════════════════
// admin_session 쿠키 HMAC 검증 + 만료 체크
// v1 (항상 통과)에서 교체됨. 2026-05-14
// ═══════════════════════════════════════════════════════════════

import crypto from 'crypto';

const COOKIE_NAME = 'admin_session';

function getSecret() {
  return process.env.SESSION_SECRET || '';
}

function verify(token, secret) {
  if (!token || !secret) return null;
  const dotIdx = token.indexOf('.');
  if (dotIdx < 0) return null;

  const data = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);

  const expectedSig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!payload || payload.role !== 'admin') return null;
    if (typeof payload.exp !== 'number' || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * 어드민 권한 체크
 * @param {object} req
 * @returns {{ok:boolean, reason?:string}}
 */
export function checkAdmin(req) {
  const cookie = req.headers?.cookie || '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!match) return { ok: false, reason: 'no_session' };

  const secret = getSecret();
  if (!secret) return { ok: false, reason: 'no_secret' };

  const payload = verify(match[1], secret);
  if (!payload) return { ok: false, reason: 'invalid_session' };

  return { ok: true, payload };
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
