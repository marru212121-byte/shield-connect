// api/auth/cafe24/callback.js
// 카페24 Customer 로그인 콜백
// 플로우: 카페24 로그인 성공 → 이 라우트로 code+state 전달
//   1. state 검증 (CSRF 방지)
//   2. code로 Customer access_token 교환
//   3. access_token으로 member_id 조회
//   4. 신규 회원이면 가입 보너스 6크레딧 지급
//   5. 세션 쿠키 심고 앱으로 리다이렉트

import crypto from 'node:crypto';
import {
  exchangeCustomerCode,
  fetchCustomerIdentifier,
  fetchCustomerByMemberId,
  hashPhone,
} from '../../../lib/cafe24.js';
import { getSupabase } from '../../../lib/supabase.js';
import { setSessionCookie } from '../../../lib/session.js';

const STATE_COOKIE = 'sc_oauth_state';
const SIGNUP_BONUS = 6;  // 신규 가입 보너스 크레딧 수

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  try {
    const { code, state, error: oauthError, error_description } = req.query;

    // 사용자가 동의를 거부했거나 카페24에서 에러 반환한 경우
    if (oauthError) {
      console.warn('[auth/cafe24/callback] oauth error:', oauthError, error_description);
      return redirectToApp(res, '/?auth_error=' + encodeURIComponent(oauthError));
    }

    if (!code || !state) {
      return redirectToApp(res, '/?auth_error=missing_params');
    }

    // 1. state 쿠키 검증
    const stateCookie = getCookie(req, STATE_COOKIE);
    if (!stateCookie) {
      return redirectToApp(res, '/?auth_error=state_missing');
    }

    const stateResult = verifyStateCookie(stateCookie, state);
    if (!stateResult.valid) {
      return redirectToApp(res, '/?auth_error=state_invalid');
    }
    const returnTo = stateResult.returnTo;

    // state 쿠키 제거 (일회용)
    clearStateCookie(res);

    // 2. code로 Customer access_token 교환
    let tokens;
    try {
      tokens = await exchangeCustomerCode(code);
    } catch (err) {
      console.error('[auth/cafe24/callback] token exchange failed:', err);
      return redirectToApp(res, '/?auth_error=token_exchange_failed');
    }

    const customerAccessToken = tokens.access_token;
    if (!customerAccessToken) {
      return redirectToApp(res, '/?auth_error=no_access_token');
    }

    // 3. member_id 조회
    let memberId;
    try {
      const identifier = await fetchCustomerIdentifier(customerAccessToken);
      memberId = identifier?.customer?.member_id;
    } catch (err) {
      console.error('[auth/cafe24/callback] identifier fetch failed:', err);
      return redirectToApp(res, '/?auth_error=identifier_fetch_failed');
    }

    if (!memberId) {
      return redirectToApp(res, '/?auth_error=no_member_id');
    }

    // 4. 신규 회원이면 가입 보너스 지급
    const supabase = getSupabase();
    const { data: existing } = await supabase
      .from('cafe24_member_credits')
      .select('member_id, signup_bonus_given')
      .eq('member_id', memberId)
      .maybeSingle();

    if (!existing?.signup_bonus_given) {
      // 전화번호 해싱 (중복가입 방지용)
      let phoneHash = null;
      try {
        const customerData = await fetchCustomerByMemberId(memberId);
        const phone = customerData?.customers?.[0]?.phone
          || customerData?.customers?.[0]?.cellphone;
        phoneHash = hashPhone(phone);
      } catch (err) {
        // 전화번호 조회 실패해도 가입은 진행
        console.warn('[auth/cafe24/callback] phone fetch failed:', err.message);
      }

      // 보너스 지급 RPC 호출
      const { data: bonusResult, error: bonusError } = await supabase.rpc('grant_signup_bonus', {
        p_member_id: memberId,
        p_bonus_amount: SIGNUP_BONUS,
        p_phone_hash: phoneHash,
      });

      if (bonusError) {
        console.error('[auth/cafe24/callback] bonus grant failed:', bonusError);
        // 보너스 실패해도 로그인 자체는 진행 (회원 레코드는 RPC 내부에서 생성됨)
      } else {
        const result = Array.isArray(bonusResult) ? bonusResult[0] : bonusResult;
        console.log('[auth/cafe24/callback] signup bonus:', memberId, result?.reason);
      }
    }

    // 5. 세션 쿠키 심기
    setSessionCookie(res, memberId);

    // 6. 앱으로 리다이렉트 (가입 보너스 지급됐으면 쿼리로 알림)
    const redirectUrl = new URL(returnTo, 'https://placeholder.local');
    if (!existing?.signup_bonus_given) {
      redirectUrl.searchParams.set('welcome', '1');
    }
    return redirectToApp(res, redirectUrl.pathname + redirectUrl.search);
  } catch (err) {
    console.error('[auth/cafe24/callback] unexpected error:', err);
    return redirectToApp(res, '/?auth_error=internal');
  }
}

// ============================================================
// 헬퍼
// ============================================================

function getCookie(req, name) {
  const header = req.headers.cookie || '';
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function verifyStateCookie(cookieValue, stateParam) {
  const parts = cookieValue.split('.');
  if (parts.length !== 3) return { valid: false };

  const [state, returnToB64, signature] = parts;
  const payload = `${state}.${returnToB64}`;
  const expectedSig = crypto
    .createHmac('sha256', process.env.SESSION_SECRET)
    .update(payload)
    .digest('base64url');

  try {
    const a = Buffer.from(signature);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length) return { valid: false };
    if (!crypto.timingSafeEqual(a, b)) return { valid: false };
  } catch {
    return { valid: false };
  }

  // state 파라미터와 쿠키 state 일치 확인
  if (state !== stateParam) return { valid: false };

  // returnTo 복원
  let returnTo = '/';
  try {
    returnTo = Buffer.from(returnToB64, 'base64url').toString('utf8');
    if (!returnTo.startsWith('/') || returnTo.startsWith('//')) returnTo = '/';
  } catch {
    returnTo = '/';
  }

  return { valid: true, returnTo };
}

function clearStateCookie(res) {
  const existing = res.getHeader('Set-Cookie') || [];
  const cookies = Array.isArray(existing) ? existing : [existing];
  cookies.push(`${STATE_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
  res.setHeader('Set-Cookie', cookies);
}

function redirectToApp(res, path) {
  res.writeHead(302, { Location: path });
  res.end();
}
