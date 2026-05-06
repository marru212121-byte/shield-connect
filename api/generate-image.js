// api/generate-image.js
// ═══════════════════════════════════════════════════════════════
// HAIRO 사진 생성 엔드포인트 (Vertex AI Nano Banana 2 호출)
// ═══════════════════════════════════════════════════════════════
// 호출 주체: hairo.html (프론트)
//
// 처리 흐름:
//   1. 세션 검증 (쿠키에서 member_id 추출)
//   2. 1크레딧 차감
//   3. 프롬프트 합성 (4축 직교):
//      [무드] → [프레이밍] → [앵글(가이드)] → [디자이너 MAIN] → [해상도]
//      ⭐ 무드 = 'hair_skin_precision'/'editorial_lookbook'/'y2k'/null(자유)
//      ⭐ 프레이밍 = 'chest_up'/'upper_body'/'full_body'/null
//      ⭐ 무드 null = 코어 X = 카탈로그/제품 자유 모드
//      ⭐ 디자이너 MAIN = 가장 강한 위치 (시선/표정 우선)
//   4. 3단 Fallback 체인 호출:
//      ① Vertex AI 서울 (asia-northeast3) Streaming     ← 1차
//      ② Vertex AI 글로벌 (global) Streaming             ← 2차
//      ③ Generative Language API (HAIRO_NANOBANANA2)     ← 3차 안전망
//   5. 응답에서 이미지 추출 → 프론트로 base64 반환
//   6. 모든 fallback 실패 시 크레딧 자동 환불
// ═══════════════════════════════════════════════════════════════

import { getSessionFromRequest } from '../lib/session.js';
import { getSupabase } from '../lib/supabase.js';
import { getVertexAccessToken, getProjectId } from '../lib/vertex-auth.js';

// ─── Vertex AI 엔드포인트 (1차/2차) ──────────────────────────────
const VERTEX_MODEL = 'gemini-3.1-flash-image-preview';

function buildVertexUrl(region, projectId) {
  // region: 'asia-northeast3' (서울) | 'global'
  const host = region === 'global'
    ? 'aiplatform.googleapis.com'
    : `${region}-aiplatform.googleapis.com`;
  return `https://${host}/v1/projects/${projectId}/locations/${region}/publishers/google/models/${VERTEX_MODEL}:streamGenerateContent?alt=sse`;
}

// ─── Generative Language API (3차 안전망) ───────────────────────
const GEMINI_STREAM_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/' +
  'gemini-3.1-flash-image-preview:streamGenerateContent?alt=sse';

const GEMINI_NORMAL_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/' +
  'gemini-3.1-flash-image-preview:generateContent';

// 이미지 1장 생성 = 몇 크레딧 차감할지
const COST_CREDITS = 1;

// 참조 사진 최대 장수
const MAX_REFERENCES = 5;

// ─── 무드 프리셋 ────────────────────────────────────────────────
// 디자이너가 무드 안 고르면(`null`) 코어 X = 완전 자유 (카탈로그/제품용)
// 무드 선택 시 해당 프리셋이 코어 역할도 함 (피부/머리 디테일 포함)
const MOOD_PRESETS = {
  // 헤어·피부 정밀 — 시술 검토용
  hair_skin_precision: `photorealistic image,
authentic raw photo quality,

smooth natural skin with very fine pore detail,
flawless yet realistic skin,
no plastic doll-like skin,
no acne, no pimples, no scars, no blemishes,

individual hair strand visibility,
visible hair gloss and natural shine,
a few subtle flyaway strands near hairline,
realistic hair root density,

natural facial asymmetry,
realistic catchlight in eyes,
authentic micro-expressions,

studio or salon natural lighting,
neutral color tone,
soft shadows,

no AI smoothing artifacts,
authentic raw photo grain`,

  // 화보·룩북 — 포트폴리오/매장 비주얼/SNS 마케팅
  editorial_lookbook: `photorealistic image,
high-end fashion editorial aesthetic,
single frame composition,

refined color grading,
warm highlights with cool shadows,
balanced contrast with rich blacks,
soft directional lighting,

clean polished skin,
editorial-grade skin tone finish,
defined hair detail with sharp strand separation,
precise hair texture rendering,

shot on medium format camera with prime lens,
shallow depth of field with smooth bokeh,
sharp clear focus on subject,

fine subtle film grain,
print-quality magazine finish,
refined studio atmosphere or minimal salon environment,
professional lighting setup`,

  // Y2K — 트렌디 SNS / 인플루언서 룩
  y2k: `photorealistic image,
2000s korean influencer aesthetic,
single frame composition,

warm peach and pink tones,
soft pinkish skin glow,
slightly idealized smooth skin,
subtle natural blush on cheeks and nose tip,
glossy lip pearl shine,

pearl highlight on hair strands,
soft hair sheen,
gentle flyaway strands,

warm indoor evening lighting,
yellow-pink ambient warmth,
soft glow filter,

2000s digital camera nostalgia,
slight film grain texture,
vintage digicam color palette,

trendy korean instagram aesthetic,
influencer-style soft retouch,
emotional warm atmosphere`,
};

