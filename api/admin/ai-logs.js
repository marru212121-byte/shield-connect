// api/admin/ai-logs.js
// ═══════════════════════════════════════════════════════════════
// AI 사용 페이지 데이터 (v4)
// ═══════════════════════════════════════════════════════════════
// 변경점 (v3 → v4): ★ 분석 엔진 소넷 → Gemini 3.5 Flash ★
//   1) 단가 교체: 컬러 1스텝 140→7, 2스텝 20→41 (합 160→48), 컷 60→10
//   2) classifyStage / 통계·비용 합산: model 'sonnet' → 'gemini' (legacy 'sonnet'도 같이 인식)
//   3) MODEL_LABELS에 'gemini' 추가, 'success_gemini'/'gemini_key_invalid' 라벨 추가
//   ※ today_stats / today_breakdown 응답 키('sonnet','anthropic')는 유지 (어드민 HTML 호환)
// ═══════════════════════════════════════════════════════════════
// 변경점 (v2 → v3):
//   1) stage별 분해 추가 (컬러 1스텝/2스텝/컷/HAIRO 사진)
//      → 어드민에서 "오늘 총 추정 비용" 클릭하면 분해 표시
//   2) rate_limited / quota_exceeded / overloaded 라벨 추가
//      → 어제 결정: 사용자 몰림(🟡 busy) vs 진짜 한도(🔴 rate_limited) 명확 분리
//   3) 가입 경로 (provider) 자동 판별
//   4) Anthropic/Google 분리 합산 (총 비용 분해용)
//   5) 단가는 사장님 어림잡은 값으로:
//      - 컬러 1스텝 ₩130 (어림 ~₩160 중 큰 호출)
//      - 컬러 2스텝 ₩20 (어림 ~₩160 중 작은 호출, 합 1+2 = ₩150)
//      - 컷 분석 ₩60
//      - HAIRO 사진 ₩100
//      - 사장님이 최종적으로 컬러 1회(1+2) ₩160로 정함
// GET /api/admin/ai-logs?limit=50
// ═══════════════════════════════════════════════════════════════

import { requireAdmin } from '../../lib/admin-auth.js';
import { getSupabase } from '../../lib/supabase.js';

// ─── 단가 (Gemini 3.5 Flash 실측 기준, 한화) ───────────────────
// 생각 끈 상태(thinkingBudget:0) 실측: 컬러 1스텝 7 + 2스텝 41 = 48원
const COST_KRW = {
  // 분석 엔진 (Gemini 3.5 Flash)
  color_step1: 7,     // 컬러 분석 1스텝 (색감 분석)
  color_step2: 41,    // 컬러 분석 2스텝 (레시피, 출력 토큰 큼)
  color_total: 48,    // 컬러 1회 (1+2)
  cut: 10,            // 컷 분석
  // Google 나노바나나 (변경 없음)
  hairo: 100,         // HAIRO 사진 1장
};

// 가입 경로 판별
function getProvider(memberId) {
  if (!memberId) return 'unknown';
  if (memberId.endsWith('@k')) return 'kakao';
  if (memberId.endsWith('@n')) return 'naver';
  return 'cafe24';
}

// stage → 분류 (어드민이 식별할 메뉴 카테고리)
// recipe.js에서 보내는 stage 값: 'color', 'cut', 'recipe_only', 'customer_message'
// generate-image.js에서 보내는 stage 값: 'image'
// 분석 모델: 신규 'gemini' + 기존 DB에 남은 'sonnet'(legacy) 둘 다 분석 엔진으로 취급
function classifyStage(stage, model) {
  if (model === 'nanobanana') return 'hairo';
  if (model === 'gemini' || model === 'sonnet') {
    if (stage === 'recipe_only') return 'color_step2';  // 컬러 Step 2 (레시피)
    if (stage === 'color') return 'color_step1';        // 컬러 Step 1 (색감)
    if (stage === 'cut') return 'cut';                  // 컷 분석
    if (stage === 'customer_message') return 'customer_message'; // 무료 안내
    return 'unknown';
  }
  return 'unknown';
}

