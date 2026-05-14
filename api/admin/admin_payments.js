// api/admin/payments.js
// ═══════════════════════════════════════════════════════════════
// 결제 페이지 데이터
// ═══════════════════════════════════════════════════════════════
// GET /api/admin/payments
// 응답:
//   - 매출 요약 (오늘/이번달/누적)
//   - 7일 매출 추이
//   - 최근 결제 20건
//   - 웹훅 시스템 상태
//   - 활성 상품 매핑
// ═══════════════════════════════════════════════════════════════

import { requireAdmin } from '../../lib/admin-auth.js';
import { getSupabase } from '../../lib/supabase.js';

const PRICE_PER_CHARGE = 7900; // 7,900원 / 30크레딧 (이관문서 v6 정책)

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ code: 'method_not_allowed' });
  }
  if (!requireAdmin(req, res)) return;

  res.setHeader('Cache-Control', 'no-store');

  const supabase = getSupabase();
  const now = new Date();

  // 시간 경계
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  try {
    // ─── 1. 모든 charge 거래 (최근 7일) ─────────────────────
    const { data: weekCharges } = await supabase
      .from('credit_ledger')
      .select('member_id, amount, reference, note, created_at')
      .eq('type', 'charge')
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    // ─── 2. 오늘 ──────────────────────────────────────────
    const todayCharges = (weekCharges || []).filter(c => new Date(c.created_at) >= todayStart);
    const todayCount = todayCharges.length;
    const todayRevenue = todayCount * PRICE_PER_CHARGE;

    // ─── 3. 이번 달 ─────────────────────────────────────
    const { count: monthCount } = await supabase
      .from('credit_ledger')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'charge')
      .gte('created_at', monthStart.toISOString());

    // ─── 4. 누적 ────────────────────────────────────────
    const { count: totalCount } = await supabase
      .from('credit_ledger')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'charge');

    // ─── 5. 7일 일별 추이 ──────────────────────────────
    const daily = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(todayStart);
      d.setDate(d.getDate() - i);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const count = (weekCharges || []).filter(c => {
        const cd = new Date(c.created_at);
        return cd >= d && cd < next;
      }).length;
      daily.push({
        date: d.toISOString().slice(0, 10),
        day_label: ['일', '월', '화', '수', '목', '금', '토'][d.getDay()],
        count,
        revenue: count * PRICE_PER_CHARGE,
      });
    }

    // ─── 6. 웹훅 시스템 상태 (24h) ──────────────────────
    const dayAgo = new Date(now.getTime() - 86400000).toISOString();
    const { data: webhooks, count: webhookCount } = await supabase
      .from('webhook_events')
      .select('trace_id, order_id, processed_at', { count: 'exact' })
      .gte('processed_at', dayAgo)
      .order('processed_at', { ascending: false });

    const lastWebhookAt = webhooks?.[0]?.processed_at || null;

    // ─── 7. 활성 상품 매핑 ──────────────────────────────
    const { data: products } = await supabase
      .from('product_credits')
      .select('cafe24_product_no, credits, product_name, price, active')
      .eq('active', true);

    // ─── 응답 ────────────────────────────────────────────
    return res.status(200).json({
      summary: {
        today: { count: todayCount, revenue: todayRevenue },
        month: { count: monthCount || 0, revenue: (monthCount || 0) * PRICE_PER_CHARGE },
        total: { count: totalCount || 0, revenue: (totalCount || 0) * PRICE_PER_CHARGE },
      },
      daily,
      recent_payments: (weekCharges || []).slice(0, 20).map(c => ({
        member_id: c.member_id,
        amount: c.amount,
        revenue: PRICE_PER_CHARGE,
        order_id: c.reference,
        created_at: c.created_at,
      })),
      webhook_status: {
        last_24h: webhookCount || 0,
        last_received: lastWebhookAt,
      },
      products: products || [],
    });
  } catch (err) {
    console.error('[admin/payments] error:', err);
    return res.status(500).json({ code: 'server_error', message: err.message });
  }
}
