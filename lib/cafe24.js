// lib/cafe24.js
// 환경변수 문제 회피: redirect_uri를 코드에 하드코딩
// v24 3차: Customer OAuth redirect_uri 인코딩 제거 (카페24 로그인 리다이렉트 버그 우회)

import crypto from 'node:crypto';
import { getSupabase } from './supabase.js';

const MALL_ID = process.env.CAFE24_MALL_ID;
const CLIENT_ID = process.env.CAFE24_CLIENT_ID;
const CLIENT_SECRET = process.env.CAFE24_CLIENT_SECRET;
const ADMIN_REDIRECT_URI = process.env.CAFE24_REDIRECT_URI;

// ⚠️ 환경변수 대신 하드코딩 (env에 뭔가 이상한 값이 붙어있어서 우회)
const CUSTOMER_REDIRECT_URI = 'https://shield-connect.vercel.app/api/auth/cafe24/callback';

const CAFE24_API_VERSION = '2026-03-01';

const API_BASE = `https://${MALL_ID}.cafe24api.com/api/v2`;
const ADMIN_AUTH_BASE = `https://${MALL_ID}.cafe24api.com/api/v2/oauth`;
const CUSTOMER_BASE = `https://${MALL_ID}.cafe24.com/api/v2`;
const CUSTOMER_AUTH_BASE = `https://${MALL_ID}.cafe24.com/api/v2/oauth`;

// ============================================================
// Admin OAuth
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
// Customer OAuth
// ============================================================

export function buildCustomerAuthorizeUrl(state) {
  // ⚠️ redirect_uri는 인코딩하지 않음 (raw URL로 전달)
  // 카페24가 자사몰 로그인 리다이렉트 과정에서 returnUrl을 이중 인코딩 후
  // 한 번만 디코딩해서 돌려주는 버그가 있어서, 우리가 인코딩하면
  // 카페24가 최종 단계에서 `https%3A%2F%2F...` 상태로 비교하게 되어 매칭 실패.
  // 공식 문서 샘플도 `redirect_uri=https://sampleapp.com/...` 형태로 raw 사용.
  const params =
    `response_type=code` +
    `&client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&state=${encodeURIComponent(state)}` +
    `&redirect_uri=${CUSTOMER_REDIRECT_URI}` +
    `&scope=${encodeURIComponent('mall.read_customer_identifier')}`;
  return `${CUSTOMER_AUTH_BASE}/authorize?${params}`;
}

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
  return response.json();
}

// ============================================================
// Admin API (WebHook용)
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
