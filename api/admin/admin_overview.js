// api/admin/overview.js
// ═══════════════════════════════════════════════════════════════
// 어드민 홈 페이지 데이터 (v3)
// ═══════════════════════════════════════════════════════════════
// 변경점 (v2 → v3):
//   1) 결제 1건마다 4관문 검증 결과(gates) 추가
//      - 관문 1: 웹훅 도착 — webhook_events에 그 order_id 있나
//      - 관문 2: 회원 식별 — member_id 비어있지 않나 (게스트 아닌가)
//      - 관문 3: 상품 매핑 — product_credits 활성 행 있나
//      - 관문 4: DB 적립 — credit_ledger의 charge 행 자체 (이 행이 보인다는 건 적립됨)
//   2) gates_passed 카운트 추가 (4면 정상, 미만이면 문제)
//
// 변경점 (v1 → v2):
//   - 가입 경로 자동 판별
//   - 오늘 흐름 총합 (불일치 검증)
//   - 13일 토큰 알림 제거
//   - 웹훅 수신 24h 카운트
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
    const expectedBonusCredits = (signupCount || 0) * SIGNUP_BONUS;
    const actualBonusCredits = (signups || []).reduce((sum, s) => sum + (s.amount || 0), 0);
    const expectedChargeCredits = (paymentCount || 0) * CREDITS_PER_CHARGE;
    const actualChargeCredits = (payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);

    const bonusMismatch = expectedBonusCredits !== actualBonusCredits;
    const chargeMismatch = expectedChargeCredits !== actualChargeCredits;
    const mismatchCount = (bonusMismatch ? 1 : 0) + (chargeMismatch ? 1 : 0);

    // ─── 7. v3: 결제 5건 4관문 검증 (최근 5건만, 부담 적음) ───
    const recentPayments = (payments || []).slice(0, 5);
    const recentOrderIds = recentPayments
      .map(p => p.reference)
      .filter(Boolean);

    // 한 번에 조회: 최근 결제의 webhook_events 존재 여부
    let webhookOrderIdSet = new Set();
    if (recentOrderIds.length > 0) {
      const { data: webhookRows } = await supabase
        .from('webhook_events')
        .select('order_id')
        .in('order_id', recentOrderIds);
      webhookOrderIdSet = new Set((webhookRows || []).map(w => w.order_id));
    }

    // 상품 매핑 활성 행 1개라도 있나 (전역 검사, 결제마다 검사 X)
    const { count: activeMappingCount } = await supabase
      .from('product_credits')
      .select('cafe24_product_no', { count: 'exact', head: true })
      .eq('active', true);
    const hasMappingActive = (activeMappingCount || 0) > 0;

    // 각 결제 행에 gates 필드 추가
    const recentPaymentsWithGates = recentPayments.map(p => {
      const orderId = p.reference;
      const gates = {
        webhook: orderId ? webhookOrderIdSet.has(orderId) : false,
        member: !!p.member_id,
        mapping: hasMappingActive,
        ledger: true, // 이 행이 보인다는 건 ledger에 진짜 있다는 거 (자기 자신)
      };
      const gatesPassed = Object.values(gates).filter(v => v === true).length;

      return {
        member_id: p.member_id,
        provider: getProviderFromMemberId(p.member_id),
        amount: p.amount,
        revenue: PRICE_PER_CHARGE,
        order_id: p.reference,
        created_at: p.created_at,
        gates,             // { webhook, member, mapping, ledger }
        gates_passed: gatesPassed, // 0~4
      };
    });

    // ─── 8. 응답 ──────────────────────────────────────────
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
      recent_payments: recentPaymentsWithGates,
    });
  } catch (err) {
    console.error('[admin/overview] error:', err);
    return res.status(500).json({ code: 'server_error', message: err.message });
  }
}
