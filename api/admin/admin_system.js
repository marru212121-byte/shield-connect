// api/admin/system.js
// ═══════════════════════════════════════════════════════════════
// 시스템 페이지 데이터 (v2)
// ═══════════════════════════════════════════════════════════════
// 변경점 (v1 → v2):
//   1) Anthropic / 나노바나나 "오늘 사용량 추정 게이지" 추가
//      → ai_call_logs 기반 추정 + 콘솔 바로가기 (실제 잔액 API는
//      외부 의존이라 콘솔 링크가 가장 안전)
//   2) keepalive cron 표기 '0 4 * * *' → '*/5 * * * *' (실제 5분 주기)
//   3) cron 마지막 작동 시각 추정 (cron 자체는 DB 기록 안 하므로 간접 신호)
// ═══════════════════════════════════════════════════════════════

import { requireAdmin } from '../../lib/admin-auth.js';
import { getSupabase } from '../../lib/supabase.js';

// 사용량 추정 단가 (변동 가능, 정확치는 콘솔에서)
// 보수적으로 잡았으니 실제보단 약간 높게 추정됨 (안전)
const COST_PER_SONNET_CALL = 0.08;       // USD, 평균 분석 1회
const COST_PER_NANOBANANA_CALL = 0.04;   // USD, 평균 사진 1회

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ code: 'method_not_allowed' });
  }
  if (!requireAdmin(req, res)) return;

  res.setHeader('Cache-Control', 'no-store');

  const supabase = getSupabase();
  const now = Date.now();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

  try {
    // ─── 1. 카페24 토큰 정보 ────────────────────────────────
    const { data: oauth } = await supabase
      .from('cafe24_oauth')
      .select('*')
      .maybeSingle();

    const tokens = [];

    if (oauth) {
      const refreshExpires = new Date(oauth.refresh_token_expires_at);
      const refreshDaysLeft = Math.floor((refreshExpires.getTime() - now) / 86400000);
      tokens.push({
        key: 'cafe24_refresh',
        title: '카페24 재발급 열쇠',
        subtitle: '결제 알림 받는 권한',
        why: '디자이너가 결제하면 카페24가 우리에게 알려주는데, 그 권한이 이 열쇠로 확인돼요. 만료되면 결제가 들어와도 크레딧 못 받아요.',
        renewal: 'manual',
        expires_at: oauth.refresh_token_expires_at,
        days_left: refreshDaysLeft,
        last_issued_at: oauth.issued_at,
        last_renewed_where: '카페24 개발자센터',
        status: refreshDaysLeft <= 14 ? 'danger' : refreshDaysLeft <= 60 ? 'warning' : 'ok',
      });

      const accessExpires = new Date(oauth.access_token_expires_at);
      const accessMinLeft = Math.floor((accessExpires.getTime() - now) / 60000);
      tokens.push({
        key: 'cafe24_access',
        title: '카페24 출입증',
        subtitle: '주문 조회용 임시 열쇠',
        why: '위 재발급 열쇠로 매번 새로 받는 짧은 출입증. 2시간마다 만료되지만 코드가 자동으로 새로 받아옵니다.',
        renewal: 'auto',
        expires_at: oauth.access_token_expires_at,
        minutes_left: accessMinLeft,
        last_renewed_at: oauth.updated_at,
        last_renewed_where: 'Vercel 함수',
        status: accessMinLeft > 0 ? 'ok' : 'warning',
      });
    } else {
      tokens.push({
        key: 'cafe24_refresh',
        title: '카페24 재발급 열쇠',
        subtitle: '미설치',
        renewal: 'manual',
        status: 'danger',
        message: '앱이 아직 설치되지 않았습니다.',
      });
    }

    tokens.push({
      key: 'vertex_access',
      title: '나노바나나 출입증',
      subtitle: '사진 생성용 임시 열쇠',
      why: 'Google 서버에서 사진 만들 권한. 1시간마다 만료되지만 코드가 자동으로 새로 받아옵니다.',
      renewal: 'auto',
      status: 'ok',
      note: '서버 메모리 캐시 (1시간)',
    });

    tokens.push({
      key: 'anthropic_key',
      title: '소넷 API 키',
      subtitle: '분석기용 영구 열쇠',
      why: 'Anthropic에 분석 요청 보낼 때 쓰는 영구 열쇠. 만료 안 되니까 잃어버리지만 않으면 됩니다.',
      renewal: 'none',
      status: 'ok',
      storage: 'Vercel 환경변수',
    });

    // ─── 2. ✨ AI API 사용량 추정 게이지 (NEW) ─────────────
    // ai_call_logs에서 오늘/이번달 호출 수를 가져와 추정 비용 계산
    // 정확치는 콘솔에서 확인하되, 폭주 감지 + 추세 보기엔 충분
    const { count: todaySonnet } = await supabase
      .from('ai_call_logs')
      .select('*', { count: 'exact', head: true })
      .eq('model', 'sonnet')
      .eq('status', 'success')
      .gte('created_at', todayStart.toISOString());

    const { count: todayNanobanana } = await supabase
      .from('ai_call_logs')
      .select('*', { count: 'exact', head: true })
      .eq('model', 'nanobanana')
      .eq('status', 'success')
      .gte('created_at', todayStart.toISOString());

    const { count: monthSonnet } = await supabase
      .from('ai_call_logs')
      .select('*', { count: 'exact', head: true })
      .eq('model', 'sonnet')
      .eq('status', 'success')
      .gte('created_at', monthStart.toISOString());

    const { count: monthNanobanana } = await supabase
      .from('ai_call_logs')
      .select('*', { count: 'exact', head: true })
      .eq('model', 'nanobanana')
      .eq('status', 'success')
      .gte('created_at', monthStart.toISOString());

    const api_usage = {
      sonnet: {
        title: 'Anthropic 소넷',
        subtitle: '분석기 (컬러/컷/레시피)',
        today_calls: todaySonnet || 0,
        today_cost_usd: Math.round((todaySonnet || 0) * COST_PER_SONNET_CALL * 100) / 100,
        month_calls: monthSonnet || 0,
        month_cost_usd: Math.round((monthSonnet || 0) * COST_PER_SONNET_CALL * 100) / 100,
        unit_cost_usd: COST_PER_SONNET_CALL,
        console_url: 'https://console.anthropic.com/settings/billing',
        note: '추정치 (1회당 약 $' + COST_PER_SONNET_CALL + '). 실제 잔액은 콘솔에서 확인.',
      },
      nanobanana: {
        title: '나노바나나 (Vertex AI)',
        subtitle: 'HAIRO 사진 생성',
        today_calls: todayNanobanana || 0,
        today_cost_usd: Math.round((todayNanobanana || 0) * COST_PER_NANOBANANA_CALL * 100) / 100,
        month_calls: monthNanobanana || 0,
        month_cost_usd: Math.round((monthNanobanana || 0) * COST_PER_NANOBANANA_CALL * 100) / 100,
        unit_cost_usd: COST_PER_NANOBANANA_CALL,
        console_url: 'https://console.cloud.google.com/billing',
        note: '추정치 (1회당 약 $' + COST_PER_NANOBANANA_CALL + '). 실제 잔액은 GCP 콘솔에서 확인.',
      },
    };

    // ─── 3. Supabase 저장공간 ───────────────────────────────
    const { count: galleryCount } = await supabase
      .from('hairo_gallery')
      .select('*', { count: 'exact', head: true });

    const estimatedMB = Math.round(((galleryCount || 0) * 200) / 1024);
    const storage = {
      gallery_images: galleryCount || 0,
      estimated_mb: estimatedMB,
      limit_mb: 500,
      percent: Math.min(100, Math.round((estimatedMB / 500) * 100)),
      note: '추정치. 정확한 용량은 Supabase 대시보드 → Storage에서 확인.',
    };

    // ─── 4. 자동 알람 (cron) — 마지막 작동 간접 추정 ───────
    // cron 자체는 DB에 기록 안 함. 간접 신호:
    //   - keepalive: cafe24_oauth.updated_at가 최근에 갱신됐는지
    //   - warm-image: (직접 신호 없음 → 정상 가정)
    let keepaliveLastRun = null;
    let keepaliveStatus = 'ok';
    if (oauth?.updated_at) {
      keepaliveLastRun = oauth.updated_at;
      const minSinceUpdate = (now - new Date(oauth.updated_at).getTime()) / 60000;
      // 5분 주기 cron인데 30분 이상 안 돌면 의심
      if (minSinceUpdate > 30) keepaliveStatus = 'warning';
      if (minSinceUpdate > 120) keepaliveStatus = 'danger';
    }

    const crons = [
      {
        key: 'keepalive',
        title: '5분마다 한 번',
        subtitle: '카페24 토큰 살아있는지 확인',
        schedule: '*/5 * * * *',
        status: keepaliveStatus,
        last_run: keepaliveLastRun,
        note: keepaliveLastRun
          ? '카페24 토큰 갱신 시각 기준 (간접 추정)'
          : '아직 갱신 기록 없음',
      },
      {
        key: 'warm-image',
        title: '5분마다 한 번',
        subtitle: '나노바나나 잠들지 않게 깨우기',
        schedule: '*/5 * * * *',
        status: 'ok',
        last_run: null,
        note: '직접 신호 없음 — 정상 가정 (확인 필요시 Vercel 로그)',
      },
    ];

    // ─── 5. 웹훅 시스템 ──────────────────────────────────
    const oneDayAgo = new Date(now - 86400000).toISOString();
    const { count: webhookCount24h } = await supabase
      .from('webhook_events')
      .select('*', { count: 'exact', head: true })
      .gte('processed_at', oneDayAgo);

    return res.status(200).json({
      tokens,
      api_usage,
      storage,
      crons,
      webhook_24h: webhookCount24h || 0,
    });
  } catch (err) {
    console.error('[admin/system] error:', err);
    return res.status(500).json({ code: 'server_error', message: err.message });
  }
}
