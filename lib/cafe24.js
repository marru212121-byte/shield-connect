// lib/cafe24.js
// 카페24 OAuth 토큰 관리 + 주문 조회
// Access Token 2시간, Refresh Token 2주 (갱신 시 새 refresh도 함께 발급됨)

import { supabase } from './supabase.js';

function mallId() { return process.env.CAFE24_MALL_ID; }
function clientId() { return process.env.CAFE24_CLIENT_ID; }
function clientSecret() { return process.env.CAFE24_CLIENT_SECRET; }

const API_VERSION = '2024-06-01';

function apiBase() {
  return `https://${mallId()}.cafe24api.com`;
}

function basicAuthHeader() {
  const b64 = Buffer.from(`${clientId()}:${clientSecret()}`).toString('base64');
  return `Basic ${b64}`;
}

/** 앱 설치 1회성용 authorize URL 생성 */
export function buildInstallUrl(state, scopes) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId(),
    state: state,
    redirect_uri: process.env.CAFE24_REDIRECT_URI,
    scope: scopes.join(',')
  });
  return `${apiBase()}/api/v2/oauth/authorize?${params.toString()}`;
}

/** 인가 코드 → Access Token 교환 (앱 설치 1회) */
export async function exchangeCodeForToken(code) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: process.env.CAFE24_REDIRECT_URI
  });

  const res = await fetch(`${apiBase()}/api/v2/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      Authorization: basicAuthHeader()
    },
    body: body.toString()
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`카페24 토큰 교환 실패 [${res.status}]: ${text}`);
  }
  return res.json();
}

/** Refresh Token으로 Access Token 갱신 */
async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  });

  const res = await fetch(`${apiBase()}/api/v2/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      Authorization: basicAuthHeader()
    },
    body: body.toString()
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`카페24 토큰 갱신 실패 [${res.status}]: ${text}`);
  }
  return res.json();
}

/** 토큰 응답을 DB 스키마에 맞게 정규화 */
function normalizeTokenResponse(t) {
  const now = Date.now();
  const accessExpiresAt = t.expires_at
    ? new Date(t.expires_at).toISOString()
    : new Date(now + (Number(t.expires_in || 7200)) * 1000).toISOString();
  const refreshExpiresAt = t.refresh_token_expires_at
    ? new Date(t.refresh_token_expires_at).toISOString()
    : new Date(now + (Number(t.refresh_token_expires_in || 1209600)) * 1000).toISOString();
  return {
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    access_token_expires_at: accessExpiresAt,
    refresh_token_expires_at: refreshExpiresAt,
    scopes: Array.isArray(t.scopes) ? t.scopes.join(',') : (t.scopes || '')
  };
}

/** 앱 설치 후 토큰을 DB에 저장 */
export async function saveInstallToken(tokenResponse) {
  const norm = normalizeTokenResponse(tokenResponse);
  const { error } = await supabase.from('cafe24_oauth').upsert({
    id: 1,
    mall_id: mallId(),
    ...norm
  });
  if (error) throw new Error(`토큰 저장 실패: ${error.message}`);
  return norm;
}

/** 유효한 Access Token 반환 (만료 임박 시 자동 갱신) */
export async function getValidAccessToken() {
  const { data: oauth, error } = await supabase
    .from('cafe24_oauth')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (error) throw new Error(`OAuth 조회 실패: ${error.message}`);
  if (!oauth) throw new Error('카페24 앱 설치 필요 — /api/oauth/install 먼저 실행');

  const now = Date.now();
  const expiresAt = new Date(oauth.access_token_expires_at).getTime();
  const bufferMs = 5 * 60 * 1000; // 5분 여유

  if (expiresAt - now > bufferMs) {
    return oauth.access_token;
  }

  // 갱신 필요
  console.log('[cafe24] Access Token 갱신 중...');
  const refreshed = await refreshAccessToken(oauth.refresh_token);
  const norm = normalizeTokenResponse(refreshed);
  const { error: uerr } = await supabase.from('cafe24_oauth').update(norm).eq('id', 1);
  if (uerr) console.error('[cafe24] 토큰 업데이트 DB 저장 실패:', uerr);
  return norm.access_token;
}

/** 주문 단건 조회 */
export async function fetchOrder(orderId) {
  const token = await getValidAccessToken();
  const res = await fetch(
    `${apiBase()}/api/v2/admin/orders/${encodeURIComponent(orderId)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Cafe24-Api-Version': API_VERSION,
        'Content-Type': 'application/json'
      }
    }
  );

  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`주문 조회 실패 [${res.status}]: ${text}`);
  }
  return res.json();
}

/** 주문의 아이템 상세 조회 (아이템이 별도 엔드포인트인 경우) */
export async function fetchOrderItems(orderId) {
  const token = await getValidAccessToken();
  const res = await fetch(
    `${apiBase()}/api/v2/admin/orders/${encodeURIComponent(orderId)}/items`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Cafe24-Api-Version': API_VERSION,
        'Content-Type': 'application/json'
      }
    }
  );

  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`주문 아이템 조회 실패 [${res.status}]: ${text}`);
  }
  return res.json();
}
