// api/auth/cafe24/callback.js
// v26: 디버그 로그 추가 (카페24 토큰 응답 형식 확인용)
//   - 기존 동작은 100% 동일
//   - exchangeCustomerCode 응답 전체를 콘솔에 찍어서
//     카페24가 user_id 같은 필드를 주는지 확인

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

    // ★★★ v26 디버그 로그 ★★★
    // 카페24 Customer OAuth 토큰 응답 전체를 찍어서
    // user_id / mall_user_id / member_id 등 어떤 필드가 들어있는지 확인
    console.log('[auth/cafe24/callback] ▶▶▶ FULL TOKEN RESPONSE ▶▶▶');
    console.log(JSON.stringify(tokens, null, 2));
    console.log('[auth/cafe24/callback] ◀◀◀ END TOKEN RESPONSE ◀◀◀');

    const customerAccessToken = tokens.access_token;
    if (!customerAccessToken) {
      return redirectToApp(res, '/?auth_error=no_access_token');
    }

    // 기존 동작 그대로: user_identifier로 적립
    let memberId;
    try {
      const identifierResp = await fetchCustomerIdentifier(customerAccessToken);
      console.log('[auth/cafe24/callback] identifier response:', JSON.stringify(identifierResp));
      memberId = identifierResp?.identifier?.user_identifier;
    } catch (err) {
      console.error('[auth/cafe24/callback] identifier fetch failed:', err);
      return redirectToApp(res, '/?auth_error=identifier_fetch_failed');
    }

    if (!memberId) {
      console.error('[auth/cafe24/callback] no user_identifier in response');
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