// ─── 프레이밍 프리셋 ────────────────────────────────────────────
const FRAMING_PRESETS = {
  chest_up: 'chest-up framing, subject from upper chest to head, hair fully visible',
  upper_body: 'upper body framing, subject from waist to head with shoulders fully shown',
  full_body: 'full body framing, head to feet visible, subject standing or seated naturally',
};

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
    mood,        // ⭐ NEW: 'hair_skin_precision' | 'editorial_lookbook' | 'y2k' | null
    framing,     // ⭐ NEW: 'chest_up' | 'upper_body' | 'full_body' | null
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
  // 합성 순서: [무드] → [프레이밍] → [앵글(가이드)] → [디자이너 MAIN] → [해상도]
  //
  // 정책:
  //   - 무드 = null (디폴트) → 코어 X = 완전 자유 (카탈로그/제품/공간 등)
  //   - 무드 선택 시 → 해당 프리셋이 코어 역할 (피부/머리/조명까지 정의)
  //   - 프레이밍 선택 시 → 가슴선/상반신/전신 한 줄 추가
  //   - 앵글 = 가이드라인으로 약화 (시선/표정은 MAIN 우선)
  //   - 디자이너 MAIN = 가장 강한 위치 + 명시적 라벨
  const promptParts = [];

  // ⭐ 무드 (선택사항, 디폴트 = 무드 X = 자유)
  if (mood && typeof mood === 'string' && MOOD_PRESETS[mood]) {
    promptParts.push(MOOD_PRESETS[mood]);
  }

  // ⭐ 프레이밍 (선택사항)
  if (framing && typeof framing === 'string' && FRAMING_PRESETS[framing]) {
    promptParts.push(FRAMING_PRESETS[framing]);
  }

  // 앵글 가이드라인 (충돌 위험 있어 약화 표현)
  if (anglePrompt && typeof anglePrompt === 'string') {
    promptParts.push(
      `camera angle guideline (this is just a reference; the subject's expression, gaze direction, and emotional state described in the MAIN INSTRUCTION below take priority over this camera angle): ${anglePrompt}`
    );
  }

  // 디자이너 입력 = 가장 강한 위치 + 명시적 라벨
  promptParts.push(`MAIN INSTRUCTION (highest priority - follow this exactly): ${userPrompt.trim()}`);

  // 해상도 비율
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
    mood: mood || null,
    framing: framing || null,
  });

  // ── 3단 Fallback 체인 ─────────────────────────────────────
  let imagePart = null;
  let textPart = null;
  let finishReason = null;
  let lastError = null;
  let route = null; // 어느 경로로 성공했는지 디버그용

  // ── 1차: Vertex AI 서울 (asia-northeast3) Streaming ──
  try {
    const accessToken = await getVertexAccessToken();
    const projectId = getProjectId();
    const seoulUrl = buildVertexUrl('asia-northeast3', projectId);
    const r1 = await callVertexStream(seoulUrl, accessToken, requestBody);
    imagePart = r1.imagePart;
    textPart = r1.textPart;
    finishReason = r1.finishReason;
    route = 'vertex-seoul-stream';
    console.log(`[generate-image] vertex-seoul stream success in ${r1.elapsedMs}ms`);
  } catch (e1) {
    lastError = e1;
    console.error(`[generate-image] vertex-seoul stream failed: ${e1.name} - ${e1.message}`);

    // ── 2차: Vertex AI 글로벌 (global) Streaming ──
    try {
      const accessToken = await getVertexAccessToken();
      const projectId = getProjectId();
      const globalUrl = buildVertexUrl('global', projectId);
      const r2 = await callVertexStream(globalUrl, accessToken, requestBody);
      imagePart = r2.imagePart;
      textPart = r2.textPart;
      finishReason = r2.finishReason;
      route = 'vertex-global-stream';
      console.log(`[generate-image] vertex-global stream success in ${r2.elapsedMs}ms`);
    } catch (e2) {
      lastError = e2;
      console.error(`[generate-image] vertex-global stream failed: ${e2.name} - ${e2.message}`);

      // ── 3차 안전망: Generative Language API (Legacy) ──
      try {
        console.log('[generate-image] falling back to legacy endpoint (Generative Language API)');
        const r3 = await callGeminiStream(GEMINI_STREAM_URL, geminiKey, requestBody);
        imagePart = r3.imagePart;
        textPart = r3.textPart;
        finishReason = r3.finishReason;
        route = 'legacy-stream';
        console.log(`[generate-image] legacy stream success in ${r3.elapsedMs}ms`);
      } catch (e3) {
        lastError = e3;
        console.error(`[generate-image] legacy stream failed: ${e3.name} - ${e3.message}`);

        // 마지막 시도: legacy normal 호출
        try {
          console.log('[generate-image] last resort: legacy normal endpoint');
          const r4 = await callGeminiNormal(GEMINI_NORMAL_URL, geminiKey, requestBody);
          imagePart = r4.imagePart;
          textPart = r4.textPart;
          finishReason = r4.finishReason;
          route = 'legacy-normal';
          console.log(`[generate-image] legacy normal success in ${r4.elapsedMs}ms`);
        } catch (e4) {
          console.error(`[generate-image] all fallbacks failed: ${e4.name} - ${e4.message}`);
          await refundCredit(supabase, memberId, generationRef, result.is_admin);

          if (e4.name === 'AbortError' || e3.name === 'AbortError' ||
              e2.name === 'AbortError' || e1.name === 'AbortError') {
            return res.status(504).json({
              code: 'gemini_timeout',
              message: 'AI 서버 응답이 느려요. 잠시 후 다시 시도해주세요. 크레딧은 복구되었습니다.',
            });
          }
          if (e4.status) {
            return res.status(502).json({
              code: 'gemini_error',
              message: '이미지 생성 중 오류가 발생했습니다. 크레딧은 복구되었습니다.',
              debug: { status: e4.status, detail: e4.detail || '' },
            });
          }
          return res.status(502).json({
            code: 'gemini_error',
            message: 'AI 서버와 연결할 수 없습니다. 크레딧은 복구되었습니다.',
            debug: { error: e4.message },
          });
        }
      }
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
    route: route, // 디버그용: vertex-seoul-stream | vertex-global-stream | legacy-stream | legacy-normal
  });
}

