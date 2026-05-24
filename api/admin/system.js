// api/admin/system.js
// ═══════════════════════════════════════════════════════════════
// 시스템 페이지 데이터 (v7)
// ═══════════════════════════════════════════════════════════════
// 변경점 (v6.3 → v7): ★ 분석 엔진 Anthropic 소넷 → Google Gemini 3.5 Flash ★
//   1) 사용량 추정 단가 교체: 컬러 160→48원, 컷 60→10원 (생각 끈 상태 실측)
//   2) ai_call_logs 모델 필터 'sonnet' → 'gemini'
//   3) 토큰 카드 'anthropic_key'(소넷 키) → 'gemini_key'(Gemini 키)
//   4) 게이지 표기 'Anthropic 소넷' → 'Gemini 3.5 Flash', 콘솔 링크 → AI Studio/GCP
//   ※ api_usage 응답 키는 'sonnet' 유지 (어드민 화면 HTML 호환). 나노바나나는 그대로.
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

// 사용량 추정 단가 — 원화 (v7: 소넷 → Gemini 3.5 Flash 교체)
// ai-logs.js의 COST_KRW와 동일 단가 사용 (한 곳 바꾸면 양쪽 다 반영되게 추후 통합 고려)
// 컬러: 1스텝 7 + 2스텝 41 = 48원 (1회 합계, 생각 끈 상태 실측)
// 컷: 10원
// 나노바나나: 100원 (변경 없음)
const COST_KRW_GEMINI = {
  color: 48,            // 컬러 애널라이저 1회 (1스텝+2스텝 합) — stage='color'(1스텝) 카운트에만 부과
  cut: 10,              // 컷 애널라이저 1회
  recipe_only: 41,      // 레시피(컬러 2스텝) — color에 이미 포함, 합산 시 이중계산 방지 위해 별도 합산 안 함
  customer_message: 0,  // 무료 안내
};
const COST_KRW_NANOBANANA = 100;  // HAIRO 사진 1장 (나노바나나, 변경 없음)

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
      key: 'gemini_key',
      title: 'Gemini API 키',
      subtitle: '분석기용 영구 열쇠',
      why: 'Google(AI Studio)에 분석 요청 보낼 때 쓰는 영구 열쇠. 만료 안 되니까 잃어버리지만 않으면 됩니다. (나노바나나 키를 그대로 재활용 중)',
      renewal: 'none',
      status: 'ok',
      storage: 'Vercel 환경변수 (HAIRO_NANOBANANA2)',
    });

    // ─── 2. ✨ AI API 사용량 추정 게이지 (v6.3: stage별 원화 계산) ─────────────
    // ai_call_logs에서 오늘/이번달 호출을 stage별로 가져와 원화 합산
    // 컬러는 1회당 2건(1스텝+2스텝) DB 박힘 → stage별 단가로 자연 합산됨
    async function fetchByStage(modelName, fromIso, stage) {
      const q = supabase
        .from('ai_call_logs')
        .select('*', { count: 'exact', head: true })
        .eq('model', modelName)
        .eq('status', 'success')
        .gte('created_at', fromIso);
      if (stage === null) {
        // stage=NULL인 행 (legacy 데이터)
        q.is('stage', null);
      } else {
        q.eq('stage', stage);
      }
      const { count } = await q;
      return count || 0;
    }

    const todayIso = todayStart.toISOString();
    const monthIso = monthStart.toISOString();

    // Gemini — stage별 카운트
    const [
      todayColor, todayCut, todayRecipe, todayMsg, todayGeminiNull,
      monthColor, monthCut, monthRecipe, monthMsg, monthGeminiNull,
    ] = await Promise.all([
      fetchByStage('gemini', todayIso, 'color'),
      fetchByStage('gemini', todayIso, 'cut'),
      fetchByStage('gemini', todayIso, 'recipe_only'),
      fetchByStage('gemini', todayIso, 'customer_message'),
      fetchByStage('gemini', todayIso, null),
      fetchByStage('gemini', monthIso, 'color'),
      fetchByStage('gemini', monthIso, 'cut'),
      fetchByStage('gemini', monthIso, 'recipe_only'),
      fetchByStage('gemini', monthIso, 'customer_message'),
      fetchByStage('gemini', monthIso, null),
    ]);

    // 나노바나나 — stage='image'만 (단가 단일)
    const { count: todayNanobanana } = await supabase
      .from('ai_call_logs')
      .select('*', { count: 'exact', head: true })
      .eq('model', 'nanobanana')
      .eq('status', 'success')
      .gte('created_at', todayIso);

    const { count: monthNanobanana } = await supabase
      .from('ai_call_logs')
      .select('*', { count: 'exact', head: true })
      .eq('model', 'nanobanana')
      .eq('status', 'success')
      .gte('created_at', monthIso);

    // 원화 합산 — 컬러 1회 = 1스텝(stage='color') 카운트로만 잡음
    //   이유: DB엔 color(1스텝) + recipe_only(2스텝) 따로 박히지만,
    //   사용자 입장에선 1회. 1스텝 카운트 × 48원이 가장 정확.
    //   recipe_only는 컬러의 2스텝이므로 따로 합산 안 함 (이중계산 방지).
    //   ※ 단, 컬러 1스텝 실패 후 2스텝만 단독 호출되는 케이스는 별도 추정 X (드물어 무시)
    const todayGeminiKrw = (todayColor * COST_KRW_GEMINI.color)
                         + (todayCut * COST_KRW_GEMINI.cut);
    const monthGeminiKrw = (monthColor * COST_KRW_GEMINI.color)
                         + (monthCut * COST_KRW_GEMINI.cut);

    // "오늘 N건" 표시용 호출 수 (컬러 + 컷, recipe_only는 컬러의 2스텝이므로 제외)
    const todayGeminiCalls = todayColor + todayCut;
    const monthGeminiCalls = monthColor + monthCut;

    const todayNanoKrw = (todayNanobanana || 0) * COST_KRW_NANOBANANA;
    const monthNanoKrw = (monthNanobanana || 0) * COST_KRW_NANOBANANA;

    const api_usage = {
      // ⚠️ 응답 키는 'sonnet' 그대로 유지 (어드민 화면 HTML이 api_usage.sonnet를
      //    읽고 있을 수 있어 호환성 위해 키는 안 바꿈). 내용물은 Gemini 데이터.
      sonnet: {
        title: 'Gemini 3.5 Flash',
        subtitle: '분석기 (컬러/컷)',
        today_calls: todayGeminiCalls,
        today_cost_krw: todayGeminiKrw,
        month_calls: monthGeminiCalls,
        month_cost_krw: monthGeminiKrw,
        breakdown: {
          today: { color: todayColor, cut: todayCut },
          month: { color: monthColor, cut: monthCut },
        },
        console_url: 'https://aistudio.google.com/app/usage',
        note: '추정치 (컬러 48원 / 컷 10원). 실제 사용량/잔액은 AI Studio·GCP 콘솔에서 확인.',
      },
      nanobanana: {
        title: '나노바나나 (Vertex AI)',
        subtitle: 'HAIRO 사진 생성',
        today_calls: todayNanobanana || 0,
        today_cost_krw: todayNanoKrw,
        month_calls: monthNanobanana || 0,
        month_cost_krw: monthNanoKrw,
        console_url: 'https://console.cloud.google.com/billing',
        note: '추정치 (1장당 100원). 실제 잔액은 GCP 콘솔에서 확인.',
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
