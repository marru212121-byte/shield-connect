// api/generate-image.js
// ═══════════════════════════════════════════════════════════════
// HAIRO 시안 생성 엔드포인트 (Nano Banana 2 호출)
// ═══════════════════════════════════════════════════════════════
// 호출 주체: hairo.html (프론트)
// 처리 흐름:
//   1. 세션 검증 (쿠키에서 member_id 추출)
//   2. 1크레딧 차감
//   3. Gemini 3.1 Flash Image (Nano Banana 2) API 호출
//   4. 응답에서 이미지 추출 → 프론트로 base64 반환
//   5. 실패 시 크레딧 자동 환불
//
// recipe.js와 거의 동일한 구조 — 차이점은:
//   - Claude API 대신 Gemini API 호출
//   - 환경변수 HAIRO_NANOBANANA2 사용
//   - 응답: text가 아니라 imageBase64 반환
// ═══════════════════════════════════════════════════════════════

import { getSessionFromRequest } from '../lib/session.js';
import { getSupabase } from '../lib/supabase.js';

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/' +
  'gemini-3.1-flash-image-preview:generateContent';

// 이미지 1장 생성 = 몇 크레딧 차감할지 (여기 한 줄만 바꾸면 단가 변경됨)
const COST_CREDITS = 1;

