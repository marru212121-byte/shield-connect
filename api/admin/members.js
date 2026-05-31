// api/admin/members.js
// ═══════════════════════════════════════════════════════════════
// 회원 목록 + 통계
// ═══════════════════════════════════════════════════════════════
// GET /api/admin/members?filter=all|active|paid|dormant&search=xxx
// ═══════════════════════════════════════════════════════════════

import { requireAdmin } from '../../lib/admin-auth.js';
import { getSupabase } from '../../lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ code: 'method_not_allowed' });
  }
  if (!requireAdmin(req, res)) return;

  res.setHeader('Cache-Control', 'no-store');

  const filter = req.query?.filter || 'all';
  const search = (req.query?.search || '').trim();

  const supabase = getSupabase();
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 86400000).toISOString();
  const thirtyDaysAgo = new Date(now - 30 * 86400000).toISOString();

  try {
    // ─── 1. 전체 회원 + 최근 활동 ───────────────────────────
    let query = supabase
      .from('cafe24_member_credits')
      .select('member_id, credits_remaining, total_charged, total_used, role, signup_bonus_given, created_at, updated_at, is_installed, last_standalone_at')
      .order('updated_at', { ascending: false });

    if (search) {
      query = query.ilike('member_id', `%${search}%`);
    }

    const { data: allMembers, error } = await query.limit(200);
    if (error) throw error;

    // ─── 2. 각 회원의 마지막 활동 시각 (ledger) ─────────────
    const memberIds = (allMembers || []).map(m => m.member_id);
    let lastActivity = new Map();
    let activityCount = new Map();

    if (memberIds.length > 0) {
      const { data: ledgers } = await supabase
        .from('credit_ledger')
        .select('member_id, type, created_at')
        .in('member_id', memberIds)
        .order('created_at', { ascending: false });

      for (const row of ledgers || []) {
        if (!lastActivity.has(row.member_id)) {
          lastActivity.set(row.member_id, row.created_at);
        }
        const stats = activityCount.get(row.member_id) || { charge: 0, use: 0, refund: 0 };
        if (row.type === 'charge') stats.charge++;
        else if (row.type === 'use') stats.use++;
        else if (row.type === 'refund') stats.refund++;
        activityCount.set(row.member_id, stats);
      }
    }

    // ─── 3. 회원별 enrich ───────────────────────────────────
    const enriched = (allMembers || []).map(m => {
      const last = lastActivity.get(m.member_id) || m.updated_at || m.created_at;
      const stats = activityCount.get(m.member_id) || { charge: 0, use: 0, refund: 0 };
      const isActive = last && last >= sevenDaysAgo;
      const isDormant = last && last < thirtyDaysAgo;
      const isPaid = stats.charge > 0;
      return {
        member_id: m.member_id,
        credits_remaining: m.credits_remaining,
        total_charged: m.total_charged,
        total_used: m.total_used,
        role: m.role,
        last_active: last,
        is_active: isActive,
        is_dormant: isDormant,
        is_paid: isPaid,
        is_installed: !!m.is_installed,
        last_standalone_at: m.last_standalone_at || null,
        stats,
      };
    });

    // ─── 4. 필터 적용 ───────────────────────────────────────
    let filtered = enriched;
    if (filter === 'active') filtered = enriched.filter(m => m.is_active);
    else if (filter === 'paid') filtered = enriched.filter(m => m.is_paid);
    else if (filter === 'dormant') filtered = enriched.filter(m => m.is_dormant);
    else if (filter === 'rich') filtered = enriched.filter(m => m.credits_remaining > 0)
      .sort((a, b) => b.credits_remaining - a.credits_remaining);

    // ─── 5. 종합 통계 ───────────────────────────────────────
    const summary = {
      total: enriched.length,
      active: enriched.filter(m => m.is_active).length,
      paid: enriched.filter(m => m.is_paid).length,
      dormant: enriched.filter(m => m.is_dormant).length,
    };

    return res.status(200).json({
      summary,
      members: filtered.slice(0, 100),
      filter,
      search,
    });
  } catch (err) {
    console.error('[admin/members] error:', err);
    return res.status(500).json({ code: 'server_error', message: err.message });
  }
}