// ════════════════════════════════════════════════════════════
// Streaming 호출 헬퍼 (SSE 파싱 + 첫 토큰 timeout)
// ════════════════════════════════════════════════════════════
// ⭐ 핵심: "첫 토큰 8초 timeout" + "전체 45초 timeout"
//   - 첫 토큰 8초 안 오면 = Google API hang으로 판단 → 즉시 abort
//   - 첫 토큰 받으면 전체 timeout만 적용 (정상 응답은 영향 0)
//   - hang 케이스의 worst case를 60초 → 8초로 단축
async function callGeminiStream(url, apiKey, requestBody) {
  const startTime = Date.now();
  const controller = new AbortController();

  const FIRST_TOKEN_TIMEOUT_MS = 8000;   // 첫 토큰 안 오면 hang으로 판단
  const TOTAL_TIMEOUT_MS = 45000;        // 첫 토큰 받은 후 전체 응답 timeout

  // 1. 전체 timeout (안전망)
  const totalTimeoutId = setTimeout(() => {
    controller.abort('total_timeout');
  }, TOTAL_TIMEOUT_MS);

  // 2. 첫 토큰 timeout (hang 감지)
  let firstTokenReceived = false;
  let abortReason = null;
  const firstTokenTimeoutId = setTimeout(() => {
    if (!firstTokenReceived) {
      abortReason = 'first_token_timeout';
      controller.abort('first_token_timeout');
    }
  }, FIRST_TOKEN_TIMEOUT_MS);

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
      clearTimeout(totalTimeoutId);
      clearTimeout(firstTokenTimeoutId);
      const errorText = await response.text();
      const err = new Error(`stream HTTP ${response.status}`);
      err.status = response.status;
      err.detail = errorText.slice(0, 500);
      throw err;
    }

    if (!response.body) {
      clearTimeout(totalTimeoutId);
      clearTimeout(firstTokenTimeoutId);
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

      // ⭐ 첫 청크 도착 → 첫 토큰 timeout 해제
      if (!firstTokenReceived) {
        firstTokenReceived = true;
        clearTimeout(firstTokenTimeoutId);
        console.log(`[generate-image] first token received in ${Date.now() - startTime}ms`);
      }

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

    clearTimeout(totalTimeoutId);
    clearTimeout(firstTokenTimeoutId);
    return {
      imagePart,
      textPart,
      finishReason,
      elapsedMs: Date.now() - startTime,
    };
  } catch (err) {
    clearTimeout(totalTimeoutId);
    clearTimeout(firstTokenTimeoutId);
    // 첫 토큰 timeout으로 abort된 경우 명시
    if (err.name === 'AbortError' && abortReason === 'first_token_timeout') {
      const e = new Error('first token timeout (8s) - Google API hang');
      e.name = 'AbortError';
      e.firstTokenTimeout = true;
      throw e;
    }
    throw err;
  }
}