// 분석 엔진 판별 (신규 gemini + 기존 legacy sonnet)
function isAnalysisModel(model) {
  return model === 'gemini' || model === 'sonnet';
}

// ─── 회원이 본 마케팅 언어 (회원 안내 문구 사전) ──────────────
const USER_MESSAGE_CATALOG = [
  { http: 401, code: 'not_authenticated',     message: '로그인이 필요해요. 또는 로그인이 만료되었어요. 다시 로그인 해주세요.', when: '세션 무효/만료' },
  { http: 402, code: 'insufficient_credits',  message: '크레딧이 부족해요. 충전 후 이용해주세요.', when: '잔액 0 또는 부족' },
  { http: 422, code: 'content_blocked',       message: '제한된 콘텐츠로 분류됐어요. 다른 사진/프롬프트로 시도해주세요. 크레딧은 차감되지 않았습니다.', when: 'HAIRO 안전필터' },
  { http: 503, code: 'busy',                  message: '지금 많은 분이 사용 중이에요. 30초 후 다시 시도해주세요.', when: 'AI API 실패 (자동 환불)' },
  { http: 400, code: 'too_many_references',   message: '참조 사진은 최대 N장까지 첨부할 수 있어요.', when: 'HAIRO 참조 6장 이상' },
  { http: 400, code: 'reference_too_large',   message: '사진이 너무 커요 (10MB 이하로 줄여주세요).', when: 'HAIRO 큰 파일' },
  { http: 400, code: 'missing_required_fields', message: '프롬프트를 입력해주세요.', when: 'HAIRO 빈 프롬프트' },
  { http: 500, code: 'server_error',          message: '일시적인 오류가 발생했어요. 잠시 후 다시 시도해주세요.', when: '내부 오류' },
];

