// lib/session.js
// 카페24 user_identifier 기반 세션 쿠키 관리
// v24 2차: SameSite=None (카페24 크로스 사이트 리다이렉트 허용)

import crypto from 'node:crypto';

const SECRET = process.env.SESSION_SECRET;
const COOKIE_NAME = 'sc_session';
const MAX_AGE_SEC = 30 * 24 * 60 * 60;

if (!SECRET) {
  throw new Error('SESSION_SECRET env is required');
}

function sign(payload) {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
}

function makeToken(memberId) {
  const expiresAt = Math.floor(Date.now() / 1000) + MAX_AGE_SEC;
  const payload = `${memberId}.${expiresAt}`;
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [memberId, expiresAtStr, signature] = parts;
  const payload = `${memberId}.${expiresAtStr}`;
  const expectedSig = sign(payload);
  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length) return null;
    if (!crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  const expiresAt = parseInt(expiresAtStr, 10);
  if (!Number.isFinite(expiresAt) || Date.now() / 1000 > expiresAt) return null;
  if (!memberId) return null;
  return { memberId, expiresAt };
}

export function getSessionFromRequest(req) {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  const token = decodeURIComponent(match[1]);
  return verifyToken(token);
}

export function setSessionCookie(res, memberId) {
  const token = makeToken(memberId);
  const cookieValue = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${MAX_AGE_SEC}`,
    'HttpOnly',
    'Secure',
    'SameSite=None',
  ].join('; ');
  res.setHeader('Set-Cookie', cookieValue);
}

export function clearSessionCookie(res) {
  const cookieValue = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'Secure',
    'SameSite=None',
  ].join('; ');
  res.setHeader('Set-Cookie', cookieValue);
}
