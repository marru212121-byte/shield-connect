// api/generate-image.js
// ═══════════════════════════════════════════════════════════════
// HAIRO 사진 생성 엔드포인트 (Nano Banana 2 호출)
// ═══════════════════════════════════════════════════════════════
// 호출 주체: hairo.html (프론트)
// 처리 흐름:
//   1. 세션 검증 (쿠키에서 member_id 추출)
//   2. 1크레딧 차감
//   3. 프롬프트 합성: 인물 코어 → 앵글(가이드) → 디자이너 입력 → 해상도
//      ⭐ 디자이너 입력이 마지막 = AI에 가장 강하게 인식
//   4. Gemini 3.1 Flash Image (Nano Banana 2) Streaming API 호출
//      ⭐ generateContent 대신 streamGenerateContent 사용
//        - 첫 청크 즉시 받기 시작 → socket hang 방지
//        - 1차 timeout 후 2차 재시도 패턴 해소
//   5. Streaming 실패 시 일반 호출로 자동 fallback
//   6. 응답에서 이미지 추출 → 프론트로 base64 반환
//   7. 실패 시 크레딧 자동 환불
// ═══════════════════════════════════════════════════════════════

import { getSessionFromRequest } from '../lib/session.js';
import { getSupabase } from '../lib/supabase.js';

// Streaming 엔드포인트 (alt=sse 추가하면 SSE 형식)
const GEMINI_STREAM_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/' +
  'gemini-3.1-flash-image-preview:streamGenerateContent?alt=sse';

// Fallback: 일반 엔드포인트 (streaming 실패 시)
const GEMINI_NORMAL_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/' +
  'gemini-3.1-flash-image-preview:generateContent';

// 이미지 1장 생성 = 몇 크레딧 차감할지
const COST_CREDITS = 1;

// 참조 사진 최대 장수
const MAX_REFERENCES = 5;

// ─── 인물 코어 (항상 자동 적용, 디자이너에게 노출 X) ────────────
const PERSON_CORE = `photorealistic image,

smooth natural skin with very fine pore detail,
flawless yet realistic skin,
no plastic doll-like skin,
no acne, no pimples, no scars, no blemishes,

individual hair strand visibility,
visible hair gloss and natural shine,
a few subtle flyaway strands near hairline,
realistic hair root density,

no AI smoothing artifacts,
authentic raw photo quality`;

