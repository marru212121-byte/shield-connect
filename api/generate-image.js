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
//      ⭐ 무드 = 'natural'/'editorial_lookbook'/'y2k'/'studio_profile'/null(자유 입력)
//      ⭐ 프레이밍 = 'chest_up'/'upper_body'/'knee_up'/null
//      ⭐ 무드 null = 코어 X = 카탈로그/제품 자유 모드
//      ⭐ 디자이너 입력 = 본문만 (강조 라벨 제거됨 — Y2K/룩북 무드 살리기)
//   4. 2단 Fallback 체인 호출 (v6.3 변경: 4단 → 2단 단순화):
//      ① Vertex AI 글로벌 (global) Streaming             ← 1차 (90초 timeout)
//      ② Generative Language API (HAIRO_NANOBANANA2)     ← 2차 안전망 (60초)
//      ※ 서울 리전 제거: 구글 공식 Gemini 2.5+ preview = global only
//      ※ 누적 150초 → Vercel 180초 마진 30초 → logFailure 100% 도달
//   5. 응답에서 이미지 추출 → 프론트로 base64 반환
//   6. 모든 fallback 실패 시 크레딧 자동 환불
// ═══════════════════════════════════════════════════════════════

import { getSessionFromRequest } from '../lib/session.js';
import { getSupabase } from '../lib/supabase.js';
import { getVertexAccessToken, getProjectId } from '../lib/vertex-auth.js';
import { logSuccess, logFailure, logAiCall } from '../lib/ai-log-helper.js';

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
  // 룩북 — 잡지 화보 톤. 포트폴리오/매장 비주얼/SNS 마케팅
  editorial_lookbook: `photorealistic image,
individual hair strand visibility,
natural hair shine,
realistic hair root density,
influencer soft retouch,
slightly idealized smooth skin,
glossy lip pearl shine,
high-end fashion editorial,
medium format camera with prime lens,
shallow depth of field,
soft directional lighting,
refined color grading,
subtle film grain`,

  // 네츄럴 — 인플루언서 셀카 톤 + 아이폰 디테일 (v6.3)
  // v6.2 → v6.3: smartphone 단어 제거 (핸드폰 등장 버그), 일상톤 키워드 제거 (아줌마톤 회피)
  //               인플루언서 + 아이폰 + 글로우로 톤 재구성
  natural: `photorealistic image,
individual hair strand visibility,
natural hair shine,
realistic hair root density,
influencer soft retouch,
slightly idealized smooth skin,
glossy lip pearl shine,
dewy skin glow,
Instagram influencer aesthetic,
iPhone photo realism,
polished casual look,
visible film grain,
digital noise particles,
authentic camera sensor noise`,

  // Y2K — 2000년대 파파라치/데카당스 톤 (v6.3)
  // v6.2 → v6.3: soft glow filter 제거 (파파라치 톤과 충돌)
  //               그레인/노이즈 강화, 정면 플래시 + 노출 과다 추가
  y2k: `2000s digital camera nostalgia,
heavy film grain,
digital noise particles,
vintage digicam color palette,
influencer soft retouch,
slightly idealized smooth skin,
glossy lip pearl shine,
soft hair shine,
flyaway hair strands,
direct on-camera flash,
slight overexposure on face,
high contrast shadows,
paparazzi flash aesthetic`,

  // 스튜디오 프로필사진 — 깔끔한 스튜디오 매거진/프로필 톤
  // 룩북과 차별점: 그레인/얕은심도 없음 → 선명한 초점 + 균일한 하이키 스튜디오 조명 + 클린 리터치
  studio_profile: `professional studio profile photo,
studio headshot style,
photorealistic image,
individual hair strand visibility,
natural hair shine,
realistic hair root density,
influencer soft retouch,
seamless neutral studio backdrop,
even softbox studio lighting,
bright high-key lighting,
front key light with catchlight in eyes,
soft beauty dish lighting,
crisp sharp focus,
magazine cover quality,
commercial beauty retouch,
slightly idealized smooth skin,
glossy lip pearl shine,
clean color grading,
high clarity and fine detail`,

  // 4분할컷 — 동일인물 캐릭터 시트 (정면/¾/옆/뒤) · 핸드폰 실사 · 한국 인플루언서 톤
  // 힉스필드 9:16 검증 프롬프트 그대로. framing/aspect는 아래 조립부에서 자동 고정.
  quad_sheet: `Character reference sheet of the SAME woman from the reference photo — identical face, hairstyle, hair color, hair length, and the same bangs and side-swept layers EXACTLY as the reference. One single image, 2x2 grid of 4 panels, same person and identical hair in all panels. Four DIFFERENT angles:
- TOP-LEFT: front view, face straight to camera.
- TOP-RIGHT: three-quarter 45 degree view, face and side hair flow visible.
- BOTTOM-LEFT: side profile view, side silhouette of the hair. IF the hairstyle has side bangs, tuck the side hair behind the ear so the ear is exposed, while the side bangs fall forward along the cheekbone and face line — making the side bangs stand out against the exposed ear.
- BOTTOM-RIGHT: straight back view, back of the head facing camera, face not visible, full hair length from behind.
MOOD — shot on a smartphone, iPhone photo realism, subtle natural sensor grain, Korean influencer aesthetic, influencer soft retouch, beautified pretty idealized face, slightly idealized smooth skin, glossy lip pearl shine, individual hair strand visibility strand by strand, realistic hair root density at the scalp, natural hair shine and glossy reflection, even soft front lighting, pure plain white wall background, seamless solid white, no texture, no props, true-to-life color grading`,

  // 클로즈업 시트 — 첨부 헤어의 포인트를 부위별 클로즈업 (성별·길이 무관, 모델 자율)
  // framing/aspect는 아래 조립부에서 자동 고정.
  closeup_sheet: `Understand the overall hairstyle of the person in the reference photo, then create a HAIR-FOCUSED detail sheet. One single image, 2x2 grid of 4 panels, same person and identical hairstyle and hair color in all panels. Keep the haircut, length, and color EXACTLY as the reference.
- TOP-LEFT: front view showing the whole hairstyle and the face, Korean influencer aesthetic, influencer soft retouch, beautified pretty idealized face.
- The other three panels: close-up shots where the hair fills most of the frame, focusing on the most flattering DIFFERENT parts of the hair — for example the side flow, a back three-quarter angle where the cheekbone is barely glimpsed, and the curled ends. IF the hairstyle has side bangs, include one panel where the side hair is tucked behind the ear so the ear is exposed, while the side bangs fall forward along the cheekbone and face line — making the side bangs stand out against the exposed ear. Each a clearly different part and angle, faces may be partially cropped or turned away. Avoid a straight full back-of-head view.
MOOD — shot on a smartphone, iPhone photo realism, clear hair strand detail, individual strands visible, realistic hair texture, natural hair shine and glossy light reflection, soft even front lighting, Korean influencer aesthetic, light soft retouch, pure plain white wall background, seamless solid white, no props, true-to-life color grading`,
};

