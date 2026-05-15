// api/admin/overview.js
// ═══════════════════════════════════════════════════════════════
// 어드민 홈 페이지 데이터 (v2)
// ═══════════════════════════════════════════════════════════════
// 변경점 (v1 → v2):
//   1) 가입 경로(자사몰/카카오/네이버) 자동 판별
//      → ID가 '@k'면 카카오, '@n'이면 네이버, 나머지는 자사몰
//   2) 오늘 흐름 총합 (불일치 검증)
//      → 가입 수 = 보너스+1 행 수 ?
//      → 결제 수 = 충전+30 행 수 ?
//      → 차이 나면 사장님이 즉시 알아챔
//   3) 13일 토큰 알림 제거 (cron이 자동 갱신 = 잘못된 경고였음)
//      → 시스템 페이지에서 자세히 보면 됨. 홈에는 끌어올리지 않음
//   4) 웹훅 수신 24h 카운트 + 마지막 시각 추가
// ═══════════════════════════════════════════════════════════════

import { requireAdmin } from '../../lib/admin-auth.js';
import { getSupabase } from '../../lib/supabase.js';

const PRICE_PER_CHARGE = 7900;
const CREDITS_PER_CHARGE = 30;
const SIGNUP_BONUS = 1;

// ID → 가입 경로 판별
function getProviderFromMemberId(memberId) {
  if (!memberId) return 'unknown';
  if (memberId.endsWith('@k')) return 'kakao';
  if (memberId.endsWith('@n')) return 'naver';
  return 'cafe24';
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ code: 'method_not_allowed' });
  }
  if (!requireAdmin(req, res)) return;

  res.setHeader('Cache-Control', 'no-store');

  const supabase = getSupabase();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayStartISO = todayStart.toISOString();
  const dayAgoISO = new Date(Date.now() - 86400000).toISOString();

  try {
    // ─── 1. 오늘 신규 가입 (보너스 +1) ──────────────────────
    const { data: signups, count: signupCount } = await supabase
      .from('credit_ledger')
      .select('member_id, amount, reference, note, created_at', { count: 'exact' })
      .eq('type', 'signup_bonus')
      .gte('created_at', todayStartISO)
      .order('created_at', { ascending: false });

    // ─── 2. 오늘 결제 (충전 +30) ────────────────────────────
    const { data: payments, count: paymentCount } = await supabase
      .from('credit_ledger')
      .select('member_id, amount, reference, note, created_at', { count: 'exact' })
      .eq('type', 'charge')
      .gte('created_at', todayStartISO)
      .order('created_at', { ascending: false });

    // ─── 3. 오늘 AI 호출 통계 ────────────────────────────────
    const { data: aiCalls } = await supabase
      .from('ai_call_logs')
      .select('model, status, alert_level, stage')
      .gte('created_at', todayStartISO);

    const aiStats = {
      total: aiCalls?.length || 0,
      nanobanana: {
        total: aiCalls?.filter(c => c.model === 'nanobanana').length || 0,
        success: aiCalls?.filter(c => c.model === 'nanobanana' && c.status === 'success').length || 0,
      },
      sonnet: {
        total: aiCalls?.filter(c => c.model === 'sonnet').length || 0,
        success: aiCalls?.filter(c => c.model === 'sonnet' && c.status === 'success').length || 0,
      },
      alert_counts: {
        critical: aiCalls?.filter(c => c.alert_level === 'critical').length || 0,
        warning: aiCalls?.filter(c => c.alert_level === 'warning').length || 0,
        info: aiCalls?.filter(c => c.alert_level === 'info').length || 0,
      },
    };

    // ─── 4. 매출 ──────────────────────────────────────────
    const revenue = (paymentCount || 0) * PRICE_PER_CHARGE;

    // ─── 5. 웹훅 수신 (24h) ──────────────────────────────
    const { data: webhooks, count: webhookCount } = await supabase
      .from('webhook_events')
      .select('trace_id, order_id, processed_at', { count: 'exact' })
      .gte('processed_at', dayAgoISO)
      .order('processed_at', { ascending: false })
      .limit(1);

    const lastWebhookAt = webhooks?.[0]?.processed_at || null;

    // ─── 6. 오늘 흐름 · 총합 (불일치 검증) ─────────────────
    // 가입 수 vs 보너스 +1 지급 수 (반드시 같아야 함)
    // 결제 수 vs 충전 +30 지급 수 (반드시 같아야 함)
    const expectedBonusCredits = (signupCount || 0) * SIGNUP_BONUS;
    const actualBonusCredits = (signups || []).reduce((sum, s) => sum + (s.amount || 0), 0);
    const expectedChargeCredits = (paymentCount || 0) * CREDITS_PER_CHARGE;
    const actualChargeCredits = (payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);

    const bonusMismatch = expectedBonusCredits !== actualBonusCredits;
    const chargeMismatch = expectedChargeCredits !== actualChargeCredits;
    const mismatchCount = (bonusMismatch ? 1 : 0) + (chargeMismatch ? 1 : 0);

    // ─── 7. 응답 ──────────────────────────────────────────
    return res.status(200).json({
      today: {
        signups: signupCount || 0,
        payments: paymentCount || 0,
        revenue,
        ai_calls: aiStats,
      },
      flow_summary: {
        bonus: {
          signups: signupCount || 0,
          credits_expected: expectedBonusCredits,
          credits_actual: actualBonusCredits,
          ok: !bonusMismatch,
        },
        charge: {
          payments: paymentCount || 0,
          credits_expected: expectedChargeCredits,
          credits_actual: actualChargeCredits,
          revenue,
          ok: !chargeMismatch,
        },
        webhook: {
          last_24h: webhookCount || 0,
          last_received: lastWebhookAt,
          ok: (webhookCount || 0) > 0 || (paymentCount || 0) === 0,
        },
        mismatch_count: mismatchCount,
      },
      recent_signups: (signups || []).slice(0, 5).map(s => ({
        member_id: s.member_id,
        provider: getProviderFromMemberId(s.member_id),
        amount: s.amount,
        created_at: s.created_at,
      })),
      recent_payments: (payments || []).slice(0, 5).map(p => ({
        member_id: p.member_id,
        provider: getProviderFromMemberId(p.member_id),
        amount: p.amount,
        revenue: PRICE_PER_CHARGE,
        order_id: p.reference,
        created_at: p.created_at,
      })),
    });
  } catch (err) {
    console.error('[admin/overview] error:', err);
    return res.status(500).json({ code: 'server_error', message: err.message });
  }
}
