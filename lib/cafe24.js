// lib/cafe24.js
// 카페24 API 통신 헬퍼
// v24 재설계 (2차 수정):
//   - Admin OAuth (앱 설치용) → cafe24api.com 도메인 + Bearer 인증
//   - Customer OAuth (회원 인증용) → cafe24.com 도메인 + Basic 인증
//   - Admin API로 주문 조회, 고객 정보 조회 함수 추가 (WebHook 처리용)

import crypto from 'node:crypto';
import { getSupabase } from './supabase.js';

// ============================================================
// 환경변수
// ============================================================
const MALL_ID = process.env.CAFE24_MALL_ID;
const CLIENT_ID = process.env.CAFE24_CLIENT_ID;
const CLIENT_SECRET = process.env.CAFE24_CLIENT_SECRET;
const ADMIN_REDIRECT_URI = process.env.CAFE24_REDIRECT_URI;
const CUSTOMER_REDIRECT_URI = process.env.CAFE24_CUSTOMER_REDIRECT_URI;

const CAFE24_API_VERSION = '2026-03-01';

// Admin API / Admin OAuth 기본 도메인 (관리자용)
const API_BASE = `https://${MALL_ID}.cafe24api.com/api/v2`;
const ADMIN_AUTH_BASE = `https://${MALL_ID}.cafe24api.com/api/v2/oauth`;

// Customer OAuth 기본 도메인 (자사몰 대표 도메인)
// ⚠️ 관리자용(cafe24api.com)과 다르게 cafe24.com 도메인 사용
const CUSTOMER_BASE = `https://${MALL_ID}.cafe24.com/api/v2`;
const CUSTOMER_AUTH_BASE = `https://${MALL_ID}.cafe24.com/api/v2/oauth`;

// ============================================================
// Admin OAuth (앱 설치용) - 기존 유지
// ============================================================

export async function exchangeAdminCode(code) {
  const response = await fetch(`${ADMIN_AUTH_BASE}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: ADMIN_REDIRECT_URI,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Admin token exchange failed: ${response.status} ${text}`);
  }
  return response.json();
}

export async function getAdminAccessToken() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('cafe24_oauth')
    .select('*')
    .eq('mall_id', MALL_ID)
    .single();
  
  if (error || !data) {
    throw new Error('Admin OAuth not initialized. Install the app first.');
  }

  const now = Date.now();
  const expiresAt = new Date(data.expires_at).getTime();
  if (expiresAt - now < 5 * 60 * 1000) {
    return await refreshAdminToken(data.refresh_token);
  }
  return data.access_token;
}

async function refreshAdminToken(refreshToken) {
  const response = await fetch(`${ADMIN_AUTH_BASE}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Admin token refresh failed: ${response.status} ${text}`);
  }
  const tokens = await response.json();
  
  const supabase = getSupabase();
  await supabase.from('cafe24_oauth').upsert({
    mall_id: MALL_ID,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expires_at,
    refresh_token_expires_at: tokens.refresh_token_expires_at,
    scopes: tokens.scopes,
    issued_at: tokens.issued_at,
    updated_at: new Date().toISOString(),
  });
  return tokens.access_token;
}

// ============================================================
// Customer OAuth (쇼핑몰 회원 인증용)
// ⚠️ cafe24.com 도메인, scope는 mall.read_customer_identifier
// ============================================================

/**
 * Customer 로그인 시작 URL 생성
 */
export function buildCustomerAuthorizeUrl(state) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    state,
    redirect_uri: CUSTOMER_REDIRECT_URI,
    scope: 'mall.read_customer_identifier',
  });
  return `${CUSTOMER_AUTH_BASE}/authorize?${params.toString()}`;
}

/**
 * code → Customer access_token 교환
 */
export async function exchangeCustomerCode(code) {
  const response = await fetch(`${CUSTOMER_AUTH_BASE}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: CUSTOMER_REDIRECT_URI,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Customer token exchange failed: ${response.status} ${text}`);
  }
  return response.json();
}

/**
 * Customer access_token으로 회원 고유 식별자 조회
 * ⚠️ 공식 문서 기준 (2026-04 재확인):
 *   - URL: https://{mall}.cafe24.com/api/v2/customers/identifier (cafe24.com 도메인)
 *   - Authorization: Basic {token} (Bearer 아님!)
 *   - Response: { identifier: { shop_no, user_identifier } }
 * user_identifier = 몰ID + 샵NO + client_id + 회원ID 유니크 식별자
 */
export async function fetchCustomerIdentifier(customerAccessToken) {
  const response = await fetch(`${CUSTOMER_BASE}/customers/identifier`, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${customerAccessToken}`,
      'X-Cafe24-Api-Version': CAFE24_API_VERSION,
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Customer identifier fetch failed: ${response.status} ${text}`);
  }
  return response.json();  // { identifier: { shop_no, user_identifier } }
}

// ============================================================
// Admin API로 주문/회원 조회 (WebHook 처리용)
// ============================================================

export async function fetchOrder(orderId) {
  const accessToken = await getAdminAccessToken();
  const response = await fetch(
    `${API_BASE}/admin/orders/${encodeURIComponent(orderId)}?embed=items`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Cafe24-Api-Version': CAFE24_API_VERSION,
      },
    }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Order fetch failed: ${response.status} ${text}`);
  }
  return response.json();
}

export async function fetchCustomerByMemberId(memberId) {
  const accessToken = await getAdminAccessToken();
  const response = await fetch(
    `${API_BASE}/admin/customers?member_id=${encodeURIComponent(memberId)}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Cafe24-Api-Version': CAFE24_API_VERSION,
      },
    }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Customer fetch failed: ${response.status} ${text}`);
  }
  return response.json();
}

// ============================================================
// 유틸
// ============================================================

export function hashPhone(phone) {
  if (!phone) return null;
  const normalized = phone.replace(/\D/g, '');
  if (!normalized) return null;
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export function verifyWebhookSignature(receivedKey) {
  const expectedKey = process.env.CAFE24_WEBHOOK_SECRET;
  if (!expectedKey || !receivedKey) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedKey),
      Buffer.from(receivedKey)
    );
  } catch {
    return false;
  }
}
