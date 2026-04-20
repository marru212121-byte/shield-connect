// lib/cafe24.js
// 카페24 OAuth 토큰 관리 + API 호출 헬퍼
//
// v23.6: 토큰 만료 401 에러 시 강제 갱신 후 자동 재시도 추가

import { supabase } from './supabase.js';

const CAFE24_API_VERSION = '2026-03-01';
const CLIENT_ID = process.env.CAFE24_CLIENT_ID;
const CLIENT_SECRET = process.env.CAFE24_CLIENT_SECRET;
const MALL_ID = process.env.CAFE24_MALL_ID;
const REDIRECT_URI = process.env.CAFE24_REDIRECT_URI;

const CAFE24_HOST = `https://${MALL_ID}.cafe24api.com`;

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
      code: code,
      redirect_uri: REDIRECT_URI
    }).toString()
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`토큰 교환 실패 [${response.status}]: ${JSON.stringify(data)}`);
  }
  return data;
}

export async function saveInstallToken(tokenResponse) {
  const {
    access_token,
    refresh_token,
    expires_at,
    refresh_token_expires_at,
    mall_id,
    scopes,
    client_id
  } = tokenResponse;

  const norm = {
    mall_id: mall_id || MALL_ID,
    access_token: access_token,
    refresh_token: refresh_token,
    access_token_expires_at: expires_at,
    refresh_token_expires_at: refresh_token_expires_at,
    scopes: Array.isArray(scopes) ? scopes.join(',') : String(scopes || ''),
    updated_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from('cafe24_oauth')
    .upsert(norm, { onConflict: 'mall_id' });

  if (error) {
    throw new Error(`cafe24_oauth 저장 실패: ${error.message}`);
  }

  return norm;
}

export async function getValidAccessToken() {
  const { data: oauth, error } = await supabase
    .from('cafe24_oauth')
    .select('*')
    .eq('mall_id', MALL_ID)
    .single();

  if (error || !oauth) {
    throw new Error('카페24 앱 설치가 필요합니다. /api/oauth/callback 을 방문하세요.');
  }

  const expiresAt = new Date(oauth.access_token_expires_at).getTime();
  const nowPlus5min = Date.now() + 5 * 60 * 1000;

  if (expiresAt > nowPlus5min) {
    return oauth.access_token;
  }

  console.log('[cafe24] access_token 만료 임박, refresh 시도');
  return await forceRefreshToken();
}

// 만료시간 무시하고 Refresh Token으로 강제 갱신
async function forceRefreshToken() {
  const { data: oauth } = await supabase
    .from('cafe24_oauth')
    .select('refresh_token')
    .eq('mall_id', MALL_ID)
    .single();

  if (!oauth) throw new Error('refresh_token 없음');

  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const response = await fetch(`${CAFE24_HOST}/api/v2/oauth/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: oauth.refresh_token
    }).toString()
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`토큰 갱신 실패 [${response.status}]: ${JSON.stringify(data)}`);
  }

  await saveInstallToken(data);
  console.log('[cafe24] 토큰 강제 갱신 성공');
  return data.access_token;
}

// 401 invalid_token 에러 시 강제 갱신 후 자동 재시도
async function callCafe24WithRetry(url, retried = false) {
  const accessToken = await getValidAccessToken();

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Cafe24-Api-Version': CAFE24_API_VERSION
    }
  });

  const data = await response.json();

  // 토큰 만료 에러이고 아직 재시도 안 했으면 강제 갱신 후 재시도
  if (!response.ok && response.status === 401 && !retried) {
    const errMsg = JSON.stringify(data);
    if (errMsg.includes('invalid_token') || errMsg.includes('expired')) {
      console.log('[cafe24] 401 감지, 토큰 강제 갱신 후 재시도');
      await forceRefreshToken();
      return await callCafe24WithRetry(url, true);
    }
  }

  if (!response.ok) {
    throw new Error(`카페24 API 실패 [${response.status}]: ${JSON.stringify(data)}`);
  }

  return data;
}

export async function fetchOrder(orderId) {
  const url = `${CAFE24_HOST}/api/v2/admin/orders/${encodeURIComponent(orderId)}`;
  const data = await callCafe24WithRetry(url);
  return data.order || data.orders?.[0] || data;
}

export async function fetchOrderItems(orderId) {
  const url = `${CAFE24_HOST}/api/v2/admin/orders/${encodeURIComponent(orderId)}/items`;
  const data = await callCafe24WithRetry(url);
  return data.items || [];
}