// ─── 사장님이 보는 디버깅 언어 (실제 원인 → 한국어) ───────────
// 각 항목에 한글 라벨 + 진짜 원인 한 문장 (어드민에서 클릭 시 펼침)
const INTERNAL_REASON_LABELS = {
  // 성공
  'success_vertex_seoul':   { label: '서울 리전 성공', icon: '🟢', detail: '나노바나나 서울 리전에서 정상 응답. 가장 빠른 경로.' },
  'success_vertex_global':  { label: '글로벌 리전 성공', icon: '🟢', detail: '서울 리전 실패 후 글로벌로 폴백 성공.' },
  'success_legacy':         { label: 'Legacy 폴백 성공', icon: '🟢', detail: 'Vertex 실패 후 Generative Language API로 성공.' },
  'success_nanobanana':     { label: '나노바나나 성공', icon: '🟢', detail: 'HAIRO 사진 생성 성공.' },
  'success_sonnet':         { label: '소넷 분석 성공', icon: '🟢', detail: 'Claude Sonnet 분석 성공. (구 엔진 기록)' },
  'success_gemini':         { label: 'Gemini 분석 성공', icon: '🟢', detail: 'Gemini 3.5 Flash 분석 성공.' },
  'success':                { label: '성공', icon: '🟢', detail: '정상 처리됨.' },

  // 정상 거절 (회원 책임) — 🟢 자연 해소
  'insufficient_credits':   { label: '크레딧 부족', icon: '🟢', detail: '회원 크레딧이 0이 되어 차단됨. 충전 유도 정상 작동 = 사장님 조치 불필요.' },
  'safety_block':           { label: '안전 필터 차단', icon: '🟢', detail: '나노바나나가 사진/프롬프트를 부적절로 판단. 크레딧 자동 환불됨. 사장님 조치 불필요.' },
  'content_blocked':        { label: '안전 필터 차단', icon: '🟢', detail: '나노바나나가 사진/프롬프트를 부적절로 판단. 크레딧 자동 환불됨. 사장님 조치 불필요.' },
  'invalid_input':          { label: '입력값 오류', icon: '🟢', detail: '회원이 빈 프롬프트, 너무 큰 사진 등 잘못된 입력. 정상 거절.' },

  // 🟡 주의 — 패턴 확인 필요 (일시적, 5분 후 자연 해소 가능)
  'busy':                   { label: '사용자가 몰리고 있어요', icon: '🟡', detail: '일시적 트래픽 폭주. 모든 fallback이 실패한 순간. 5분 후 자연 해소. 자주 뜨면 패턴 확인.' },
  'upstream_busy':          { label: 'AI 서버 일시 과부하', icon: '🟡', detail: 'Anthropic/Vertex 서버 일시 과부하. 자동 환불됨. 5분 후 풀림.' },
  'timeout':                { label: '응답 지연', icon: '🟡', detail: 'API가 30초 안에 답을 못 줌. 가끔이면 무시. 연속이면 Anthropic/GCP 콘솔 상태 확인.' },
  'all_fallbacks_failed':   { label: '서울→글로벌→Legacy 모두 실패', icon: '🟡', detail: '나노바나나 3단 안전망 모두 실패. 자동 환불됨. GCP 콘솔 확인 필요.' },
  'partial_failure':        { label: '일부 라우트 실패', icon: '🟡', detail: '서울 또는 글로벌 일시 장애. 자동 fallback으로 응답은 됐음.' },

  // 🔴 긴급 — 즉시 대응 (사장님 액션 필요)
  // ai-log-helper.js v1.1이 실제 INSERT하는 키 이름들 (real_rate_limit, api_quota_exceeded)
  'real_rate_limit':        { label: '분당 사용자 한도 초과 (티어 한계)', icon: '🔴', detail: 'Anthropic/Vertex 티어의 분당 요청 수를 넘김. 영상 후 바이럴 시 첫날 발생 가능. 콘솔에서 티어 업그레이드 필요.' },
  'rate_limited':           { label: '분당 사용자 한도 초과 (티어 한계)', icon: '🔴', detail: 'Anthropic/Vertex 티어의 분당 요청 수를 넘김. 콘솔에서 티어 업그레이드 필요.' },
  'api_quota_exceeded':     { label: '일일 한도 소진 (콘솔 충전 필요)', icon: '🔴', detail: '오늘 할당된 API 한도를 다 씀 또는 잔액 부족. 모든 디자이너 차단됨. 콘솔 충전 또는 내일 자동 리셋 대기.' },
  'quota_exceeded':         { label: '일일 한도 소진 (콘솔 충전 필요)', icon: '🔴', detail: '오늘 할당된 API 한도를 다 씀. 모든 디자이너 차단됨. 콘솔 충전 또는 내일 자동 리셋 대기.' },
  'overloaded':             { label: 'API 서버 과부하 (529)', icon: '🔴', detail: 'Anthropic 전체 서버 과부하. 자주 뜨면 콘솔 상태 확인.' },
  'anthropic_key_invalid':  { label: 'API 키 만료/잔액 부족', icon: '🔴', detail: '분석 API 키가 만료됐거나 잔액이 다 떨어짐. Vercel 환경변수 확인 + 콘솔에서 결제 정보 점검.' },
  'gemini_key_invalid':     { label: 'Gemini 키 만료/잔액 부족', icon: '🔴', detail: 'Gemini API 키가 만료됐거나 결제·할당 한도 소진. Vercel GEMINI_API_KEY 확인 + AI Studio/GCP 결제 점검.' },
  'auth_failed':            { label: 'API 키 인증 실패', icon: '🔴', detail: 'Anthropic/Vertex 키 만료/오류. Vercel 환경변수 확인 필요. 서비스 전체 마비 상태.' },
  'vertex_auth_failed':     { label: 'Vertex(나노바나나) 인증 만료', icon: '🔴', detail: 'GCP 서비스 계정 인증 실패. 서비스 계정 갱신 필요.' },
  'supabase_down':          { label: '슈파베이스 연결 끊김', icon: '🔴', detail: '슈파베이스 일시 다운. 슈파베이스 상태 페이지 확인.' },

  // 분류 불가
  'unknown_error':          { label: '미분류 에러', icon: '🔴', detail: '처음 보는 에러. Vercel 로그에서 raw_error 확인 필요. 새 패턴이면 분류 추가 필요.' },
};

