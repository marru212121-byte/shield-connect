// api/auth/cafe24/callback.js
// v28: fetchCustomerIdentifier (카페24 공식 진리 ID) 우선 사용
//   - 자사몰 직접 가입자와 소셜 로그인 회원 모두 동일 형식 ID 보장
//   - 카페24 권한선택(쇼핑몰 고객) "고객 식별자(Customer Identifier)" 권한 활용
//   - 1차: fetchCustomerIdentifier → user_identifier (공식 진리 ID)
//   - 폴백: tokens.user_id (API 일시 장애 시 안전망)
//
// v27까지의 동작: tokens.user_id 우선 사용 → 자사몰 직접 가입자 ID 형식 불확실
// v28 변경: fetchCustomerIdentifier 우선 → 카페24 공식 통일 ID 보장

import crypto from 'node:crypto';
import {
  exchangeCustomerCode,
  fetchCustomerIdentifier,
} from '../../../lib/cafe24.js';
import { getSupabase } from '../../../lib/supabase.js';
import { setSessionCookie } from '../../../lib/session.js';

const STATE_COOKIE = 'sc_oauth_state';
const SIGNUP_BONUS = 1;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  try {
    const { code, state, error: oauthError, error_description } = req.query;

    if (oauthError) {
      console.warn('[auth/cafe24/callback] oauth error:', oauthError, error_description);
      return redirectToApp(res, '/?auth_error=' + encodeURIComponent(oauthError));
    }

    if (!code || !state) {
      return redirectToApp(res, '/?auth_error=missing_params');
    }

    const stateCookie = getCookie(req, STATE_COOKIE);
    if (!stateCookie) {
      return redirectToApp(res, '/?auth_error=state_missing');
    }

    const stateResult = verifyStateCookie(stateCookie, state);
    if (!stateResult.valid) {
      return redirectToApp(res, '/?auth_error=state_invalid');
    }
    const returnTo = stateResult.returnTo;

    clearStateCookie(res);

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

    // ★★★ v28 핵심 변경 ★★★
    // 카페24 공식 "진리 ID" (Customer Identifier) API 먼저 호출.
    // 자사몰 직접 가입자도 소셜 로그인 회원도 카페24 백엔드에서 동일 형식의
    // 고유 식별자를 발급받음. 결제 webhook의 order.member_id와도 동일 형식 보장.
    //
    // 폴백: API 일시 장애 시 tokens.user_id 사용 (소셜 케이스는 검증됨)
    let memberId;
    try {
      const identifierResp = await fetchCustomerIdentifier(customerAccessToken);
      memberId = identifierResp?.identifier?.user_identifier;
      console.log('[auth/cafe24/callback] identifier resolved (v28):', memberId);
    } catch (err) {
      console.warn('[auth/cafe24/callback] identifier fetch failed, fallback to tokens.user_id:', err?.message || err);
      memberId = tokens.user_id;
      console.log('[auth/cafe24/callback] member resolved via fallback:', memberId);
    }

    if (!memberId) {
      console.error('[auth/cafe24/callback] no member id resolved');
      return redirectToApp(res, '/?auth_error=no_member_id');
    }

    const supabase = getSupabase();
    const { data: existing } = await supabase
      .from('cafe24_member_credits')
      .select('member_id, signup_bonus_given')
      .eq('member_id', memberId)
      .maybeSingle();

    if (!existing?.signup_bonus_given) {
      const phoneHash = null;
      const { data: bonusResult, error: bonusError } = await supabase.rpc('grant_signup_bonus', {
        p_member_id: memberId,
        p_bonus_amount: SIGNUP_BONUS,
        p_phone_hash: phoneHash,
      });

      if (bonusError) {
        console.error('[auth/cafe24/callback] bonus grant failed:', bonusError);
      } else {
        const result = Array.isArray(bonusResult) ? bonusResult[0] : bonusResult;
        console.log('[auth/cafe24/callback] signup bonus:', memberId, result?.reason);
      }
    }

    setSessionCookie(res, memberId);

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

  if (state !== stateParam) return { valid: false };

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
  cookies.push(`${STATE_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None`);
  res.setHeader('Set-Cookie', cookies);
}

function redirectToApp(res, path) {
  res.writeHead(302, { Location: path });
  res.end();
}
