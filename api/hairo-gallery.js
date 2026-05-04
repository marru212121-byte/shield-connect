// api/hairo-gallery.js
// ═══════════════════════════════════════════════════════════════
// HAIRO 갤러리 엔드포인트 (목록 조회 / 저장 / 즐겨찾기 / 삭제)
// ═══════════════════════════════════════════════════════════════
// GET    /api/hairo-gallery         → 본인 시안 목록
// POST   /api/hairo-gallery         → 압축본 저장 (생성 직후 자동 호출)
// PATCH  /api/hairo-gallery?id=xxx  → 즐겨찾기 토글
// DELETE /api/hairo-gallery?id=xxx  → 시안 삭제
// ═══════════════════════════════════════════════════════════════

import { getSessionFromRequest } from '../lib/session.js';
import { getSupabase } from '../lib/supabase.js';

const BUCKET = 'hairo-gallery';
const MAX_ITEMS = 30;     // 디자이너 1명당 최대 30장
const RETENTION_DAYS = 30; // 30일 후 자동 삭제

export const config = {
  maxDuration: 30,
  api: {
    bodyParser: {
      sizeLimit: '8mb', // 압축본 최대 크기
    },
  },
};

export default async function handler(req, res) {
  // ─── 세션 검증 ─────────────────────────────────────
  const session = getSessionFromRequest(req);
  if (!session?.memberId) {
    return res.status(401).json({ code: 'not_authenticated', message: '로그인이 필요합니다.' });
  }
  const memberId = session.memberId;
  const supabase = getSupabase();

  try {
    if (req.method === 'GET')    return await listGallery(req, res, supabase, memberId);
    if (req.method === 'POST')   return await saveGallery(req, res, supabase, memberId);
    if (req.method === 'PATCH')  return await toggleFavorite(req, res, supabase, memberId);
    if (req.method === 'DELETE') return await deleteItem(req, res, supabase, memberId);
    return res.status(405).json({ code: 'method_not_allowed' });
  } catch (err) {
    console.error('[hairo-gallery] error:', err);
    return res.status(500).json({ code: 'server_error', message: '서버 오류가 발생했습니다.' });
  }
}

// ════════════════════════════════════════════════════════════
// GET — 갤러리 목록
// ════════════════════════════════════════════════════════════
async function listGallery(req, res, supabase, memberId) {
  // 만료된 것 정리 (옵션) — 30일 지난 것 자동 삭제
  await cleanupExpired(supabase, memberId);

  const { data, error } = await supabase
    .from('hairo_gallery')
    .select('id, image_path, prompt, aspect_ratio, angle_yaw, angle_pitch, is_favorite, created_at, expires_at')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[hairo-gallery] list error:', error);
    return res.status(500).json({ code: 'server_error' });
  }

  // 각 항목에 signed URL 생성 (1시간 유효)
  const items = await Promise.all((data || []).map(async (item) => {
    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(item.image_path, 3600);
    return {
      ...item,
      image_url: signed?.signedUrl || null,
    };
  }));

  return res.status(200).json({
    items,
    count: items.length,
    max: MAX_ITEMS,
  });
}

// ════════════════════════════════════════════════════════════
// POST — 압축본 저장 (사진 생성 직후 프론트가 자동 호출)
// body: { imageBase64, mimeType, prompt, aspectRatio, angleYaw, anglePitch }
// ════════════════════════════════════════════════════════════
async function saveGallery(req, res, supabase, memberId) {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ code: 'invalid_body' });
  }

  const { imageBase64, mimeType, prompt, aspectRatio, angleYaw, anglePitch } = body;

  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return res.status(400).json({ code: 'missing_image' });
  }
  if (imageBase64.length > 7 * 1024 * 1024) {
    return res.status(400).json({ code: 'image_too_large', message: '이미지가 너무 큽니다.' });
  }

  // 30장 초과 시 가장 오래된 것 자동 삭제
  await enforceMaxItems(supabase, memberId);

  // 파일 경로: members/{memberId}/{timestamp}_{random}.jpg
  const ext = (mimeType === 'image/png') ? 'png' : 'jpg';
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const filePath = `members/${memberId}/${fileName}`;

  // base64 → Buffer 변환
  const buffer = Buffer.from(imageBase64, 'base64');

  // Supabase Storage 업로드
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, buffer, {
      contentType: mimeType || 'image/jpeg',
      upsert: false,
    });

  if (uploadError) {
    console.error('[hairo-gallery] upload error:', uploadError);
    return res.status(500).json({ code: 'upload_failed', message: '저장에 실패했습니다.' });
  }

  // hairo_gallery 테이블에 INSERT
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + RETENTION_DAYS);

  const { data: inserted, error: insertError } = await supabase
    .from('hairo_gallery')
    .insert({
      member_id: memberId,
      image_path: filePath,
      prompt: prompt || null,
      aspect_ratio: aspectRatio || null,
      angle_yaw: typeof angleYaw === 'number' ? angleYaw : null,
      angle_pitch: typeof anglePitch === 'number' ? anglePitch : null,
      is_favorite: false,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (insertError) {
    console.error('[hairo-gallery] insert error:', insertError);
    // INSERT 실패 시 업로드한 파일 롤백
    await supabase.storage.from(BUCKET).remove([filePath]);
    return res.status(500).json({ code: 'db_failed', message: '저장에 실패했습니다.' });
  }

  // signed URL 생성해서 응답
  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, 3600);

  return res.status(200).json({
    item: {
      ...inserted,
      image_url: signed?.signedUrl || null,
    },
  });
}

