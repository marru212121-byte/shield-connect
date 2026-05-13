// api/cron/keepalive.js
// ═══════════════════════════════════════════════════════════════
// 카페24 access token 자동 갱신 cron
// ═══════════════════════════════════════════════════════════════
// vercel.json 에서 5분마다 호출됨
// 토큰이 만료까지 30분 미만일 때만 refresh token 으로 새로 발급받음
// 그 외에는 그냥 통과 (카페24 API 부담 줄이기 위해)
// ═══════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js';

// 만료까지 이 시간(분) 미만이면 갱신
const REFRESH_THRESHOLD_MIN = 30;

export default async function handler(req, res) {
  // ─── 1. Vercel cron 인증 ──────────────────────────────────
  // Vercel cron은 Authorization: Bearer <CRON_SECRET> 헤더로 호출됨
  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ ok: false, reason: 'unauthorized' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  const startTime = Date.now();

  try {
    // ─── 2. 현재 OAuth 토큰 조회 ───────────────────────────
    const { data: oauth, error: fetchErr } = await supabase
      .from('cafe24_oauth')
      .select('*')
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    if (!oauth) {
      console.log('[keepalive] cafe24_oauth 행이 없습니다. 앱이 아직 설치되지 않았어요.');
      return res.status(200).json({
        ok: false,
        reason: 'no_oauth_row',
        message: '카페24 OAuth가 아직 설치되지 않았습니다.',
      });
    }

    const now = Date.now();
    const accessExpiresAt = new Date(oauth.access_token_expires_at).getTime();
    const refreshExpiresAt = new Date(oauth.refresh_token_expires_at).getTime();
    const minutesLeft = Math.round((accessExpiresAt - now) / 60000);
    const daysLeftRefresh = Math.floor((refreshExpiresAt - now) / 86400000);

    console.log(`[keepalive] access 토큰 ${minutesLeft}분 남음, refresh 토큰 ${daysLeftRefresh}일 남음`);

    // ─── 3. 갱신 필요한지 판단 ───────────────────────────
    if (minutesLeft > REFRESH_THRESHOLD_MIN) {
      console.log(`[keepalive] 토큰 ${minutesLeft}분 남음 → 갱신 불필요, 통과`);
      return res.status(200).json({
        ok: true,
        action: 'skip',
        access_minutes_left: minutesLeft,
        refresh_days_left: daysLeftRefresh,
        message: `토큰 ${minutesLeft}분 남음. 갱신 불필요.`,
      });
    }

    // ─── 4. refresh token 살아있는지 확인 ──────────────
    if (refreshExpiresAt < now) {
      console.error('[keepalive] refresh token 만료! 카페24 개발자센터에서 앱 재인증 필요');
      return res.status(500).json({
        ok: false,
        reason: 'refresh_token_expired',
        message: '재발급 열쇠가 만료되었습니다. 카페24 개발자센터에서 앱을 다시 인증해야 합니다.',
      });
    }

    // ─── 5. 카페24에 토큰 갱신 요청 ─────────────────────
    const mallId = oauth.mall_id || process.env.CAFE24_MALL_ID || 'marru2121';
    const clientId = process.env.CAFE24_CLIENT_ID;
    const clientSecret = process.env.CAFE24_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('[keepalive] CAFE24_CLIENT_ID 또는 CAFE24_CLIENT_SECRET 환경변수가 없습니다');
      return res.status(500).json({
        ok: false,
        reason: 'missing_env',
        message: 'Vercel 환경변수에 CAFE24_CLIENT_ID, CAFE24_CLIENT_SECRET 설정 필요',
      });
    }

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const tokenRes = await fetch(`https://${mallId}.cafe24api.com/api/v2/oauth/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: oauth.refresh_token,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('[keepalive] 카페24 토큰 갱신 실패:', tokenRes.status, tokenData);
      return res.status(500).json({
        ok: false,
        reason: 'refresh_failed',
        http_status: tokenRes.status,
        details: tokenData,
        message: '카페24 토큰 갱신 요청이 실패했습니다.',
      });
    }

    // ─── 6. Supabase 에 새 토큰 저장 ─────────────────────
    // 카페24 응답 형식:
    //   access_token, expires_at (ISO),
    //   refresh_token, refresh_token_expires_at (ISO)
    const newAccessExpiresAt = tokenData.expires_at
      ? new Date(tokenData.expires_at).toISOString()
      : new Date(Date.now() + (tokenData.expires_in || 7200) * 1000).toISOString();

    const newRefreshExpiresAt = tokenData.refresh_token_expires_at
      ? new Date(tokenData.refresh_token_expires_at).toISOString()
      : oauth.refresh_token_expires_at;

    const updateFields = {
      access_token: tokenData.access_token,
      access_token_expires_at: newAccessExpiresAt,
      updated_at: new Date().toISOString(),
    };

    // refresh token 도 회전되면 같이 업데이트
    if (tokenData.refresh_token) {
      updateFields.refresh_token = tokenData.refresh_token;
      updateFields.refresh_token_expires_at = newRefreshExpiresAt;
    }

    const { error: updateErr } = await supabase
      .from('cafe24_oauth')
      .update(updateFields)
      .eq('mall_id', oauth.mall_id);

    if (updateErr) throw updateErr;

    const elapsedMs = Date.now() - startTime;
    console.log(`[keepalive] 토큰 갱신 성공. 다음 만료: ${newAccessExpiresAt} (${elapsedMs}ms)`);

    return res.status(200).json({
      ok: true,
      action: 'refreshed',
      old_minutes_left: minutesLeft,
      new_access_expires_at: newAccessExpiresAt,
      new_refresh_expires_at: newRefreshExpiresAt,
      elapsed_ms: elapsedMs,
      message: '카페24 access token 갱신 완료',
    });

  } catch (err) {
    console.error('[keepalive] error:', err);
    return res.status(500).json({
      ok: false,
      reason: 'server_error',
      message: err.message,
    });
  }
}
