// api/admin/member-detail.js
// ═══════════════════════════════════════════════════════════════
// 회원 한 명 상세 + 수동 크레딧 조정
// ═══════════════════════════════════════════════════════════════
// GET  /api/admin/member-detail?id=xxx
//   → 회원 정보 + 거래내역 + 사진(갤러리) + AI 호출 기록
// POST /api/admin/member-detail?id=xxx
//   body: { delta: number, reason: string }
//   → 수동 크레딧 ± 조정 (감사 기록)
// ═══════════════════════════════════════════════════════════════

import { requireAdmin } from '../../lib/admin-auth.js';
import { getSupabase } from '../../lib/supabase.js';

const BUCKET = 'hairo-gallery';

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;

  const memberId = req.query?.id;
  if (!memberId) {
    return res.status(400).json({ code: 'missing_id' });
  }

  const supabase = getSupabase();
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') return await getDetail(req, res, supabase, memberId);
  if (req.method === 'POST') return await adjustCredit(req, res, supabase, memberId);
  return res.status(405).json({ code: 'method_not_allowed' });
}

// ════════════════════════════════════════════════════════════
// GET — 상세 조회
// ════════════════════════════════════════════════════════════
async function getDetail(req, res, supabase, memberId) {
  try {
    // 1. 회원 기본 정보
    const { data: member, error: memberErr } = await supabase
      .from('cafe24_member_credits')
      .select('*')
      .eq('member_id', memberId)
      .maybeSingle();

    if (memberErr) throw memberErr;
    if (!member) return res.status(404).json({ code: 'member_not_found' });

    // 2. 거래 내역 (최근 50건)
    const { data: ledger } = await supabase
      .from('credit_ledger')
      .select('*')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })
      .limit(50);

    // 3. 갤러리 사진 (최근 12장)
    const { data: gallery } = await supabase
      .from('hairo_gallery')
      .select('id, image_path, prompt, aspect_ratio, is_favorite, created_at')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })
      .limit(12);

    // 4. 갤러리 signed URL
    const galleryWithUrls = await Promise.all((gallery || []).map(async (g) => {
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(g.image_path, 3600);
      return { ...g, image_url: signed?.signedUrl || null };
    }));

    // 5. AI 호출 기록 (최근 30건)
    const { data: aiLogs } = await supabase
      .from('ai_call_logs')
      .select('*')
      .eq('member_id', memberId)
      .order('created_at', { ascending: false })
      .limit(30);

    // 6. 통계
    const stats = {
      total_signups: 0,
      total_charges: 0,
      total_uses: 0,
      total_refunds: 0,
      total_admin_adjusts: 0,
    };
    for (const l of ledger || []) {
      if (l.type === 'signup_bonus') stats.total_signups += l.amount;
      else if (l.type === 'charge') stats.total_charges += l.amount;
      else if (l.type === 'use') stats.total_uses += Math.abs(l.amount);
      else if (l.type === 'refund') stats.total_refunds += l.amount;
      else if (l.type === 'admin_adjust') stats.total_admin_adjusts += l.amount;
    }

    // 7. 즐겨 쓰는 기능 (feature_events + ai_logs 합산, 최근 30일)
    const FEATURE_LABELS = {
      hairo: 'HAIRO 살롱 스튜디오', analyzer: '컬러 레시피', 'cut-analyzer': '컷 상담',
      color_journey: 'Color Journey', calculator: '약제 비율 계산기',
      dye_level_calc: '원하는 명도 만들기', melanin_level: '멜라닌 레벨',
      ingredient: '성분사전', reels: '영상 보기',
    };
    const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
    const favCount = {};
    function bump(key) {
      if (!FEATURE_LABELS[key]) return;
      favCount[key] = (favCount[key] || 0) + 1;
    }
    // 무료 메뉴
    const { data: featEvents } = await supabase
      .from('feature_events')
      .select('feature, created_at')
      .eq('member_id', memberId)
      .gte('created_at', since30)
      .limit(5000);
    for (const e of featEvents || []) bump(e.feature);
    // API 메뉴 (집계용으로 최근 30일 성공분을 따로 조회 — 화면용 aiLogs 30건과 별개)
    const { data: aiForFav } = await supabase
      .from('ai_call_logs')
      .select('model, stage, status, created_at')
      .eq('member_id', memberId)
      .eq('status', 'success')
      .gte('created_at', since30)
      .limit(5000);
    for (const r of aiForFav || []) {
      if (r.model === 'nanobanana') bump('hairo');
      else if (r.model === 'gemini' || r.model === 'sonnet') {
        if (r.stage === 'cut') bump('cut-analyzer');
        else if (r.stage === 'color' || r.stage === 'recipe_only') bump('analyzer');
      }
    }
    const favorite_features = Object.entries(favCount)
      .map(([key, count]) => ({ key, label: FEATURE_LABELS[key], count }))
      .sort((a, b) => b.count - a.count);

    return res.status(200).json({
      member,
      ledger: ledger || [],
      gallery: galleryWithUrls,
      ai_logs: aiLogs || [],
      stats,
      favorite_features,
    });
  } catch (err) {
    console.error('[admin/member-detail GET] error:', err);
    return res.status(500).json({ code: 'server_error', message: err.message });
  }
}

// ════════════════════════════════════════════════════════════
// POST — 수동 크레딧 조정
// ════════════════════════════════════════════════════════════
async function adjustCredit(req, res, supabase, memberId) {
  try {
    const { delta, reason } = req.body || {};
    if (typeof delta !== 'number' || !Number.isInteger(delta) || delta === 0) {
      return res.status(400).json({ code: 'invalid_delta' });
    }
    if (!reason || typeof reason !== 'string' || reason.length < 2) {
      return res.status(400).json({ code: 'missing_reason' });
    }
    if (Math.abs(delta) > 100) {
      return res.status(400).json({ code: 'delta_too_large', message: '±100 이내로 조정해주세요.' });
    }

    // 회원 잔액 조회
    const { data: m } = await supabase
      .from('cafe24_member_credits')
      .select('credits_remaining, total_charged, total_used')
      .eq('member_id', memberId)
      .single();

    if (!m) return res.status(404).json({ code: 'member_not_found' });

    const newBalance = Math.max(0, (m.credits_remaining || 0) + delta);

    // 잔액 업데이트
    const updateFields = {
      credits_remaining: newBalance,
      updated_at: new Date().toISOString(),
    };
    if (delta > 0) updateFields.total_charged = (m.total_charged || 0) + delta;
    else updateFields.total_used = (m.total_used || 0) + Math.abs(delta);

    const { error: updateErr } = await supabase
      .from('cafe24_member_credits')
      .update(updateFields)
      .eq('member_id', memberId);

    if (updateErr) throw updateErr;

    // 원장 기록
    await supabase.from('credit_ledger').insert({
      member_id: memberId,
      type: 'admin_adjust',
      amount: delta,
      balance_after: newBalance,
      reference: `admin_${Date.now()}`,
      note: `[관리자 조정] ${reason}`,
    });

    return res.status(200).json({
      ok: true,
      credits_remaining: newBalance,
      delta,
    });
  } catch (err) {
    console.error('[admin/member-detail POST] error:', err);
    return res.status(500).json({ code: 'server_error', message: err.message });
  }
}