// ════════════════════════════════════════════════════════════
// PATCH — 즐겨찾기 토글
// query: ?id=xxx
// ════════════════════════════════════════════════════════════
async function toggleFavorite(req, res, supabase, memberId) {
  const id = req.query?.id;
  if (!id) return res.status(400).json({ code: 'missing_id' });

  // 현재 상태 조회
  const { data: current, error: fetchError } = await supabase
    .from('hairo_gallery')
    .select('id, is_favorite')
    .eq('id', id)
    .eq('member_id', memberId)
    .single();

  if (fetchError || !current) {
    return res.status(404).json({ code: 'not_found' });
  }

  // 토글
  const { data: updated, error: updateError } = await supabase
    .from('hairo_gallery')
    .update({ is_favorite: !current.is_favorite })
    .eq('id', id)
    .eq('member_id', memberId)
    .select()
    .single();

  if (updateError) {
    console.error('[hairo-gallery] update error:', updateError);
    return res.status(500).json({ code: 'update_failed' });
  }

  return res.status(200).json({ item: updated });
}

// ════════════════════════════════════════════════════════════
// DELETE — 시안 삭제 (Storage + DB)
// query: ?id=xxx
// ════════════════════════════════════════════════════════════
async function deleteItem(req, res, supabase, memberId) {
  const id = req.query?.id;
  if (!id) return res.status(400).json({ code: 'missing_id' });

  // 본인 시안 확인 + image_path 가져오기
  const { data: item, error: fetchError } = await supabase
    .from('hairo_gallery')
    .select('id, image_path')
    .eq('id', id)
    .eq('member_id', memberId)
    .single();

  if (fetchError || !item) {
    return res.status(404).json({ code: 'not_found' });
  }

  // Storage에서 파일 삭제
  await supabase.storage.from(BUCKET).remove([item.image_path]);

  // DB에서 행 삭제
  const { error: deleteError } = await supabase
    .from('hairo_gallery')
    .delete()
    .eq('id', id)
    .eq('member_id', memberId);

  if (deleteError) {
    console.error('[hairo-gallery] delete error:', deleteError);
    return res.status(500).json({ code: 'delete_failed' });
  }

  return res.status(200).json({ deleted: true, id });
}

// ════════════════════════════════════════════════════════════
// 헬퍼: 30장 초과 시 가장 오래된 것 삭제 (즐겨찾기 제외)
// ════════════════════════════════════════════════════════════
async function enforceMaxItems(supabase, memberId) {
  const { data: items } = await supabase
    .from('hairo_gallery')
    .select('id, image_path, is_favorite, created_at')
    .eq('member_id', memberId)
    .order('created_at', { ascending: true });

  if (!items || items.length < MAX_ITEMS) return;

  // 즐겨찾기 제외하고 가장 오래된 것부터 삭제
  const removable = items.filter(i => !i.is_favorite);
  const toDelete = removable.slice(0, items.length - MAX_ITEMS + 1);

  for (const item of toDelete) {
    await supabase.storage.from(BUCKET).remove([item.image_path]);
    await supabase.from('hairo_gallery').delete().eq('id', item.id);
  }
}

// ════════════════════════════════════════════════════════════
// 헬퍼: 만료된 시안 정리 (30일 지난 것)
// ════════════════════════════════════════════════════════════
async function cleanupExpired(supabase, memberId) {
  const now = new Date().toISOString();
  const { data: expired } = await supabase
    .from('hairo_gallery')
    .select('id, image_path')
    .eq('member_id', memberId)
    .lt('expires_at', now);

  if (!expired || expired.length === 0) return;

  for (const item of expired) {
    await supabase.storage.from(BUCKET).remove([item.image_path]);
    await supabase.from('hairo_gallery').delete().eq('id', item.id);
  }
}
