// lib/session.js
// 카페24 member_id 기반 세션 쿠키 관리
// v24: JWT 대신 간단한 서명 쿠키 (서명 + 만료시간)

import crypto from 'node:crypto';

const SECRET = process.env.SESSION_SECRET;
const COOKIE_NAME = 'sc_session';
const MAX_AGE_SEC = 30 * 24 * 60 * 60;  // 30일

if (!SECRET) {
  throw new Error('SESSION_SECRET env is required');
}

// ============================================================
// 서명/검증
// ============================================================

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
  // 타이밍 공격 방지
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

// ============================================================
// Vercel 요청/응답 쿠키 헬퍼
// ============================================================

/**
 * 요청 헤더에서 세션 쿠키 파싱 → member_id 추출
 */
export function getSessionFromRequest(req) {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  const token = decodeURIComponent(match[1]);
  return verifyToken(token);
}

/**
 * 응답에 세션 쿠키 심기
 * - httpOnly: JS에서 접근 불가 (보안)
 * - secure: https에서만
 * - sameSite: lax (OAuth 리다이렉트 허용)
 * - path: / (전체 경로)
 */
export function setSessionCookie(res, memberId) {
  const token = makeToken(memberId);
  const cookieValue = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${MAX_AGE_SEC}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ].join('; ');
  res.setHeader('Set-Cookie', cookieValue);
}

/**
 * 세션 쿠키 제거 (로그아웃)
 */
export function clearSessionCookie(res) {
  const cookieValue = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ].join('; ');
  res.setHeader('Set-Cookie', cookieValue);
}
