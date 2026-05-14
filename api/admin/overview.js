// api/admin/overview.js
// ═══════════════════════════════════════════════════════════════
// 어드민 홈 페이지 데이터
// ═══════════════════════════════════════════════════════════════
// GET /api/admin/overview
// 응답:
//   {
//     today: { signups, payments, revenue, ai_calls },
//     alerts: [...],
//     recent_signups: [...],
//     recent_payments: [...]
//   }
// ═══════════════════════════════════════════════════════════════

import { requireAdmin } from '../../lib/admin-auth.js';
import { getSupabase } from '../../lib/supabase.js';

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

  try {
    // ─── 1. 오늘 신규 가입 ───────────────────────────────────
    const { data: signups, count: signupCount } = await supabase
      .from('credit_ledger')
      .select('member_id, amount, reference, note, created_at', { count: 'exact' })
      .eq('type', 'signup_bonus')
      .gte('created_at', todayStartISO)
      .order('created_at', { ascending: false });

    // ─── 2. 오늘 결제 ────────────────────────────────────────
    const { data: payments, count: paymentCount } = await supabase
      .from('credit_ledger')
      .select('member_id, amount, reference, note, created_at', { count: 'exact' })
      .eq('type', 'charge')
      .gte('created_at', todayStartISO)
      .order('created_at', { ascending: false });

    // ─── 3. 오늘 AI 호출 통계 ────────────────────────────────
    const { data: aiCalls } = await supabase
      .from('ai_call_logs')
      .select('model, status')
      .gte('created_at', todayStartISO);

    const aiStats = {
      total: aiCalls?.length || 0,
      nanobanana: aiCalls?.filter(c => c.model === 'nanobanana').length || 0,
      sonnet: aiCalls?.filter(c => c.model === 'sonnet').length || 0,
    };

    // ─── 4. 매출 계산 (충전 amount × 단가) ──────────────────
    // 상용가: 7,900원 / 30크레딧 (이관문서 v6 정책)
    // 정확한 금액은 product_credits 테이블 참조 권장 (현재는 단일 상품 가정)
    const revenue = (paymentCount || 0) * 7900;

    // ─── 5. 알림 (토큰 만료, API 잔액 등) ───────────────────
    const alerts = [];

    // 카페24 refresh token 만료 체크
    const { data: oauth } = await supabase
      .from('cafe24_oauth')
      .select('refresh_token_expires_at')
      .maybeSingle();

    if (oauth?.refresh_token_expires_at) {
      const daysLeft = Math.floor(
        (new Date(oauth.refresh_token_expires_at) - Date.now()) / 86400000
      );
      if (daysLeft <= 60) {
        alerts.push({
          level: daysLeft <= 14 ? 'danger' : 'warning',
          title: `카페24 토큰 ${daysLeft}일 후 만료`,
          message: '재발급 필요',
        });
      }
    }

    // ─── 응답 ────────────────────────────────────────────────
    return res.status(200).json({
      today: {
        signups: signupCount || 0,
        payments: paymentCount || 0,
        revenue,
        ai_calls: aiStats,
      },
      alerts,
      recent_signups: (signups || []).slice(0, 5).map(s => ({
        member_id: s.member_id,
        amount: s.amount,
        created_at: s.created_at,
      })),
      recent_payments: (payments || []).slice(0, 5).map(p => ({
        member_id: p.member_id,
        amount: p.amount,
        order_id: p.reference,
        created_at: p.created_at,
      })),
    });
  } catch (err) {
    console.error('[admin/overview] error:', err);
    return res.status(500).json({ code: 'server_error', message: err.message });
  }
}
