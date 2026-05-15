// lib/ai-log-helper.js
// ═══════════════════════════════════════════════════════════════
// AI 호출 로그 헬퍼 (v1.1)
// ═══════════════════════════════════════════════════════════════
// 역할:
//   1) 영어 에러를 internal_reason / alert_level로 분류
//   2) ai_call_logs 테이블에 INSERT (실패해도 본 흐름 안 깸)
// 사용처:
//   - api/recipe.js
//   - api/generate-image.js
//   - api/webhook/cafe24.js (선택)
//
// 변경점 (v1 → v1.1):
//   - alert_level 시안과 일치되게 정정 (어제 결정 사항):
//     · real_rate_limit: info → critical (분당 한도 = 티어 한계)
//     · timeout       : info → warning (가끔 발생 정상이지만 시야에 둠)
//     · upstream_busy : info → warning (5xx, 자연 해소)
//   - 신규 분류 추가 (status 코드 기반):
//     · 529 → overloaded (🔴 Anthropic 전체 서버 과부하)
//     · 402 → insufficient_credits (🟢 회원 책임, 정상 거절)
//     · 400 → invalid_input (🟢 회원 책임, 정상 거절)
//   - 함수 시그니처 v1과 100% 동일 → recipe.js / generate-image.js 안 건드림
// ═══════════════════════════════════════════════════════════════

import { getSupabase } from './supabase.js';

/**
 * 영어 에러 객체/메시지를 보고 내부 원인을 분류
 * @param {Error|object|string} err
 * @param {object} ctx — { allFallbacksFailed?: boolean, route?: string }
 * @returns {{ internal_reason: string, alert_level: 'critical'|'warning'|'info', error_code: string|null }}
 */
export function classifyError(err, ctx = {}) {
  const msg = String(err?.message || err || '').toLowerCase();
  const status = err?.status || err?.statusCode || null;
  const code = err?.code || null;

  // ─── 🔴 긴급 — 즉시 대응 필요 ─────────────────────────
  if (msg.includes('invalid_api_key') || msg.includes('invalid api key') ||
      msg.includes('authentication_error') ||
      (status === 401 && (msg.includes('anthropic') || msg.includes('claude')))) {
    return { internal_reason: 'anthropic_key_invalid', alert_level: 'critical', error_code: '401' };
  }
  if (msg.includes('credit_balance_too_low') || msg.includes('billing') ||
      msg.includes('insufficient_quota') || msg.includes('quota exceeded')) {
    return { internal_reason: 'api_quota_exceeded', alert_level: 'critical', error_code: 'quota' };
  }
  if (msg.includes('google_application_credentials') || msg.includes('service account') ||
      msg.includes('unable to refresh') || (msg.includes('jwt') && status === 401)) {
    return { internal_reason: 'vertex_auth_failed', alert_level: 'critical', error_code: 'auth' };
  }
  if (msg.includes('supabase') && (msg.includes('connection') || msg.includes('econnrefused'))) {
    return { internal_reason: 'supabase_down', alert_level: 'critical', error_code: 'db' };
  }

  // ─── 🔴 신규 (v1.1) ────────────────────────────────────
  // 529 = Anthropic 전체 서버 과부하 (status로 분리, 502/503/504와 구별)
  if (status === 529) {
    return { internal_reason: 'overloaded', alert_level: 'critical', error_code: '529' };
  }
  // 분당 한도 = 티어 한계 (어제 정정: info → critical)
  // 영상 후 바이럴 첫날 발생 가능 → 사장님이 무조건 봐야 함
  if (status === 429 || msg.includes('rate_limit') || msg.includes('too many requests') ||
      msg.includes('resource_exhausted')) {
    return { internal_reason: 'real_rate_limit', alert_level: 'critical', error_code: '429' };
  }

  // ─── 🟡 주의 — 패턴 확인 필요 ─────────────────────────
  if (ctx.allFallbacksFailed) {
    return { internal_reason: 'all_fallbacks_failed', alert_level: 'warning', error_code: String(status || 'fallback') };
  }

  // 🟡 (어제 정정: info → warning)
  if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT' || msg.includes('timeout')) {
    return { internal_reason: 'timeout', alert_level: 'warning', error_code: 'timeout' };
  }
  // 🟡 (어제 정정: info → warning) — 529는 위에서 이미 처리됨
  if (status === 502 || status === 503 || status === 504 ||
      msg.includes('service unavailable') ||
      (msg.includes('overloaded') && status !== 529)) {
    return { internal_reason: 'upstream_busy', alert_level: 'warning', error_code: String(status || '503') };
  }

  // ─── 🟢 정상 거절 — 회원 책임 ─────────────────────────
  if (status === 402 || msg.includes('insufficient_credits')) {
    return { internal_reason: 'insufficient_credits', alert_level: 'info', error_code: '402' };
  }
  if (msg.includes('safety') || msg.includes('blocked') || msg.includes('responsible ai') ||
      msg.includes('prohibited content')) {
    return { internal_reason: 'safety_block', alert_level: 'info', error_code: 'SAFETY' };
  }
  if (status === 400) {
    return { internal_reason: 'invalid_input', alert_level: 'info', error_code: '400' };
  }

  // 분류 불가 (버셀 로그 직접 확인 필요) — v1대로 warning 유지
  return { internal_reason: 'unknown_error', alert_level: 'warning', error_code: String(status || 'unknown') };
}

