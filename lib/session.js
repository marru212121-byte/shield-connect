// lib/session.js
// 카페24 user_identifier 기반 세션 쿠키 관리
// v24 3차: SameSite=None + Admin OAuth용 temp cookie 추가

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

// ============================================================
// Temp Cookie (OAuth state 임시 저장용 - Admin OAuth 앱 설치)
// ============================================================

const TEMP_MAX_AGE_SEC = 10 * 60; // 10분

function makeTempToken(value) {
  const expiresAt = Math.floor(Date.now() / 1000) + TEMP_MAX_AGE_SEC;
  const payload = `${value}.${expiresAt}`;
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

function verifyTempToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [value, expiresAtStr, signature] = parts;
  const payload = `${value}.${expiresAtStr}`;
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
  if (!value) return null;
  return value;
}

export function getTempCookie(req, name) {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  if (!match) return null;
  const token = decodeURIComponent(match[1]);
  return verifyTempToken(token);
}

export function setTempCookie(res, name, value) {
  const token = makeTempToken(value);
  const cookieValue = [
    `${name}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${TEMP_MAX_AGE_SEC}`,
    'HttpOnly',
    'Secure',
    'SameSite=None',
  ].join('; ');
  // 기존 Set-Cookie 헤더가 있으면 합치기
  const existing = res.getHeader('Set-Cookie');
  if (existing) {
    const arr = Array.isArray(existing) ? existing : [existing];
    res.setHeader('Set-Cookie', [...arr, cookieValue]);
  } else {
    res.setHeader('Set-Cookie', cookieValue);
  }
}

export function clearTempCookie(res, name) {
  const cookieValue = [
    `${name}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'Secure',
    'SameSite=None',
  ].join('; ');
  const existing = res.getHeader('Set-Cookie');
  if (existing) {
    const arr = Array.isArray(existing) ? existing : [existing];
    res.setHeader('Set-Cookie', [...arr, cookieValue]);
  } else {
    res.setHeader('Set-Cookie', cookieValue);
  }
}
