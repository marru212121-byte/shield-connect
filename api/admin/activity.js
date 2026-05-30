// api/admin/activity.js
// ═══════════════════════════════════════════════════════════════
// 실시간 활동 흐름 (ai_call_logs + feature_events 통합, 시간순)
// ═══════════════════════════════════════════════════════════════
// GET /api/admin/activity?filter=all|paid|free&limit=80
//   - filter: all(전체) / paid(유료 API만) / free(무료 메뉴만)
//   - 응답: 시간 내림차순으로 합쳐진 활동 한 줄들
// ═══════════════════════════════════════════════════════════════

import { requireAdmin } from '../../lib/admin-auth.js';
import { getSupabase } from '../../lib/supabase.js';

// 무료 메뉴 한글 라벨
const FREE_LABELS = {
  color_journey: 'Color Journey',
  calculator: '약제 비율 계산기',
  dye_level_calc: '원하는 명도 만들기',
  melanin_level: '멜라닌 레벨',
  ingredient: '성분사전',
  reels: '영상 보기',
  // 분석에서 숨겼던 것도 활동 흐름엔 참고로 둘 수 있으나, 일단 위 6개만 라벨링
};

// 유료(API) 한글 라벨
function paidLabel(model, stage) {
  if (model === 'nanobanana') return 'HAIRO 사진';
  if (model === 'gemini' || model === 'sonnet') {
    if (stage === 'cut') return '컷 분석';
    if (stage === 'recipe_only') return '컬러 분석 2스텝 (레시피)';
    if (stage === 'color') return '컬러 분석';
    if (stage === 'customer_message') return '고객 안내';
  }
  return model || '분석';
}

function providerOf(memberId) {
  const id = String(memberId || '');
  if (id.startsWith('anon_')) return 'guest';
  if (id.endsWith('@k')) return 'kakao';
  if (id.endsWith('@n')) return 'naver';
  return 'cafe24';
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ code: 'method_not_allowed' });
  }
  if (!requireAdmin(req, res)) return;

  res.setHeader('Cache-Control', 'no-store');

  const filter = ['all', 'paid', 'free'].includes(req.query?.filter) ? req.query.filter : 'all';
  const limit = Math.min(Math.max(parseInt(req.query?.limit, 10) || 80, 10), 200);
  const supabase = getSupabase();

  try {
    const items = [];

    // ─── 유료 (ai_call_logs) ───────────────────────────────
    if (filter === 'all' || filter === 'paid') {
      const { data: ai } = await supabase
        .from('ai_call_logs')
        .select('member_id, model, stage, status, alert_level, user_message, internal_reason, duration_ms, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);
      for (const r of ai || []) {
        items.push({
          kind: 'paid',
          member_id: r.member_id,
          provider: providerOf(r.member_id),
          label: paidLabel(r.model, r.stage),
          status: r.status,                    // success / error / safety_block / ...
          alert_level: r.alert_level,          // critical / warning / info
          user_message: r.user_message,        // 회원에게 뜬 문구
          internal_reason: r.internal_reason,  // 내부 분류
          duration_ms: r.duration_ms,
          created_at: r.created_at,
        });
      }
    }

    // ─── 무료 (feature_events) ─────────────────────────────
    if (filter === 'all' || filter === 'free') {
      const { data: ev } = await supabase
        .from('feature_events')
        .select('member_id, feature, is_member, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);
      for (const e of ev || []) {
        if (!FREE_LABELS[e.feature]) continue; // 라벨 없는(숨김) 메뉴 제외
        items.push({
          kind: 'free',
          member_id: e.member_id,
          provider: providerOf(e.member_id),
          label: FREE_LABELS[e.feature],
          status: 'success',
          created_at: e.created_at,
        });
      }
    }

    // ─── 시간순 정렬 후 limit ───────────────────────────────
    items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const sliced = items.slice(0, limit);

    return res.status(200).json({
      filter,
      count: sliced.length,
      items: sliced,
    });
  } catch (err) {
    console.error('[admin/activity] error:', err);
    return res.status(500).json({ code: 'server_error', message: err.message });
  }
}
