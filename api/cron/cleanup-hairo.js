// api/cron/cleanup-hairo.js
// ═══════════════════════════════════════════════════════════════
// HAIRO 갤러리 "자동 청소부" — 정기 실행 (Vercel Cron)
// ───────────────────────────────────────────────────────────────
// 문제: 기존엔 사용자가 "앱에 접속해서 갤러리를 열 때만" 만료분이 삭제됨.
//       → 앱을 안 켜는 사람의 30일 지난 사진이 스토리지에 계속 쌓임.
// 해결: 이 파일이 하루 한 번 자동으로 돌면서, 접속 여부와 상관없이
//       만료된(expires_at < 지금) 사진을 스토리지 + DB 모두에서 삭제.
// ═══════════════════════════════════════════════════════════════

import { getSupabase } from '../../lib/supabase.js';

const BUCKET = 'hairo-gallery';
const BATCH = 100;        // 한 번에 처리할 개수 (스토리지 삭제 한 묶음)
const MAX_PER_RUN = 1000; // 한 번 실행에서 최대 삭제 (타임아웃 방지)

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  // ── 보안: 아무나 이 주소를 못 부르게 (Vercel Cron 또는 비밀키 보유자만) ──
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization || '';
  if (secret && auth !== 'Bearer ' + secret) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  const supabase = getSupabase();
  const now = new Date().toISOString();
  let deleted = 0;

  try {
    while (deleted < MAX_PER_RUN) {
      // 만료된 행을 한 묶음씩 조회
      const { data: rows, error } = await supabase
        .from('hairo_gallery')
        .select('id, image_path')
        .lt('expires_at', now)
        // .eq('is_favorite', false)   // ← 즐겨찾기는 절대 안 지우고 싶으면 이 줄의 // 를 지우세요
        .limit(BATCH);

      if (error) throw error;
      if (!rows || rows.length === 0) break; // 더 지울 게 없으면 종료

      const paths = rows.map(r => r.image_path).filter(Boolean);
      const ids   = rows.map(r => r.id);

      // 1) 스토리지(실제 이미지 파일) 삭제
      if (paths.length) {
        const { error: rmErr } = await supabase.storage.from(BUCKET).remove(paths);
        if (rmErr) console.error('[cleanup-hairo] storage remove error:', rmErr);
        // 스토리지 삭제가 일부 실패해도 DB 행은 정리 (다음 회차에 재시도되지 않도록)
      }

      // 2) DB 행 삭제
      const { error: delErr } = await supabase
        .from('hairo_gallery')
        .delete()
        .in('id', ids);
      if (delErr) throw delErr;

      deleted += rows.length;
      if (rows.length < BATCH) break; // 마지막 묶음
    }

    console.log('[cleanup-hairo] deleted', deleted, 'at', now);
    return res.status(200).json({ ok: true, deleted, ranAt: now });
  } catch (err) {
    console.error('[cleanup-hairo] error:', err);
    return res.status(500).json({ ok: false, deleted, error: String((err && err.message) || err) });
  }
}