// Vercel 설정
export const config = {
  maxDuration: 180,
  api: {
    bodyParser: {
      sizeLimit: '30mb',
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

  const {
    userPrompt,
    aspectPrompt,
    aspectRatio,
    anglePrompt,
    angle,
    references,
  } = body;

  if (!userPrompt || typeof userPrompt !== 'string') {
    return res.status(400).json({
      code: 'missing_required_fields',
      message: '프롬프트를 입력해주세요.',
    });
  }

  // 참조 사진 검증
  let refs = Array.isArray(references) ? references : [];
  if (refs.length > MAX_REFERENCES) {
    return res.status(400).json({
      code: 'too_many_references',
      message: `참조 사진은 최대 ${MAX_REFERENCES}장까지 첨부 가능합니다.`,
    });
  }
  for (const r of refs) {
    if (!r?.base64 || typeof r.base64 !== 'string') {
      return res.status(400).json({ code: 'invalid_reference' });
    }
    if (r.base64.length > 8 * 1024 * 1024) {
      return res.status(400).json({
        code: 'reference_too_large',
        message: '참조 사진 중 너무 큰 이미지가 있어요.',
      });
    }
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
      return res.status(401).json({ code: 'not_authenticated', message: '세션이 만료되었습니다. 다시 로그인해주세요.' });
    }
    if (reason === 'insufficient_credits' || remaining <= 0) {
      return res.status(402).json({ code: 'insufficient_credits', message: '크레딧이 부족합니다.', credits_remaining: remaining });
    }
    console.error('[generate-image] unknown consume reason:', result);
    return res.status(500).json({ code: 'server_error' });
  }

  if (result.is_admin) {
    console.log('[generate-image] admin bypass:', memberId);
  }

  // ─── 5. 최종 프롬프트 합성 ──────────────────────────────────
  // ⭐ 새 순서: 코어 → 앵글(가이드) → 디자이너 입력(MAIN) → 해상도
  // 디자이너 입력이 "MAIN INSTRUCTION" 라벨로 명시 → AI가 우선시
  // 앵글은 "guideline"으로 약화 → 디자이너 입력과 충돌 시 디자이너 우선
  const promptParts = [PERSON_CORE];

  if (anglePrompt && typeof anglePrompt === 'string') {
    promptParts.push(
      `camera angle guideline (this is just a reference; the subject's expression, gaze direction, and emotional state described in the MAIN INSTRUCTION below take priority over this camera angle): ${anglePrompt}`
    );
  }

  // ⭐ 디자이너 입력 = 가장 강한 위치 + 명시적 라벨
  promptParts.push(`MAIN INSTRUCTION (highest priority - follow this exactly): ${userPrompt.trim()}`);

  promptParts.push(aspectPrompt || 'vertical 9:16 aspect ratio, portrait orientation');

  const finalPrompt = promptParts.join('\n\n');

  // ─── 6. Gemini API 호출 ─────────────────────────────────────
  const parts = [];
  for (const r of refs) {
    parts.push({
      inline_data: {
        mime_type: r.mimeType || 'image/jpeg',
        data: r.base64,
      },
    });
  }
  parts.push({ text: finalPrompt });

  const aspectForApi = ['9:16', '16:9', '4:5', '1:1'].includes(aspectRatio)
    ? aspectRatio
    : '9:16';

  const requestBody = JSON.stringify({
    contents: [{ role: 'user', parts: parts }],
    generationConfig: {
      imageConfig: {
        aspectRatio: aspectForApi,
      },
    },
  });

  console.log(`[generate-image] starting`, {
    promptLen: finalPrompt.length,
    refsCount: refs.length,
    aspectRatio: aspectForApi,
  });

  // ── 1차: Streaming 시도 ──
  let imagePart = null;
  let textPart = null;
  let finishReason = null;
  let lastError = null;

  try {
    const streamResult = await callGeminiStream(GEMINI_STREAM_URL, geminiKey, requestBody);
    imagePart = streamResult.imagePart;
    textPart = streamResult.textPart;
    finishReason = streamResult.finishReason;
    console.log(`[generate-image] streaming success in ${streamResult.elapsedMs}ms`);
  } catch (streamErr) {
    lastError = streamErr;
    console.error(`[generate-image] streaming failed: ${streamErr.name} - ${streamErr.message}`);

    // ── 2차 fallback: 일반 호출 ──
    try {
      console.log('[generate-image] falling back to normal endpoint');
      const fallbackResult = await callGeminiNormal(GEMINI_NORMAL_URL, geminiKey, requestBody);
      imagePart = fallbackResult.imagePart;
      textPart = fallbackResult.textPart;
      finishReason = fallbackResult.finishReason;
      console.log(`[generate-image] fallback success in ${fallbackResult.elapsedMs}ms`);
    } catch (fallbackErr) {
      console.error(`[generate-image] fallback failed: ${fallbackErr.name} - ${fallbackErr.message}`);
      await refundCredit(supabase, memberId, generationRef, result.is_admin);

      if (fallbackErr.name === 'AbortError' || streamErr.name === 'AbortError') {
        return res.status(504).json({
          code: 'gemini_timeout',
          message: 'AI 서버 응답이 느려요. 잠시 후 다시 시도해주세요. 크레딧은 복구되었습니다.',
        });
      }
      if (fallbackErr.status) {
        return res.status(502).json({
          code: 'gemini_error',
          message: '이미지 생성 중 오류가 발생했습니다. 크레딧은 복구되었습니다.',
          debug: { status: fallbackErr.status, detail: fallbackErr.detail || '' },
        });
      }
      return res.status(502).json({
        code: 'gemini_error',
        message: 'AI 서버와 연결할 수 없습니다. 크레딧은 복구되었습니다.',
        debug: { error: fallbackErr.message },
      });
    }
  }

  // ─── 7. 응답에서 이미지 추출 ────────────────────────────────
  if (!imagePart || !imagePart.data) {
    await refundCredit(supabase, memberId, generationRef, result.is_admin);
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

  // ─── 8. 성공 응답 ───────────────────────────────────────────
  return res.status(200).json({
    imageBase64: imagePart.data,
    mimeType: imagePart.mime_type || imagePart.mimeType || 'image/png',
    credits_remaining: result.credits_remaining,
    is_admin: result.is_admin,
    aspectRatio: aspectRatio || '9:16',
    angle: angle || null,
  });
}

// ════════════════════════════════════════════════════════════
// Streaming 호출 헬퍼 (SSE 파싱)
// ════════════════════════════════════════════════════════════
async function callGeminiStream(url, apiKey, requestBody) {
  const startTime = Date.now();
  const controller = new AbortController();
  // 60초 timeout - streaming은 첫 청크가 빨리 와야 정상
  const timeoutId = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
        'Accept': 'text/event-stream',
      },
      body: requestBody,
      signal: controller.signal,
    });

    if (!response.ok) {
      clearTimeout(timeoutId);
      const errorText = await response.text();
      const err = new Error(`stream HTTP ${response.status}`);
      err.status = response.status;
      err.detail = errorText.slice(0, 500);
      throw err;
    }

    if (!response.body) {
      clearTimeout(timeoutId);
      throw new Error('no response body');
    }

    // SSE 파싱
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let imagePart = null;
    let textPart = null;
    let finishReason = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE 형식: "data: {...}\n\n"
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 마지막 미완성 줄 보존

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const dataStr = line.slice(6).trim();
        if (!dataStr || dataStr === '[DONE]') continue;

        try {
          const chunk = JSON.parse(dataStr);
          const candidate = chunk?.candidates?.[0];
          if (candidate?.finishReason) finishReason = candidate.finishReason;

          const chunkParts = candidate?.content?.parts || [];
          for (const p of chunkParts) {
            if (p.inline_data || p.inlineData) {
              imagePart = p.inline_data || p.inlineData;
            }
            if (p.text) textPart = (textPart || '') + p.text;
          }
        } catch (parseErr) {
          // 무시 — 일부 청크가 깨질 수 있음
        }
      }
    }

    clearTimeout(timeoutId);
    return {
      imagePart,
      textPart,
      finishReason,
      elapsedMs: Date.now() - startTime,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// ════════════════════════════════════════════════════════════
// 일반 호출 헬퍼 (Fallback - 45초 timeout)
// ════════════════════════════════════════════════════════════
async function callGeminiNormal(url, apiKey, requestBody) {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: requestBody,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      const err = new Error(`normal HTTP ${response.status}`);
      err.status = response.status;
      err.detail = errorText.slice(0, 500);
      throw err;
    }

    const aiData = await response.json();
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

    return {
      imagePart,
      textPart,
      finishReason: candidate?.finishReason || null,
      elapsedMs: Date.now() - startTime,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// ════════════════════════════════════════════════════════════
// 크레딧 환불
// ════════════════════════════════════════════════════════════
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
