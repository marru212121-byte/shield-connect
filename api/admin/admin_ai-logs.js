// api/admin/ai-logs.js
// ═══════════════════════════════════════════════════════════════
// AI 사용 페이지 데이터 (v2)
// ═══════════════════════════════════════════════════════════════
// 변경점 (v1 → v2):
//   - 마케팅 언어(user_message) vs 디버깅 언어(internal_reason) 분리
//   - INTERNAL_REASON_LABELS 매핑 추가 (한국어)
//   - alert_level별 카운트 (오늘 긴급/주의/정상)
//   - 통일 에러 카탈로그 응답에 포함 (회원 안내 문구 사전)
// GET /api/admin/ai-logs?limit=50
// ═══════════════════════════════════════════════════════════════

import { requireAdmin } from '../../lib/admin-auth.js';
import { getSupabase } from '../../lib/supabase.js';

// ─── 회원이 본 마케팅 언어 (회원 안내 문구 사전) ──────────────
// 이관문서 부록 C의 통일 에러 그대로
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
const INTERNAL_REASON_LABELS = {
  // 성공
  'success_vertex_seoul':   { label: '서울 리전 성공', icon: '✅' },
  'success_vertex_global':  { label: '글로벌 리전 성공', icon: '✅' },
  'success_legacy':         { label: 'Legacy 폴백 성공', icon: '✅' },
  'success_nanobanana':     { label: '나노바나나 성공', icon: '✅' },
  'success_sonnet':         { label: '소넷 분석 성공', icon: '✅' },
  'success':                { label: '성공', icon: '✅' },

  // 정상 거절 (회원 책임)
  'insufficient_credits':   { label: '잔액 부족 (정상 거절)', icon: '🟢' },
  'safety_block':           { label: '안전필터 차단 (환불 완료)', icon: '🟢' },
  'invalid_input':          { label: '입력값 오류 (정상 거절)', icon: '🟢' },

  // 자연 해소 (걱정 X)
  'real_rate_limit':        { label: '분당 한도 초과 (자연 해소)', icon: '🟢' },
  'timeout':                { label: '응답 지연 (가끔 발생 정상)', icon: '🟢' },
  'upstream_busy':          { label: 'AI 서버 일시 과부하 (자동 환불)', icon: '🟢' },

  // 🟡 주의 — 패턴 확인 필요
  'all_fallbacks_failed':   { label: '서울→글로벌→Legacy 모두 실패', icon: '🟡' },
  'partial_failure':        { label: '일부 라우트 실패', icon: '🟡' },

  // 🔴 긴급 — 즉시 대응
  'anthropic_key_invalid':  { label: 'Anthropic 키 만료/잔액 부족', icon: '🔴' },
  'vertex_auth_failed':     { label: 'Vertex(나노바나나) 인증 만료', icon: '🔴' },
  'supabase_down':          { label: '슈파베이스 연결 끊김', icon: '🔴' },
  'api_quota_exceeded':     { label: 'API 일일 한도 초과', icon: '🔴' },

  // 분류 불가
  'unknown_error':          { label: '원인 불명 (버셀 로그 확인 필요)', icon: '⚠️' },
};

const ROUTE_LABELS = {
  'vertex-seoul':  '서울',
  'vertex-global': '글로벌',
  'legacy':        'Legacy',
};

const MODEL_LABELS = {
  nanobanana: '나노바나나',
  sonnet: '소넷',
};

const STAGE_LABELS = {
  color:  '컬러 분석',
  cut:    '컷 분석',
  recipe: '레시피',
  image:  'HAIRO 사진',
};

function describeLog(log) {
  const model = MODEL_LABELS[log.model] || log.model;
  const route = ROUTE_LABELS[log.route] || (log.route || '');
  const stage = STAGE_LABELS[log.stage] || log.stage || '';
  const reason = INTERNAL_REASON_LABELS[log.internal_reason] || { label: log.internal_reason || log.status, icon: '·' };

  // 한 줄 요약 (사장님이 알아볼 한국어)
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
    // ─── 1. 오늘 통계 ───────────────────────────────────────
    const { data: todayCalls } = await supabase
      .from('ai_call_logs')
      .select('model, status, route, alert_level')
      .gte('created_at', todayStart.toISOString());

    const todayStats = {
      nanobanana: { total: 0, success: 0, safety_block: 0, error: 0 },
      sonnet:     { total: 0, success: 0, rate_limit: 0, error: 0 },
    };
    const alertCounts = { critical: 0, warning: 0, info: 0 };

    for (const c of todayCalls || []) {
      const m = c.model;
      if (todayStats[m]) {
        todayStats[m].total++;
        if (c.status === 'success') todayStats[m].success++;
        else if (c.status === 'safety_block') todayStats[m].safety_block = (todayStats[m].safety_block || 0) + 1;
        else if (c.status === 'rate_limit') todayStats[m].rate_limit = (todayStats[m].rate_limit || 0) + 1;
        else todayStats[m].error++;
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

    // ─── 3. 최근 호출 로그 (마케팅/디버깅 분리) ─────────────
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
      alert_counts: alertCounts,
      route_distribution: routeDist,
      recent_logs: translatedLogs,

      // 사장님이 회원 화면을 예시로 보고 싶을 때 (접힌 카탈로그)
      user_message_catalog: USER_MESSAGE_CATALOG,
    });
  } catch (err) {
    console.error('[admin/ai-logs] error:', err);
    return res.status(500).json({ code: 'server_error', message: err.message });
  }
}
