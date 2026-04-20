// api/auth/kakao/callback.js
// GET /api/auth/kakao/callback?code=xxx&state=xxx
// 1) state CSRF 검증
// 2) code → access_token 교환
// 3) 카카오 사용자 정보 조회
// 4) users 테이블 upsert (트리거로 user_balance 자동 생성됨)
// 5) 세션 쿠키 발급 후 홈으로 리다이렉트

import { exchangeCodeForToken, fetchUserInfo, extractUserFields } from '../../../lib/kakao.js';
import { supabase } from '../../../lib/supabase.js';
import {
  createSessionToken,
  setSessionCookie,
  getTempCookie,
  clearTempCookie
} from '../../../lib/session.js';

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

export default async function handler(req, res) {
  const { code, state, error } = req.query || {};

  if (error) return redirect(res, `/?login_error=${encodeURIComponent(error)}`);
  if (!code) return redirect(res, '/?login_error=no_code');

  // 1) state CSRF 검증
  const savedState = getTempCookie(req, 'kakao_oauth_state');
  if (!savedState || savedState !== state) {
    return redirect(res, '/?login_error=invalid_state');
  }
  clearTempCookie(res, 'kakao_oauth_state');

  try {
    // 2) 코드 → 토큰 교환
    const tokenResponse = await exchangeCodeForToken(code);
    const accessToken = tokenResponse.access_token;
    if (!accessToken) throw new Error('access_token 응답 없음');

    // 3) 사용자 정보 조회
    const kakaoUser = await fetchUserInfo(accessToken);
    const fields = extractUserFields(kakaoUser);
    if (!fields.kakao_id) throw new Error('kakao_id 응답 없음');

    // 4) users upsert
    const { data: user, error: uerr } = await supabase
      .from('users')
      .upsert(
        {
          kakao_id: fields.kakao_id,
          nickname: fields.nickname,
          email: fields.email,
          profile_image_url: fields.profile_image_url
        },
        { onConflict: 'kakao_id' }
      )
      .select()
      .single();

    if (uerr) {
      console.error('[kakao/callback] users upsert 실패:', uerr);
      return redirect(res, '/?login_error=db_error');
    }

    // 5) 세션 쿠키 발급
    const sessionToken = createSessionToken(user.id);
    setSessionCookie(res, sessionToken);

    // 홈으로 돌려보냄 (프론트가 /api/users/me 호출해서 상태 로드)
    return redirect(res, '/');
  } catch (err) {
    console.error('[kakao/callback] 에러:', err);
    return redirect(res, `/?login_error=${encodeURIComponent(err.message)}`);
  }
}
