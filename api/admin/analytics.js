// api/admin/analytics.js
// ═══════════════════════════════════════════════════════════════
// 기능 사용 분석 (feature_events + ai_call_logs 통합)
// ═══════════════════════════════════════════════════════════════
// GET /api/admin/analytics?range=today|week|month
// 응답:
//   - summary: 기간 내 총 사용 수 / 활동 사람 수
//   - ranking: 메뉴별 사용 순위 (API+무료 합산, 한글 라벨 포함)
//   - member_split: 회원 vs 비회원 비율
//   - top_members: 회원별 사용 많은 순 (탭하면 상세로)
// ═══════════════════════════════════════════════════════════════

import { requireAdmin } from '../../lib/admin-auth.js';
import { getSupabase } from '../../lib/supabase.js';

// ─── 분석에 보여줄 메뉴 + 한글 라벨 (여기 없는 키는 화면에서 숨김) ───
// 새 메뉴 추가/표시하려면 여기에 한 줄 추가하면 됩니다.
const FEATURE_LABELS = {
  // API 메뉴 (ai_call_logs 출처)
  hairo:          'HAIRO 살롱 스튜디오',
  analyzer:       '컬러 레시피',
  'cut-analyzer': '컷 상담',
  // 무료 메뉴 (feature_events 출처)
  color_journey:  'Color Journey',
  calculator:     '약제 비율 계산기',
  dye_level_calc: '원하는 명도 만들기',
  melanin_level:  '멜라닌 레벨',
  ingredient:     '성분사전',
  reels:          '영상 보기',
};
// ai_call_logs의 model/stage → 메뉴 키 매핑
// (recipe.js: stage 'color'|'recipe_only' = 컬러레시피(analyzer), 'cut' = 컷상담)
// (generate-image.js: model 'nanobanana' = HAIRO 사진)
function aiRowToFeature(row) {
  if (row.model === 'nanobanana') return 'hairo';
  if (row.model === 'gemini' || row.model === 'sonnet') {
    if (row.stage === 'cut') return 'cut-analyzer';
    if (row.stage === 'color' || row.stage === 'recipe_only') return 'analyzer';
  }
  return null; // customer_message 등은 분석 대상 아님
}

function rangeStartISO(range) {
  const now = new Date();
  if (range === 'today') {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString();
  }
  if (range === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  }
  // 기본: 최근 7일 (오늘 포함)
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - 6);
  return d.toISOString();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ code: 'method_not_allowed' });
  }
  if (!requireAdmin(req, res)) return;

  res.setHeader('Cache-Control', 'no-store');

  const range = ['today', 'week', 'month'].includes(req.query?.range) ? req.query.range : 'week';
  const fromIso = rangeStartISO(range);
  const supabase = getSupabase();

  try {
    // ─── 1. 무료 메뉴 (feature_events) ───────────────────────
    const { data: events, error: evErr } = await supabase
      .from('feature_events')
      .select('member_id, feature, is_member, created_at')
      .gte('created_at', fromIso)
      .limit(20000);
    if (evErr) throw evErr;

    // ─── 2. API 메뉴 (ai_call_logs, 성공만) ──────────────────
    const { data: aiLogs, error: aiErr } = await supabase
      .from('ai_call_logs')
      .select('member_id, model, stage, status, created_at')
      .eq('status', 'success')
      .gte('created_at', fromIso)
      .limit(20000);
    if (aiErr) throw aiErr;

    // ─── 3. 통합 집계 ────────────────────────────────────────
    const featureCount = {};                 // { featureKey: 횟수 }
    const memberTotals = {};                 // { memberId: { count, isMember, byFeature:{} } }
    const actors = new Set();                // 활동한 사람(회원+비회원) 수
    let memberHits = 0, guestHits = 0;       // 회원/비회원 사용 횟수

    function tally(featureKey, memberId, isMember) {
      if (!FEATURE_LABELS[featureKey]) return; // 숨김 메뉴는 집계 제외
      featureCount[featureKey] = (featureCount[featureKey] || 0) + 1;
      actors.add(memberId || 'unknown');
      if (isMember) memberHits++; else guestHits++;

      const id = memberId || 'unknown';
      if (!memberTotals[id]) memberTotals[id] = { count: 0, isMember, byFeature: {} };
      memberTotals[id].count++;
      memberTotals[id].byFeature[featureKey] = (memberTotals[id].byFeature[featureKey] || 0) + 1;
    }

    for (const e of events || []) {
      tally(e.feature, e.member_id, e.is_member === true);
    }
    for (const r of aiLogs || []) {
      const fk = aiRowToFeature(r);
      if (fk) tally(fk, r.member_id, !String(r.member_id || '').startsWith('anon_'));
    }

    // ─── 4. 메뉴 순위 (내림차순) ─────────────────────────────
    const ranking = Object.entries(featureCount)
      .map(([key, count]) => ({ key, label: FEATURE_LABELS[key], count }))
      .sort((a, b) => b.count - a.count);
    const maxCount = ranking.length ? ranking[0].count : 0;

    const totalHits = memberHits + guestHits;

    // ─── 5. 회원별 Top (회원만, 비회원 제외) ─────────────────
    const topMembers = Object.entries(memberTotals)
      .filter(([id, v]) => v.isMember && id !== 'unknown')
      .map(([id, v]) => {
        // 그 회원이 가장 많이 쓴 메뉴
        const top = Object.entries(v.byFeature).sort((a, b) => b[1] - a[1])[0];
        return {
          member_id: id,
          count: v.count,
          top_feature: top ? FEATURE_LABELS[top[0]] : null,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    return res.status(200).json({
      range,
      summary: {
        total_hits: totalHits,
        actors: actors.size,
      },
      ranking,
      max_count: maxCount,
      member_split: {
        member: memberHits,
        guest: guestHits,
        member_pct: totalHits ? Math.round((memberHits / totalHits) * 100) : 0,
        guest_pct: totalHits ? Math.round((guestHits / totalHits) * 100) : 0,
      },
      top_members: topMembers,
    });
  } catch (err) {
    console.error('[admin/analytics] error:', err);
    return res.status(500).json({ code: 'server_error', message: err.message });
  }
}