// ─── 프레이밍 프리셋 ────────────────────────────────────────────
// v2 (2026-05-15): full_body 제거 → knee_up 추가
// 이유: 전신은 차렷 자세 나와 의미 없음. 무릎 위 = 헤어 + 의상 같이 보이는 미디엄 풀샷.
const FRAMING_PRESETS = {
  chest_up: 'chest-up framing, subject from upper chest to head, hair fully visible',
  upper_body: 'upper body framing, subject from waist to head with shoulders fully shown',
  knee_up: 'medium full shot framing, subject from above the knee to head, hair and outfit visible',
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

  // ai_call_logs 측정 시작
  const startTime = Date.now();

  // ─── 1. 세션 검증 ────────────────────────────────────────────
  const session = getSessionFromRequest(req);
  if (!session?.memberId) {
    return res.status(401).json({
      code: 'not_authenticated',
      message: '로그인이 필요해요. 로그인 후 이용해주세요.',
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
    mood,        // ⭐ 'natural' | 'editorial_lookbook' | 'y2k' | null
    framing,     // ⭐ 'chest_up' | 'upper_body' | 'knee_up' | null
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
      message: `참조 사진은 최대 ${MAX_REFERENCES}장까지 첨부할 수 있어요.`,
    });
  }
  for (const r of refs) {
    if (!r?.base64 || typeof r.base64 !== 'string') {
      return res.status(400).json({ code: 'invalid_reference' });
    }
    if (r.base64.length > 8 * 1024 * 1024) {
      return res.status(400).json({
        code: 'reference_too_large',
        message: '사진이 너무 커요 (10MB 이하로 올려주세요).',
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
      return res.status(401).json({ code: 'not_authenticated', message: '로그인이 만료되었어요. 다시 로그인해주세요.' });
    }
    if (reason === 'insufficient_credits' || remaining <= 0) {
      await logAiCall({
        member_id: memberId,
        model: 'nanobanana',
        stage: 'image',
        status: 'error',
        user_message: '크레딧이 부족해요. 충전 후 이용해주세요.',
        internal_reason: 'insufficient_credits',
        alert_level: 'info',
        error_code: '402',
        duration_ms: Date.now() - startTime,
      });
      return res.status(402).json({ code: 'insufficient_credits', message: '크레딧이 부족해요. 충전 후 이용해주세요.', credits_remaining: remaining });
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
  //   - 디자이너 입력 = 사용자 프롬프트 본문만 (강조 라벨 X — 무드 충돌 최소화)
  const promptParts = [];

  // ⭐ 무드 (선택사항, 디폴트 = 무드 X = 자유)
  if (mood && typeof mood === 'string' && MOOD_PRESETS[mood]) {
    promptParts.push(MOOD_PRESETS[mood]);
  }

  // ⭐ 프레이밍 (선택사항) — 4분할컷/클로즈업시트는 그리드 고정이라 스킵
  if (framing && typeof framing === 'string' && FRAMING_PRESETS[framing] && mood !== 'quad_sheet' && mood !== 'closeup_sheet') {
    promptParts.push(FRAMING_PRESETS[framing]);
  }

  // 앵글 가이드라인 (충돌 위험 있어 약화 표현)
  if (anglePrompt && typeof anglePrompt === 'string') {
    promptParts.push(
      `camera angle guideline (this is just a reference; the subject's expression, gaze direction, and emotional state described in the MAIN INSTRUCTION below take priority over this camera angle): ${anglePrompt}`
    );
  }

  // 디자이너 입력 = 사용자 프롬프트 본문만 전달 (강조 라벨 제거 — 무드 충돌 최소화)
  promptParts.push(userPrompt.trim());

  // 해상도 비율 — 4분할컷/클로즈업시트는 릴스용 9:16 고정 (사용자가 다른 비율 골라도 강제)
  if (mood === 'quad_sheet' || mood === 'closeup_sheet') {
    promptParts.push('vertical 9:16 aspect ratio, portrait orientation');
  } else {
    promptParts.push(aspectPrompt || 'vertical 9:16 aspect ratio, portrait orientation');
  }

  // ⭐ 통짜 결합 (',\n') — 힉스필드처럼 한 덩어리 프롬프트로 모델에 전달
  //    이유: '\n\n'(빈 줄)로 분리하면 모델이 여러 섹션으로 인식해 무드 영향 약화됨
  const finalPrompt = promptParts.join(',\n');

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

  // ── 2단 Fallback 체인 ─────────────────────────────────────
  // v6.3 변경:
  //   - 서울 리전 단계 삭제 (구글 공식: Gemini 2.5+ preview 모델은 global only)
  //   - Legacy normal 단계 삭제 (어차피 도달 못 함, 누적 timeout 단축)
  //   - 글로벌 stream(90s) → Legacy stream(60s) = 누적 150초
  //   - Vercel 180초 안에 logFailure 도달 보장 (30초 마진)
  let imagePart = null;
  let textPart = null;
  let finishReason = null;
  let lastError = null;
  let route = null; // 어느 경로로 성공했는지 디버그용

  // ── 1차: Vertex AI 글로벌 (global) Streaming ──
  try {
    const accessToken = await getVertexAccessToken();
    const projectId = getProjectId();
    const globalUrl = buildVertexUrl('global', projectId);
    const r1 = await callVertexStream(globalUrl, accessToken, requestBody);
    imagePart = r1.imagePart;
    textPart = r1.textPart;
    finishReason = r1.finishReason;
    route = 'vertex-global-stream';
    console.log(`[generate-image] vertex-global stream success in ${r1.elapsedMs}ms`);
  } catch (e1) {
    lastError = e1;
    console.error(`[generate-image] vertex-global stream failed: ${e1.name} - ${e1.message}`);

    // ── 2차 안전망: Generative Language API (Legacy stream) ──
    try {
      console.log('[generate-image] falling back to legacy endpoint (Generative Language API)');
      const r2 = await callGeminiStream(GEMINI_STREAM_URL, geminiKey, requestBody);
      imagePart = r2.imagePart;
      textPart = r2.textPart;
      finishReason = r2.finishReason;
      route = 'legacy-stream';
      console.log(`[generate-image] legacy stream success in ${r2.elapsedMs}ms`);
    } catch (e2) {
      console.error(`[generate-image] all fallbacks failed: ${e2.name} - ${e2.message}`);
      await refundCredit(supabase, memberId, generationRef, result.is_admin);

      await logFailure({
        member_id: memberId,
        model: 'nanobanana',
        route: null,
        stage: 'image',
        err: e2,
        user_message: '지금 많은 분이 사용 중이에요. 30초 후 다시 시도해주세요.',
        duration_ms: Date.now() - startTime,
        prompt_length: typeof userPrompt === 'string' ? userPrompt.length : null,
        refunded: !result.is_admin,
        allFallbacksFailed: true,
      });

      // 모든 에러 케이스 통일 — 디자이너는 다시 시도하면 됨
      return res.status(503).json({
        code: 'busy',
        message: '지금 많은 분이 사용 중이에요. 30초 후 다시 시도해주세요.\n크레딧은 차감되지 않았습니다.',
      });
    }
  }

  // ─── 7. 응답에서 이미지 추출 ────────────────────────────────
  if (!imagePart || !imagePart.data) {
    await refundCredit(supabase, memberId, generationRef, result.is_admin);

    // route 매핑: 'vertex-seoul-stream' → 'vertex-seoul' 등
    const routeForLog = route?.startsWith('vertex-seoul') ? 'vertex-seoul'
                      : route?.startsWith('vertex-global') ? 'vertex-global'
                      : route?.startsWith('legacy') ? 'legacy'
                      : null;

    await logAiCall({
      member_id: memberId,
      model: 'nanobanana',
      route: routeForLog,
      stage: 'image',
      status: 'safety_block',
      user_message: '제한된 콘텐츠로 분류됐어요. 참조 사진/프롬프트를 변경 후 시도해주세요.',
      internal_reason: 'safety_block',
      alert_level: 'info',
      raw_error: `finishReason: ${finishReason || 'unknown'}`,
      error_code: 'SAFETY',
      duration_ms: Date.now() - startTime,
      prompt_length: typeof userPrompt === 'string' ? userPrompt.length : null,
    });

    // 안전 필터 / 제한 콘텐츠 / 텍스트만 반환 → 모두 통일 메시지 (사용자에겐 동일한 액션이 답)
    return res.status(422).json({
      code: 'content_blocked',
      message: '제한된 콘텐츠로 분류됐어요. 참조 사진/프롬프트를 변경 후 시도해주세요.\n크레딧은 차감되지 않았습니다.',
      finishReason,
    });
  }

  // ─── 8. 성공 응답 ───────────────────────────────────────────
  {
    const routeForLog = route?.startsWith('vertex-seoul') ? 'vertex-seoul'
                      : route?.startsWith('vertex-global') ? 'vertex-global'
                      : route?.startsWith('legacy') ? 'legacy'
                      : null;
    await logSuccess({
      member_id: memberId,
      model: 'nanobanana',
      route: routeForLog,
      stage: 'image',
      duration_ms: Date.now() - startTime,
      prompt_length: typeof userPrompt === 'string' ? userPrompt.length : null,
    });
  }

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
// Legacy fallback (2차)으로 사용. v6.3: timeout 150초 → 60초
// 누적 (글로벌 90 + Legacy 60 = 150초) → Vercel 180초 마진 30초 → logFailure 도달
async function callGeminiStream(url, apiKey, requestBody) {
  const startTime = Date.now();
  const controller = new AbortController();

  // 전체 timeout 60초 (Legacy 안전망 — 글로벌 끝난 뒤 호출되므로 시간 여유 적음)
  // 첫 토큰 timeout 제거 - 정상 응답을 abort하는 부작용 더 큼
  const TOTAL_TIMEOUT_MS = 60000;

  const totalTimeoutId = setTimeout(() => {
    controller.abort('total_timeout');
  }, TOTAL_TIMEOUT_MS);

  let firstTokenLogged = false;

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
      const errorText = await response.text();
      const err = new Error(`stream HTTP ${response.status}`);
      err.status = response.status;
      err.detail = errorText.slice(0, 500);
      throw err;
    }

    if (!response.body) {
      clearTimeout(totalTimeoutId);
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

      // 첫 청크 도착 로그 (한 번만)
      if (!firstTokenLogged) {
        firstTokenLogged = true;
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
    return {
      imagePart,
      textPart,
      finishReason,
      elapsedMs: Date.now() - startTime,
    };
  } catch (err) {
    clearTimeout(totalTimeoutId);
    throw err;
  }
}

// ════════════════════════════════════════════════════════════
// Vertex AI Streaming 호출 헬퍼 (1차 fallback)
// ════════════════════════════════════════════════════════════
// callGeminiStream과 동일 구조, 인증만 다름 (Bearer 토큰)
// v6.3: timeout 150초 → 90초 (Vercel 180초 안에 Legacy 2차 + logFailure 도달 보장)
async function callVertexStream(url, accessToken, requestBody) {
  const startTime = Date.now();
  const controller = new AbortController();

  // 전체 timeout 90초 (글로벌 평균 응답 15~25초 → 90초 = 충분 마진)
  // 첫 토큰 timeout 제거 - 정상 응답을 abort하는 부작용 더 큼
  const TOTAL_TIMEOUT_MS = 90000;

  const totalTimeoutId = setTimeout(() => {
    controller.abort('total_timeout');
  }, TOTAL_TIMEOUT_MS);

  let firstTokenLogged = false;

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
      const errorText = await response.text();
      const err = new Error(`stream HTTP ${response.status}`);
      err.status = response.status;
      err.detail = errorText.slice(0, 500);
      throw err;
    }

    if (!response.body) {
      clearTimeout(totalTimeoutId);
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

      if (!firstTokenLogged) {
        firstTokenLogged = true;
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
    return {
      imagePart,
      textPart,
      finishReason,
      elapsedMs: Date.now() - startTime,
    };
  } catch (err) {
    clearTimeout(totalTimeoutId);
    throw err;
  }
}

// ════════════════════════════════════════════════════════════
// 일반 호출 헬퍼 (Fallback - 30초 timeout)
// ════════════════════════════════════════════════════════════
async function callGeminiNormal(url, apiKey, requestBody) {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000);

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

