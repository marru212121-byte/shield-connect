// api/track.js
// ═══════════════════════════════════════════════════════════════
// 메뉴 클릭 1건 기록 (프론트의 track()이 호출)
// ═══════════════════════════════════════════════════════════════
// POST /api/track
// body: { feature: 'calculator', anonId: 'anon_xxx' }
//   - 로그인 회원이면 쿠키 세션에서 member_id를 자동으로 읽음 (anonId 무시)
//   - 비회원이면 body의 anonId를 member_id 자리에 저장
// 응답: 항상 200 (추적 실패가 앱 사용을 막으면 안 되므로)
// ═══════════════════════════════════════════════════════════════

import { getSessionFromRequest } from '../lib/session.js';
import { getSupabase } from '../lib/supabase.js';

// 허용된 메뉴 키만 기록 (오타·장난 데이터 방지). 메뉴 추가하면 여기에 한 줄 추가.
const ALLOWED_FEATURES = new Set([
  // 별도 페이지 (.html)
  'hairo', 'analyzer', 'cut-analyzer', 'color_journey', 'dye_level_calc', 'melanin_level', 'helix',
  // 앱 안 메뉴 (navigate)
  'calculator', 'perm-calc', 'ingredient', 'theory', 'theory-hair', 'reels',
  'sales', 'stats', 'settings', 'memo', 'feedback', 'timer',
  'home',
]);

export default async function handler(req, res) {
  // 추적은 부가기능 — 어떤 경우에도 앱을 막지 않도록 항상 200으로 끝냄
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(200).json({ ok: false, reason: 'method' });
  }

  try {
    const body = req.body || {};
    const feature = String(body.feature || '').trim();

    // 허용 목록에 없는 건 조용히 무시 (200으로)
    if (!feature || !ALLOWED_FEATURES.has(feature)) {
      return res.status(200).json({ ok: false, reason: 'unknown_feature' });
    }

    // 로그인 세션이 있으면 회원, 없으면 비회원(anonId)
    const session = getSessionFromRequest(req);
    let memberId;
    let isMember;

    if (session?.memberId) {
      memberId = session.memberId;
      isMember = true;
    } else {
      // 비회원: 프론트가 만든 익명 ID 사용 ('anon_'로 시작하는 것만 신뢰)
      const anon = String(body.anonId || '').trim();
      memberId = /^anon_[a-z0-9]{6,}$/i.test(anon) ? anon : 'anon_unknown';
      isMember = false;
    }

    const supabase = getSupabase();
    await supabase.from('feature_events').insert({
      member_id: memberId,
      feature,
      is_member: isMember,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    // 로깅 실패가 본 흐름을 깨면 안 됨 — 절대 에러로 응답하지 않음
    console.error('[track] error:', err?.message || err);
    return res.status(200).json({ ok: false, reason: 'server' });
  }
}