const ROUTE_LABELS = {
  'vertex-seoul':  '서울',
  'vertex-global': '글로벌',
  'legacy':        'Legacy',
};

const MODEL_LABELS = {
  nanobanana: '나노바나나',
  gemini: 'Gemini',
  sonnet: '소넷(구)',
};

const STAGE_LABELS = {
  color:            '컬러 분석',
  color_step1:      '컬러 분석 1스텝 (색감)',
  color_step2:      '컬러 분석 2스텝 (레시피)',
  recipe_only:      '컬러 분석 2스텝 (레시피)',
  cut:              '컷 분석',
  recipe:           '레시피',
  image:            'HAIRO 사진',
  customer_message: '고객 안내 (무료)',
  hairo:            'HAIRO 사진',
};

// 단가 추정 (호출 1건당, 한화)
function estimateCostKrw(log) {
  const cat = classifyStage(log.stage, log.model);
  if (cat === 'color_step1') return COST_KRW.color_step1;
  if (cat === 'color_step2') return COST_KRW.color_step2;
  if (cat === 'cut') return COST_KRW.cut;
  if (cat === 'hairo') return COST_KRW.hairo;
  return 0; // customer_message 등 무료
}

function describeLog(log) {
  const model = MODEL_LABELS[log.model] || log.model;
  const route = ROUTE_LABELS[log.route] || (log.route || '');
  const stageKey = log.stage || '';
  const stage = STAGE_LABELS[stageKey] || stageKey;
  const reason = INTERNAL_REASON_LABELS[log.internal_reason] ||
                 { label: log.internal_reason || log.status, icon: '·', detail: '' };
  const provider = getProvider(log.member_id);

  // 한 줄 요약
  let summary;
  if (log.status === 'success') {
    summary = `${stage || model} 성공${log.duration_ms ? ` · ${(log.duration_ms / 1000).toFixed(1)}초` : ''}`;
  } else {
    summary = `${stage || model} 실패 · ${reason.label}`;
  }

  return {
    summary,
    model_ko: model,
    route_ko: route,
    stage_ko: stage,
    reason_ko: reason.label,
    reason_icon: reason.icon,
    reason_detail: reason.detail,
    provider,
    cost_krw_estimate: log.status === 'success' ? estimateCostKrw(log) : 0,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ code: 'method_not_allowed' });
  }
  if (!requireAdmin(req, res)) return;

  res.setHeader('Cache-Control', 'no-store');

  const supabase = getSupabase();
  const limit = Math.min(parseInt(req.query?.limit || '50', 10), 200);
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const dayAgo = new Date(now.getTime() - 86400000).toISOString();

  try {
    // ─── 1. 오늘 호출 (stage별 분해) ────────────────────────
    const { data: todayCalls } = await supabase
      .from('ai_call_logs')
      .select('model, status, route, alert_level, stage')
      .gte('created_at', todayStart.toISOString());

    // model별 + stage별 카운트
    const todayBreakdown = {
      anthropic: {
        color_step1: { calls: 0, success: 0, cost: 0 },
        color_step2: { calls: 0, success: 0, cost: 0 },
        cut:         { calls: 0, success: 0, cost: 0 },
        total_cost:  0,
      },
      google: {
        hairo: { calls: 0, success: 0, cost: 0 },
        total_cost: 0,
      },
      total_cost_krw: 0,
    };

    const alertCounts = { critical: 0, warning: 0, info: 0 };
    const todayStats = {
      nanobanana: { total: 0, success: 0, safety_block: 0, error: 0 },
      sonnet:     { total: 0, success: 0, rate_limit: 0, error: 0 },
    };

    for (const c of todayCalls || []) {
      const m = c.model;
      const cat = classifyStage(c.stage, m);
      // 분석 엔진(gemini/legacy sonnet)은 기존 'sonnet' 통계 버킷으로 합산 (어드민 HTML 호환)
      const statKey = isAnalysisModel(m) ? 'sonnet' : m;

      if (todayStats[statKey]) {
        todayStats[statKey].total++;
        if (c.status === 'success') todayStats[statKey].success++;
        else if (c.status === 'safety_block') todayStats[statKey].safety_block = (todayStats[statKey].safety_block || 0) + 1;
        else if (c.status === 'rate_limit') todayStats[statKey].rate_limit = (todayStats[statKey].rate_limit || 0) + 1;
        else todayStats[statKey].error++;
      }

      // stage별 분해 (성공만 비용 계산) — breakdown.anthropic 키는 유지(HTML 호환), 내용은 Gemini
      if (c.status === 'success') {
        const cost = estimateCostKrw({ stage: c.stage, model: c.model, status: 'success' });
        if (isAnalysisModel(m) && todayBreakdown.anthropic[cat]) {
          todayBreakdown.anthropic[cat].calls++;
          todayBreakdown.anthropic[cat].success++;
          todayBreakdown.anthropic[cat].cost += cost;
          todayBreakdown.anthropic.total_cost += cost;
          todayBreakdown.total_cost_krw += cost;
        } else if (m === 'nanobanana' && cat === 'hairo') {
          todayBreakdown.google.hairo.calls++;
          todayBreakdown.google.hairo.success++;
          todayBreakdown.google.hairo.cost += cost;
          todayBreakdown.google.total_cost += cost;
          todayBreakdown.total_cost_krw += cost;
        }
      } else {
        // 실패도 카운트는 함 (성공 횟수만 비용 계산)
        if (isAnalysisModel(m) && todayBreakdown.anthropic[cat]) {
          todayBreakdown.anthropic[cat].calls++;
        } else if (m === 'nanobanana' && cat === 'hairo') {
          todayBreakdown.google.hairo.calls++;
        }
      }

      if (c.alert_level && alertCounts[c.alert_level] != null) {
        alertCounts[c.alert_level]++;
      }
    }

    // ─── 2. 24h 라우트 분포 (나노바나나만) ─────────────────
    const { data: dayCalls } = await supabase
      .from('ai_call_logs')
      .select('route, status')
      .eq('model', 'nanobanana')
      .gte('created_at', dayAgo);

    const routeDist = { seoul: 0, global: 0, legacy: 0, total: 0 };
    for (const c of dayCalls || []) {
      if (c.status !== 'success') continue;
      routeDist.total++;
      if (c.route === 'vertex-seoul') routeDist.seoul++;
      else if (c.route === 'vertex-global') routeDist.global++;
      else if (c.route === 'legacy') routeDist.legacy++;
    }

    // ─── 3. 최근 호출 로그 (한글 분리) ─────────────────
    const { data: recentLogs } = await supabase
      .from('ai_call_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    const translatedLogs = (recentLogs || []).map(log => ({
      ...log,
      _ko: describeLog(log),
    }));

    return res.status(200).json({
      today_stats: todayStats,
      today_breakdown: todayBreakdown,
      alert_counts: alertCounts,
      route_distribution: routeDist,
      recent_logs: translatedLogs,
      user_message_catalog: USER_MESSAGE_CATALOG,
      cost_table_krw: COST_KRW,
    });
  } catch (err) {
    console.error('[admin/ai-logs] error:', err);
    return res.status(500).json({ code: 'server_error', message: err.message });
  }
}
