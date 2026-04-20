// lib/kakao.js
// 카카오 로그인 OAuth 헬퍼
// 주의: 현재 앱은 Client Secret OFF 상태이므로 secret 파라미터 보내지 않음

const KAKAO_AUTH_URL = 'https://kauth.kakao.com/oauth/authorize';
const KAKAO_TOKEN_URL = 'https://kauth.kakao.com/oauth/token';
const KAKAO_USER_URL = 'https://kapi.kakao.com/v2/user/me';

/** 로그인 시작용 URL 생성 */
export function buildAuthUrl(state) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.KAKAO_REST_API_KEY,
    redirect_uri: process.env.KAKAO_REDIRECT_URI,
    state: state
  });
  return `${KAKAO_AUTH_URL}?${params.toString()}`;
}

/** 인가 코드 → Access Token 교환 */
export async function exchangeCodeForToken(code) {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: process.env.KAKAO_REST_API_KEY,
    redirect_uri: process.env.KAKAO_REDIRECT_URI,
    code: code
  });

  const res = await fetch(KAKAO_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body: params.toString()
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`카카오 토큰 교환 실패 [${res.status}]: ${text}`);
  }
  return res.json();
}

/** 사용자 정보 조회 (kakao_account.profile 등 포함) */
export async function fetchUserInfo(accessToken) {
  const res = await fetch(KAKAO_USER_URL, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`카카오 사용자 정보 조회 실패 [${res.status}]: ${text}`);
  }
  return res.json();
}

/** 응답에서 표시용 정보 추출 (스키마 변경에 안전하게) */
export function extractUserFields(kakaoUser) {
  const id = String(kakaoUser?.id || '');
  const account = kakaoUser?.kakao_account || {};
  const profile = account?.profile || {};
  return {
    kakao_id: id,
    nickname: profile?.nickname || '익명',
    profile_image_url: profile?.profile_image_url || null,
    email: account?.email || null
  };
}
