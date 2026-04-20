// lib/session.js
// JWT 기반 세션 관리 (httpOnly 쿠키)
// SESSION_SECRET 환경변수 필요 (랜덤 32자+ 문자열)

import jwt from 'jsonwebtoken';
import { serialize, parse } from 'cookie';

const COOKIE_NAME = 'shield_session';
const MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30일

function getSecret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET 환경변수 미설정');
  return s;
}

/** 세션 토큰 발급 (로그인 성공 시 호출) */
export function createSessionToken(userId) {
  return jwt.sign({ uid: userId }, getSecret(), { expiresIn: MAX_AGE_SEC });
}

/** 토큰 검증. 유효하면 payload, 아니면 null */
export function verifySession(token) {
  try {
    return jwt.verify(token, getSecret());
  } catch {
    return null;
  }
}

/** Set-Cookie 헤더로 세션 쿠키 발행 */
export function setSessionCookie(res, token) {
  const existing = res.getHeader('Set-Cookie') || [];
  const list = Array.isArray(existing) ? existing : [existing];
  list.push(serialize(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SEC
  }));
  res.setHeader('Set-Cookie', list);
}

/** 세션 쿠키 삭제 (로그아웃) */
export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', serialize(COOKIE_NAME, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  }));
}

/** 요청에서 로그인한 user.id 추출. 없으면 null */
export function getSessionUserId(req) {
  const cookieHeader = req.headers?.cookie || '';
  const cookies = parse(cookieHeader);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  const payload = verifySession(token);
  return payload?.uid || null;
}

/** 임시 쿠키 (CSRF state) 세팅 */
export function setTempCookie(res, name, value, maxAgeSec = 600) {
  const existing = res.getHeader('Set-Cookie') || [];
  const list = Array.isArray(existing) ? existing : [existing];
  list.push(serialize(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSec
  }));
  res.setHeader('Set-Cookie', list);
}

/** 쿠키에서 임시값 읽기 */
export function getTempCookie(req, name) {
  const cookies = parse(req.headers?.cookie || '');
  return cookies[name] || null;
}

/** 임시 쿠키 삭제 */
export function clearTempCookie(res, name) {
  const existing = res.getHeader('Set-Cookie') || [];
  const list = Array.isArray(existing) ? existing : [existing];
  list.push(serialize(name, '', {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0
  }));
  res.setHeader('Set-Cookie', list);
}