// Vercel: 이미지 생성은 5~15초 걸리므로 60초 타임아웃 + 6MB body limit
export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: '6mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ code: 'method_not_allowed' });
  }

  // ─── 1. 세션 검증 ────────────────────────────────────────────
  const session = getSessionFromRequest(req);
  if (!session?.memberId) {
    return res.status(401).json({
      code: 'not_authenticated',
      message: '로그인이 필요합니다.',
    });
  }
  const memberId = session.memberId;

  // ─── 2. 요청 바디 검증 ───────────────────────────────────────
  const body = req.body;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ code: 'invalid_body' });
  }

  const { prompt, referenceImageBase64, referenceMimeType, cameraInfo } = body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({
      code: 'missing_required_fields',
      message: 'prompt가 필요합니다.',
    });
  }

  // 너무 큰 이미지 거부 (8MB 이상)
  if (referenceImageBase64 && referenceImageBase64.length > 8 * 1024 * 1024) {
    return res.status(400).json({
      code: 'reference_too_large',
      message: '레퍼런스 이미지가 너무 큽니다.',
    });
  }

  // ─── 3. 환경변수 확인 ────────────────────────────────────────
  const geminiKey = process.env.HAIRO_NANOBANANA2;
  if (!geminiKey) {
    console.error('[generate-image] HAIRO_NANOBANANA2 not set');
    return res.status(500).json({ code: 'server_error' });
  }

  // ─── 4. 크레딧 차감 (RPC) ───────────────────────────────────
  const supabase = getSupabase();
  const generationRef = `hairo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const { data: consumeResult, error: consumeError } = await supabase.rpc(
    'consume_credit_by_member',
    {
      p_member_id: memberId,
      p_amount: COST_CREDITS,
      p_reference: generationRef,
    }
  );

  if (consumeError) {
    console.error('[generate-image] consume RPC failed:', consumeError);
    return res.status(500).json({ code: 'server_error' });
  }

  const result = Array.isArray(consumeResult) ? consumeResult[0] : consumeResult;
  const ok = result?.consumed === true || result?.success === true;

  if (!ok) {
    const reason = result?.reason;
    const remaining = Number(result?.credits_remaining ?? 0);

    if (reason === 'member_not_found') {
      return res.status(401).json({
        code: 'not_authenticated',
        message: '세션이 만료되었습니다. 다시 로그인해주세요.',
      });
    }

    if (reason === 'insufficient_credits' || remaining <= 0) {
      return res.status(402).json({
        code: 'insufficient_credits',
        message: '크레딧이 부족합니다. 충전 후 다시 시도해주세요.',
        credits_remaining: remaining,
      });
    }

    console.error('[generate-image] unknown consume reason:', result);
    return res.status(500).json({ code: 'server_error' });
  }

  if (result.is_admin) {
    console.log('[generate-image] admin bypass:', memberId);
  }

  // ─── 5. Gemini API 호출 ─────────────────────────────────────
  const parts = [];
  if (referenceImageBase64) {
    parts.push({
      inline_data: {
        mime_type: referenceMimeType || 'image/jpeg',
        data: referenceImageBase64,
      },
    });
  }
  parts.push({ text: prompt });

  let geminiResponse;
  try {
    geminiResponse = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiKey,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: parts }],
      }),
    });
  } catch (err) {
    console.error('[generate-image] gemini fetch failed:', err);
    await refundCredit(supabase, memberId, generationRef, result.is_admin);
    return res.status(502).json({
      code: 'gemini_error',
      message: 'AI 서버와 연결할 수 없습니다. 크레딧은 복구되었습니다.',
    });
  }

  if (!geminiResponse.ok) {
    const errorText = await geminiResponse.text();
    console.error('[generate-image] gemini error:', geminiResponse.status, errorText);
    await refundCredit(supabase, memberId, generationRef, result.is_admin);
    return res.status(502).json({
      code: 'gemini_error',
      message: '이미지 생성 중 오류가 발생했습니다. 크레딧은 복구되었습니다.',
    });
  }

  // ─── 6. 응답에서 이미지 추출 ────────────────────────────────
  const aiData = await geminiResponse.json();
  const candidate = aiData?.candidates?.[0];
  const responseParts = candidate?.content?.parts || [];

  let imagePart = null;
  let textPart = null;
  for (const p of responseParts) {
    if (p.inline_data || p.inlineData) {
      imagePart = p.inline_data || p.inlineData;
      break;
    }
    if (p.text) textPart = p.text;
  }

  if (!imagePart || !imagePart.data) {
    // 안전 필터, 차단, 빈 응답 등 — 환불
    await refundCredit(supabase, memberId, generationRef, result.is_admin);
    const finishReason = candidate?.finishReason || 'unknown';
    let userMsg = '이미지가 생성되지 않았어요. 크레딧은 복구되었습니다.';
    if (finishReason === 'SAFETY' || finishReason === 'IMAGE_SAFETY') {
      userMsg = '안전 필터에 걸렸어요. 프롬프트를 조정해주세요. 크레딧은 복구되었습니다.';
    } else if (finishReason === 'PROHIBITED_CONTENT') {
      userMsg = '제한된 콘텐츠로 분류됐어요. 크레딧은 복구되었습니다.';
    } else if (textPart) {
      userMsg = '이미지 대신 텍스트만 반환됨. 크레딧은 복구되었습니다.';
    }
    return res.status(422).json({
      code: 'no_image',
      message: userMsg,
      finishReason,
    });
  }

  // ─── 7. 성공 응답 ───────────────────────────────────────────
  return res.status(200).json({
    imageBase64: imagePart.data,
    mimeType: imagePart.mime_type || imagePart.mimeType || 'image/png',
    credits_remaining: result.credits_remaining,
    is_admin: result.is_admin,
    cameraInfo: cameraInfo || null,
  });
}

// ============================================================
// 크레딧 환불 (recipe.js와 완전히 동일한 패턴)
// ============================================================
async function refundCredit(supabase, memberId, reference, isAdmin) {
  if (isAdmin) return;

  try {
    const { data: member } = await supabase
      .from('cafe24_member_credits')
      .select('credits_remaining, total_used')
      .eq('member_id', memberId)
      .single();

    if (member) {
      await supabase
        .from('cafe24_member_credits')
        .update({
          credits_remaining: (member.credits_remaining ?? 0) + COST_CREDITS,
          total_used: Math.max(0, (member.total_used ?? 0) - COST_CREDITS),
          updated_at: new Date().toISOString(),
        })
        .eq('member_id', memberId);

      await supabase.from('credit_ledger').insert({
        member_id: memberId,
        type: 'refund',
        amount: COST_CREDITS,
        balance_after: (member.credits_remaining ?? 0) + COST_CREDITS,
        reference,
        note: 'HAIRO 이미지 생성 실패 자동 환불',
      });
    }
  } catch (err) {
    console.error('[generate-image] refund failed:', err);
  }
}
