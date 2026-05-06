// lib/vertex-auth.js
// ═══════════════════════════════════════════════════════════════
// Vertex AI OAuth 토큰 발급 + 캐싱
// ═══════════════════════════════════════════════════════════════
// 동작:
//   1. GOOGLE_SERVICE_ACCOUNT_JSON 환경변수에서 서비스 계정 정보 파싱
//   2. JWT 만들고 RS256으로 서명
//   3. Google OAuth 엔드포인트에 JWT 보내서 access_token 받기
//   4. 토큰 1시간 짜리 → 메모리에 캐시 (만료 5분 전부터 자동 갱신)
//
// 사용:
//   const token = await getVertexAccessToken();
//   const projectId = getProjectId();
//
// 외부 의존성: 없음 (Node.js 내장 crypto만 사용)
// ═══════════════════════════════════════════════════════════════

import crypto from 'crypto';

// 토큰 캐시 (서버 함수 인스턴스 단위로 유지)
let cachedToken = null;
let cachedExpiry = 0;

// 서비스 계정 JSON 캐시 (매번 파싱 안 하도록)
let cachedCredentials = null;

/**
 * 서비스 계정 JSON 파싱 (캐시됨)
 */
function getCredentials() {
  if (cachedCredentials) return cachedCredentials;

  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!json) {
    throw new Error('[vertex-auth] GOOGLE_SERVICE_ACCOUNT_JSON env var not set');
  }

  try {
    cachedCredentials = JSON.parse(json);
  } catch (e) {
    throw new Error('[vertex-auth] GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON');
  }

  if (!cachedCredentials.client_email || !cachedCredentials.private_key) {
    throw new Error('[vertex-auth] Service account JSON missing client_email or private_key');
  }

  return cachedCredentials;
}

/**
 * 프로젝트 ID 가져오기
 */
export function getProjectId() {
  const cred = getCredentials();
  return cred.project_id;
}

/**
 * Base64 URL-safe 인코딩 (JWT 표준)
 */
function base64UrlEncode(input) {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

/**
 * JWT 만들고 RS256으로 서명
 */
function createSignedJwt(credentials) {
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const payload = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,  // 1시간
    iat: now,
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  // RS256 서명 (private_key 사용)
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  const signature = signer.sign(credentials.private_key);
  const signatureB64 = base64UrlEncode(signature);

  return `${signingInput}.${signatureB64}`;
}

/**
 * OAuth 토큰 받기 (Google에 JWT 보내고 access_token 교환)
 */
async function fetchAccessToken() {
  const credentials = getCredentials();
  const jwt = createSignedJwt(credentials);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);  // 10초 timeout

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }).toString(),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OAuth request failed: HTTP ${response.status} - ${errText.slice(0, 300)}`);
    }

    const data = await response.json();
    if (!data.access_token) {
      throw new Error('OAuth response missing access_token');
    }

    return {
      accessToken: data.access_token,
      expiresInSeconds: data.expires_in || 3600,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Vertex AI access_token 가져오기
 * - 캐시된 토큰이 있고 5분 이상 남았으면 그대로 반환
 * - 아니면 새로 발급받아 캐시
 */
export async function getVertexAccessToken() {
  const safetyMarginMs = 5 * 60 * 1000;  // 만료 5분 전부터 갱신

  if (cachedToken && Date.now() < cachedExpiry - safetyMarginMs) {
    return cachedToken;
  }

  const { accessToken, expiresInSeconds } = await fetchAccessToken();
  cachedToken = accessToken;
  cachedExpiry = Date.now() + expiresInSeconds * 1000;

  console.log(`[vertex-auth] new access token acquired (expires in ${expiresInSeconds}s)`);
  return cachedToken;
}

/**
 * 토큰 강제 갱신 (디버깅/문제 해결용)
 */
export function clearTokenCache() {
  cachedToken = null;
  cachedExpiry = 0;
}
