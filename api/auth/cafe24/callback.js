// api/auth/cafe24/callback.js
// v29 (롤백 + 정리): tokens.user_id만 사용. fetchCustomerIdentifier 완전 제거.
//
// 변경 이력:
//   v27: tokens.user_id 우선 + fetchCustomerIdentifier 폴백
//   v28: fetchCustomerIdentifier 우선 → 실측 결과 호출마다 다른 임시값 반환 확인
//        (08:07:03 → C2f3bbdf... / 08:08:54 → C8dbdb5b... / 동일 카카오 계정)
//   v29: tokens.user_id만 사용. fetchCustomerIdentifier 폴백도 제거 (위험).
//
// 근거:
//   - tokens.user_id (예: 3677479709@k, 20988042@n) = 카페24의 영구 회원 식별자
//   - 결제 webhook order.member_id와 100% 동일 형식 = 적립 매칭 가능
//   - fetchCustomerIdentifier 의 user_identifier = 세션마다 다른 임시값 (영구 ID 아님)

import crypto from 'node:crypto';
import { exchangeCustomerCode } from '../../../lib/cafe24.js';
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

    // ★★★ v29 ★★★
    // tokens.user_id = 카페24가 발급하는 영구 회원 식별자.
    // 예: 카카오 → 3677479709@k, 네이버 → 20988042@n, 자사몰 → marru212121 등
    // 결제 webhook order.member_id와 동일 형식 보장.
    const memberId = tokens.user_id;

    if (!memberId) {
      console.error('[auth/cafe24/callback] no user_id in tokens');
      return redirectToApp(res, '/?auth_error=no_member_id');
    }

    console.log('[auth/cafe24/callback] member resolved (v29):', memberId);

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
