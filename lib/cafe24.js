// lib/cafe24.js
// 카페24 OAuth 토큰 관리 + API 호출 헬퍼
//
// v23.3: fetchOrderItems 함수 누락 수정
//   - v23.2에서 API 버전 업데이트하면서 실수로 누락
//   - redeem.js가 fetchOrderItems를 임포트하는데 없어서 SyntaxError
//
// v23.2: API 버전 업데이트
//   - 2024-06-01 (만료됨) → 2026-03-01 (최신)
//
// 주요 기능:
//   - buildInstallUrl: 앱 설치 authorize URL 생성
//   - exchangeCodeForToken: code → access_token 교환
//   - saveInstallToken: 토큰을 Supabase cafe24_oauth에 저장
//   - getValidAccessToken: 만료된 access_token 자동 갱신
//   - fetchOrder: 주문 조회
//   - fetchOrderItems: 주문 상품 상세 조회 (여러 상품이 있을 때)

import { supabase } from './supabase.js';

const CAFE24_API_VERSION = '2026-03-01';  // 최신 버전 (2027-03 쯤 재확인 필요)
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

// ------------------------------------------------------------
// 3. 토큰을 Supabase에 저장
// ------------------------------------------------------------
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
    mall_id: mall_id,
    access_token: access_token,
    refresh_token: refresh_token,
    access_token_expires_at: expires_at,
    refresh_token_expires_at: refresh_token_expires_at,
    scopes: Array.isArray(scopes) ? scopes.join(',') : String(scopes || ''),
    client_id: client_id || CLIENT_ID,
    updated_at: new Date().toISOString()
  };

  // upsert (이미 있으면 업데이트, 없으면 삽입)
  const { error } = await supabase
    .from('cafe24_oauth')
    .upsert(norm, { onConflict: 'mall_id' });

  if (error) {
    throw new Error(`cafe24_oauth 저장 실패: ${error.message}`);
  }

  return norm;
}

// ------------------------------------------------------------
// 4. 유효한 access_token 얻기 (만료되면 자동 refresh)
// ------------------------------------------------------------
export async function getValidAccessToken() {
  const { data: oauth, error } = await supabase
    .from('cafe24_oauth')
    .select('*')
    .eq('mall_id', MALL_ID)
    .single();

  if (error || !oauth) {
    throw new Error('카페24 앱 설치가 필요합니다. /api/oauth/callback 을 방문하세요.');
  }

  // 5분 여유를 두고 만료 체크
  const expiresAt = new Date(oauth.access_token_expires_at).getTime();
  const nowPlus5min = Date.now() + 5 * 60 * 1000;

  if (expiresAt > nowPlus5min) {
    // 아직 유효
    return oauth.access_token;
  }

  // 만료됨 → refresh
  console.log('[cafe24] access_token 만료, refresh 시도');
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

  // 갱신된 토큰 저장
  await saveInstallToken(data);
  return data.access_token;
}

// ------------------------------------------------------------
// 5. 주문 조회 (주문 기본 정보)
// ------------------------------------------------------------
export async function fetchOrder(orderId) {
  const accessToken = await getValidAccessToken();

  const url = `${CAFE24_HOST}/api/v2/admin/orders/${encodeURIComponent(orderId)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Cafe24-Api-Version': CAFE24_API_VERSION
    }
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`주문 조회 실패 [${response.status}]: ${JSON.stringify(data)}`);
  }

  // 카페24는 주문 1건 조회 시 { order: {...} } 형식
  // 방어적으로 둘 다 처리
  return data.order || data.orders?.[0] || data;
}

// ------------------------------------------------------------
// 6. 주문 상품 조회 (주문 상세 - product_no 등)
// ------------------------------------------------------------
export async function fetchOrderItems(orderId) {
  const accessToken = await getValidAccessToken();

  const url = `${CAFE24_HOST}/api/v2/admin/orders/${encodeURIComponent(orderId)}/items`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Cafe24-Api-Version': CAFE24_API_VERSION
    }
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`주문 상품 조회 실패 [${response.status}]: ${JSON.stringify(data)}`);
  }

  // 카페24는 주문 상품 조회 시 { items: [...] } 형식
  return data.items || [];
}
