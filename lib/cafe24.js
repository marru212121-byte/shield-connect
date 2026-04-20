// lib/cafe24.js
// 카페24 OAuth 토큰 관리 + API 호출 헬퍼
//
// v23.3: fetchOrderItems 함수 누락 수정
//   - v23.2에서 API 버전 업데이트하면서 실수로 누락
//   - redeem.js가 fetchOrderItems를 임포트하는데 없어서 SyntaxError
//
// v23.2: API 버전 업데이트
//   - 2024-06-01 (만료됨) → 2026-03-01 (최신)

import { supabase } from './supabase.js';

const CAFE24_API_VERSION = '2026-03-01';
const CLIENT_ID = process.env.CAFE24_CLIENT_ID;
const CLIENT_SECRET = process.env.CAFE24_CLIENT_SECRET;
const MALL_ID = process.env.CAFE24_MALL_ID;
const REDIRECT_URI = process.env.CAFE24_REDIRECT_URI;

const CAFE24_HOST = `https://${MALL_ID}.cafe24api.com`;

// ------------------------------------------------------------
// 1. 설치 URL 생성
// ------------------------------------------------------------
export function buildInstallUrl(state, scopes) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    state: state,
    redirect_uri: REDIRECT_URI,
    scope: scopes.join(',')
  });
  return `${CAFE24_HOST}/api/v2/oauth/authorize?${params.toString()}`;
}

// ------------------------------------------------------------
// 2. code → access_token 교환 (초기 설치)
// ------------------------------------------------------------
export async function exchangeCodeForToken(code) {
  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

  const response = await fetch(`${CAFE24_HOST}/api/v2/oauth/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