// ════════════════════════════════════════════════════════════
// Vertex AI Streaming 호출 헬퍼 (1차/2차 fallback)
// ════════════════════════════════════════════════════════════
// callGeminiStream과 동일 구조, 인증만 다름 (Bearer 토큰)
async function callVertexStream(url, accessToken, requestBody) {
  const startTime = Date.now();
  const controller = new AbortController();

  const FIRST_TOKEN_TIMEOUT_MS = 8000;
  const TOTAL_TIMEOUT_MS = 45000;

  const totalTimeoutId = setTimeout(() => {
    controller.abort('total_timeout');
  }, TOTAL_TIMEOUT_MS);

  let firstTokenReceived = false;
  let abortReason = null;
  const firstTokenTimeoutId = setTimeout(() => {
    if (!firstTokenReceived) {
      abortReason = 'first_token_timeout';
      controller.abort('first_token_timeout');
    }
  }, FIRST_TOKEN_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'text/event-stream',
      },
      body: requestBody,
      signal: controller.signal,
    });

    if (!response.ok) {
      clearTimeout(totalTimeoutId);
      clearTimeout(firstTokenTimeoutId);
      const errorText = await response.text();
      const err = new Error(`stream HTTP ${response.status}`);
      err.status = response.status;
      err.detail = errorText.slice(0, 500);
      throw err;
    }

    if (!response.body) {
      clearTimeout(totalTimeoutId);
      clearTimeout(firstTokenTimeoutId);
      throw new Error('no response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let imagePart = null;
    let textPart = null;
    let finishReason = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      if (!firstTokenReceived) {
        firstTokenReceived = true;
        clearTimeout(firstTokenTimeoutId);
        console.log(`[generate-image] vertex first token received in ${Date.now() - startTime}ms`);
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

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
          // 무시
        }
      }
    }

    clearTimeout(totalTimeoutId);
    clearTimeout(firstTokenTimeoutId);
    return {
      imagePart,
      textPart,
      finishReason,
      elapsedMs: Date.now() - startTime,
    };
  } catch (err) {
    clearTimeout(totalTimeoutId);
    clearTimeout(firstTokenTimeoutId);
    if (err.name === 'AbortError' && abortReason === 'first_token_timeout') {
      const e = new Error('vertex first token timeout (8s)');
      e.name = 'AbortError';
      e.firstTokenTimeout = true;
      throw e;
    }
    throw err;
  }
}

// ════════════════════════════════════════════════════════════
// 일반 호출 헬퍼 (Fallback - 30초 timeout)
// ════════════════════════════════════════════════════════════
async function callGeminiNormal(url, apiKey, requestBody) {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

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
