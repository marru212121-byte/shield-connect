// lib/cafe24.js
// 카페24 API 통신 헬퍼
// v24 재설계:
//   - 기존 Admin OAuth 부분 유지 (앱 설치용)
//   - Customer OAuth 함수 신규 추가 (사용자 로그인용)
//   - Admin API로 주문 조회, 고객 정보 조회 함수 추가 (WebHook 처리용)

import crypto from 'node:crypto';
import { getSupabase } from './supabase.js';

// ============================================================
// 환경변수
// ============================================================
const MALL_ID = process.env.CAFE24_MALL_ID;              // 'marru2121'
const CLIENT_ID = process.env.CAFE24_CLIENT_ID;
const CLIENT_SECRET = process.env.CAFE24_CLIENT_SECRET;
const ADMIN_REDIRECT_URI = process.env.CAFE24_REDIRECT_URI;                  // 앱 설치용
const CUSTOMER_REDIRECT_URI = process.env.CAFE24_CUSTOMER_REDIRECT_URI;      // 사용자 로그인용

const CAFE24_API_VERSION = '2026-03-01';
const API_BASE = `https://${MALL_ID}.cafe24api.com/api/v2`;
const AUTH_BASE = `https://${MALL_ID}.cafe24api.com/api/v2/oauth`;

// ============================================================
// Admin OAuth (앱 설치용) - 기존 로직 유지
// ============================================================

/**
 * 앱 설치 시 카페24로부터 받은 code로 Admin access_token 교환
 * api/oauth/callback.js 에서 호출
 */
export async function exchangeAdminCode(code) {
  const response = await fetch(`${AUTH_BASE}/token`, {
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

/**
 * Admin access_token을 DB에서 조회 (만료 시 자동 갱신)
 * WebHook 처리 시 카페24 API 호출용
 */
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

  // access_token 만료 체크 (5분 여유)
  const now = Date.now();
  const expiresAt = new Date(data.expires_at).getTime();
  if (expiresAt - now < 5 * 60 * 1000) {
    return await refreshAdminToken(data.refresh_token);
  }
  return data.access_token;
}

/**
 * Admin refresh_token으로 access_token 갱신
 */
async function refreshAdminToken(refreshToken) {
  const response = await fetch(`${AUTH_BASE}/token`, {
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
  
  // DB에 새 토큰 저장
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
// Customer OAuth (사용자 로그인용) - 신규 추가
// ============================================================

/**
 * Customer 로그인 시작 URL 생성
 * 사용자를 이 URL로 보내면 카페24 로그인 화면 뜸
 * 참조: https://developers.cafe24.com/app/front/app/develop/customeraccesstoken/oauthcode
 */
export function buildCustomerAuthorizeUrl(state) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    state,
    redirect_uri: CUSTOMER_REDIRECT_URI,
    scope: 'mall.read_customer',  // 권한 요청
  });
  return `${AUTH_BASE}/authorize?${params.toString()}`;
}

/**
 * Customer 로그인 콜백에서 받은 code로 Customer access_token 교환
 * api/auth/cafe24/callback.js 에서 호출
 */
export async function exchangeCustomerCode(code) {
  const response = await fetch(`${AUTH_BASE}/token`, {
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
 * Customer access_token으로 회원 고유 식별자(member_id) 조회
 * 참조: https://developers.cafe24.com/app/front/app/develop/customeraccesstoken/customeridentifier
 */
export async function fetchCustomerIdentifier(customerAccessToken) {
  const response = await fetch(`${API_BASE}/customers/identifier`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${customerAccessToken}`,
      'X-Cafe24-Api-Version': CAFE24_API_VERSION,
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Customer identifier fetch failed: ${response.status} ${text}`);
  }
  return response.json();  // { customer: { member_id, ... } }
}

// ============================================================
// Admin API로 주문/회원 조회 (WebHook 처리용)
// ============================================================

/**
 * 주문번호로 주문 상세 조회 (WebHook에서 상품번호 확인용)
 */
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
  return response.json();  // { order: {...} }
}

/**
 * member_id로 회원 정보 조회 (전화번호 해싱용)
 */
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
  return response.json();  // { customers: [{...}] }
}

// ============================================================
// 유틸
// ============================================================

/**
 * 전화번호 SHA-256 해싱 (중복가입 방지용)
 * 원본 전화번호를 DB에 저장하지 않기 위함
 */
export function hashPhone(phone) {
  if (!phone) return null;
  // 숫자만 추출 (010-1234-5678 → 01012345678)
  const normalized = phone.replace(/\D/g, '');
  if (!normalized) return null;
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * WebHook 서명 검증
 * 카페24가 X-API-Key 헤더로 보낸 값이 우리 Secret과 일치하는지 확인
 */
export function verifyWebhookSignature(receivedKey) {
  const expectedKey = process.env.CAFE24_WEBHOOK_SECRET;
  if (!expectedKey || !receivedKey) return false;
  // 타이밍 공격 방지를 위한 안전한 비교
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedKey),
      Buffer.from(receivedKey)
    );
  } catch {
    return false;
  }
}