/**
 * ai_call_logs에 INSERT
 * @param {object} params
 */
export async function logAiCall(params) {
  const {
    member_id,
    model,                  // 'sonnet' | 'nanobanana'
    route = null,           // 'vertex-seoul' | 'vertex-global' | 'legacy' | null
    stage = null,           // 'color' | 'cut' | 'recipe' | 'image'
    status,                 // 'success' | 'safety_block' | 'rate_limit' | 'error' | 'refunded' | 'timeout'
    user_message = null,    // 회원이 본 통일 문구
    internal_reason = null, // classifyError 결과
    alert_level = null,     // 'critical' | 'warning' | 'info'
    raw_error = null,       // 영어 원문
    error_code = null,
    duration_ms = null,
    prompt_length = null,
  } = params;

  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('ai_call_logs').insert({
      member_id,
      model,
      route,
      stage,
      status,
      user_message,
      internal_reason,
      alert_level,
      raw_error: raw_error ? String(raw_error).slice(0, 2000) : null, // 너무 길면 자름
      error_code,
      duration_ms,
      prompt_length,
    });
    if (error) {
      console.error('[ai-log-helper] insert error:', error.message);
    }
  } catch (e) {
    // 로깅 실패가 본 흐름을 깨면 안 됨 — 절대 throw 하지 말 것
    console.error('[ai-log-helper] catch:', e?.message || e);
  }
}

/**
 * 성공 케이스 헬퍼 (한 줄 사용)
 */
export async function logSuccess({ member_id, model, route, stage, duration_ms, prompt_length }) {
  const reasonByModel = {
    nanobanana: route === 'vertex-seoul' ? 'success_vertex_seoul'
              : route === 'vertex-global' ? 'success_vertex_global'
              : route === 'legacy' ? 'success_legacy'
              : 'success_nanobanana',
    sonnet: 'success_sonnet',
  };
  return logAiCall({
    member_id, model, route, stage,
    status: 'success',
    internal_reason: reasonByModel[model] || 'success',
    alert_level: 'info',
    duration_ms, prompt_length,
  });
}

/**
 * 실패 케이스 헬퍼 (에러 객체 받으면 자동 분류)
 */
export async function logFailure({ member_id, model, route, stage, err, user_message, duration_ms, prompt_length, allFallbacksFailed = false, refunded = false }) {
  const { internal_reason, alert_level, error_code } = classifyError(err, { allFallbacksFailed, route });

  // status 결정
  let status = 'error';
  if (internal_reason === 'safety_block') status = 'safety_block';
  else if (internal_reason === 'real_rate_limit') status = 'rate_limit';
  else if (internal_reason === 'timeout') status = 'timeout';
  else if (refunded) status = 'refunded';

  return logAiCall({
    member_id, model, route, stage, status,
    user_message,
    internal_reason, alert_level,
    raw_error: err?.message || String(err || ''),
    error_code,
    duration_ms, prompt_length,
  });
}
