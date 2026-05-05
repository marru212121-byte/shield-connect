// api/generate-image.js
// ═══════════════════════════════════════════════════════════════
// HAIRO 사진 생성 엔드포인트 (Nano Banana 2 호출)
// ═══════════════════════════════════════════════════════════════
// 호출 주체: hairo.html (프론트)
// 처리 흐름:
//   1. 세션 검증 (쿠키에서 member_id 추출)
//   2. 1크레딧 차감
//   3. 프롬프트 합성: 인물 코어 + 디자이너 입력 + 해상도 + (앵글)
//   4. Gemini 3.1 Flash Image (Nano Banana 2) API 호출
//   5. 응답에서 이미지 추출 → 프론트로 base64 반환
//   6. 실패 시 크레딧 자동 환불
//
// 입력 payload (프론트 → 백엔드):
//   {
//     userPrompt:    string,  // 디자이너가 직접 친 프롬프트
//     aspectPrompt:  string,  // "vertical 3:4 aspect ratio, ..."
//     aspectRatio:   "9:16" | "16:9" | "4:5" | "1:1",  // 표시용
//     anglePrompt?:  string,  // 앵글 켰을 때만, "camera position: yaw ..."
//     angle?:        { yaw, pitch, frameIdx },
//     references?:   [{ base64, mimeType }, ...]  // 최대 5장
//   }
// ═══════════════════════════════════════════════════════════════

import { getSessionFromRequest } from '../lib/session.js';
import { getSupabase } from '../lib/supabase.js';

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/' +
  'gemini-3.1-flash-image-preview:generateContent';

// 이미지 1장 생성 = 몇 크레딧 차감할지
const COST_CREDITS = 1;

// 참조 사진 최대 장수 (Nano Banana 2는 14장까지 지원하지만 안정성 위해 5장 제한)
const MAX_REFERENCES = 5;

// ─── 인물 코어 (항상 자동 적용, 디자이너에게 노출 X) ────────────
// 충돌 검수 완료된 11줄 다이어트 버전
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
      sizeLimit: '30mb', // 5장 × 최대 6MB 정도까지 여유
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
  // 각 ref가 너무 크면 거부 (8MB 이상)
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
  // 순서: 인물 코어 → 디자이너 입력 → 해상도 → 앵글(옵션)
  // 디자이너 자유 입력이 가운데 와야 모델이 "주된 명령"으로 인식
  const promptParts = [
    PERSON_CORE,
    userPrompt.trim(),
    aspectPrompt || 'vertical 9:16 aspect ratio, portrait orientation',
  ];
  if (anglePrompt && typeof anglePrompt === 'string') {
    promptParts.push(anglePrompt);
  }
  const finalPrompt = promptParts.join(',\n\n');

  // ─── 6. Gemini API 호출 ─────────────────────────────────────
  // parts: 참조 사진들 → 프롬프트 텍스트
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

  // 해상도는 API 파라미터로 하드 강제 (텍스트 + 파라미터 이중 보장)
  const aspectForApi = ['9:16', '16:9', '4:5', '1:1'].includes(aspectRatio)
    ? aspectRatio
    : '9:16';

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
        generationConfig: {
          imageConfig: {
            aspectRatio: aspectForApi,
          },
        },
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
    const status = geminiResponse.status;
    console.error('[generate-image] gemini error:', status, errorText);

    // 에러 본문에서 핵심 단서 추출
    let errDetail = '';
    let userHint = '';
    try {
      const errJson = JSON.parse(errorText);
      errDetail = errJson?.error?.message || errJson?.error?.status || '';
    } catch (_) {
      errDetail = errorText.slice(0, 200);
    }

    if (status === 400) {
      userHint = '요청 형식 오류 (모델명/파라미터 확인 필요)';
    } else if (status === 401 || status === 403) {
      userHint = 'API 키 인증 실패 (Vercel 환경변수 또는 키 권한)';
    } else if (status === 404) {
      userHint = '모델을 찾을 수 없음 (모델명 변경 가능)';
    } else if (status === 429) {
      userHint = 'API 사용량 한도 초과 또는 결제 등록 필요';
    } else if (status >= 500) {
      userHint = 'Google AI 서버 일시 오류';
    }

    await refundCredit(supabase, memberId, generationRef, result.is_admin);
    return res.status(502).json({
      code: 'gemini_error',
      message: '이미지 생성 중 오류가 발생했습니다. 크레딧은 복구되었습니다.',
      // 디버깅용 (관리자만 봄, 일반 사용자에겐 안 보임)
      debug: {
        status,
        hint: userHint,
        detail: errDetail.slice(0, 500),
      },
    });
  }

  // ─── 7. 응답에서 이미지 추출 ────────────────────────────────
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

// ============================================================
// 크레딧 환불 (recipe.js와 동일한 패턴)
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
