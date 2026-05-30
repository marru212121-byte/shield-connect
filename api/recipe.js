// api/recipe.js
// ═══════════════════════════════════════════════════════════════
// AI 분석 엔드포인트 (member_id 기반 + 크레딧 차감 + 스트리밍 지원)
// ★ 엔진 교체: Anthropic 소넷 → Google Gemini 3.5 Flash ★
// ═══════════════════════════════════════════════════════════════
// 호출 주체: analyzer.html, cut-analyzer.html (프론트) — ※ 프론트는 안 바뀜
// 핵심 설계:
//   프론트는 예전 그대로 "Anthropic 형식"으로 요청을 보내고,
//   "Anthropic 형식"으로 응답을 받는다. (content[].text / SSE content_block_delta)
//   → 이 파일이 안에서만 Gemini 형식으로 변환해서 호출하고,
//     Gemini 응답을 다시 Anthropic 형식으로 되돌려서 내려준다.
//   → 따라서 프론트(analyzer/cut-analyzer)는 한 글자도 안 고쳐도 그대로 작동.
//
// 처리 흐름:
//   1. 세션 검증 (쿠키에서 member_id 추출) — stage 무관 항상 수행
//   2. stage가 skip 대상이면 크레딧 차감 skip, 아니면 1크레딧 차감
//      skip 대상: 'customer_message'(무료 안내), 'recipe_only'(컬러 2스텝=레시피)
//      → 컬러 분석 1회 = 1스텝(차감) + 2스텝(무료) = 총 1크레딧
//   3. Gemini API 호출 (요청을 Anthropic→Gemini로 변환)
//      - body.stream === true 면 SSE 스트리밍 (Gemini SSE → Anthropic SSE 변환 릴레이)
//      - 아니면 non-stream (Gemini JSON → Anthropic content[] 변환 후 반환)
//   4. 결과 반환
// ═══════════════════════════════════════════════════════════════

import { getSessionFromRequest } from '../lib/session.js';
import { getSupabase } from '../lib/supabase.js';
import { logSuccess, logFailure, logAiCall } from '../lib/ai-log-helper.js';

// ─── Gemini 엔드포인트 / 모델 ──────────────────────────────────
// 모델·키만 환경에 맞게. (나노바나나와 같은 AI Studio 키 재활용 가능)
const GEMINI_MODEL = 'gemini-3.5-flash';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
function geminiUrl(stream) {
  const method = stream ? 'streamGenerateContent?alt=sse' : 'generateContent';
  return `${GEMINI_BASE}/${GEMINI_MODEL}:${method}`;
}

// 어드민 통계/로그에 기록되는 모델 이름 (system.js / overview.js / ai-logs.js 와 동일해야 함)
const LOG_MODEL = 'gemini';

// 크레딧 차감 skip 대상 stage
// - 'customer_message': 고객 안내 생성 (무료, 분석 결과 재가공)
// - 'recipe_only'     : 컬러 분석 Step 2 (레시피) → 무료. 컬러 1회 = 1크레딧이 되도록 skip.
const SKIP_CHARGE_STAGES = ['customer_message', 'recipe_only'];

// ─── Anthropic 형식 요청 → Gemini 형식 body 변환 ───────────────
// 프론트가 보내는 { system, messages[].content[] } (Anthropic 형식)을
// Gemini의 { systemInstruction, contents[].parts[] } 로 바꾼다.
// (color-gemini.html / cut-gemini.html 데모에서 검증된 변환 로직과 동일)
function anthropicToGeminiBody({ system, messages, max_tokens }) {
  const contents = [];

  (messages || []).forEach((msg) => {
    const parts = [];
    const c = msg.content;
    if (typeof c === 'string') {
      parts.push({ text: c });
    } else if (Array.isArray(c)) {
      c.forEach((b) => {
        if (b.type === 'text') {
          parts.push({ text: b.text });
        } else if (b.type === 'image' && b.source && b.source.type === 'base64') {
          // Anthropic image.source.{media_type,data} → Gemini inlineData.{mimeType,data}
          parts.push({ inlineData: { mimeType: b.source.media_type, data: b.source.data } });
        }
        // 그 외 타입(cache_control 등)은 Gemini에서 의미 없으므로 무시
      });
    }
    // Anthropic role 'assistant' → Gemini role 'model'
    contents.push({ role: msg.role === 'assistant' ? 'model' : 'user', parts });
  });

  const body = { contents };

  // system: 문자열이거나 [{type:'text', text, cache_control?}] 형태 → 텍스트만 합쳐서 systemInstruction
  if (system) {
    let s = '';
    if (typeof system === 'string') {
      s = system;
    } else if (Array.isArray(system)) {
      system.forEach((x) => { s += (x && x.text) || ''; });
    }
    if (s) body.systemInstruction = { parts: [{ text: s }] };
  }

  body.generationConfig = {
    // 답 공간 넉넉히 (잘림 방지) — 데모와 동일하게 +1024 여유
    maxOutputTokens: (max_tokens || 1024) + 1024,
    temperature: 1,
    // 안 보이는 생각(Thought) 끔 → 즉답·비용 절감·안정성 (★ 핵심)
    thinkingConfig: { thinkingBudget: 0 },
  };

  return body;
}

// Gemini non-stream 응답에서 텍스트만 뽑아 합치기
function extractGeminiText(geminiData) {
  const cand = geminiData && geminiData.candidates && geminiData.candidates[0];
  const parts = (cand && cand.content && cand.content.parts) || [];
  return parts.map((p) => (typeof p.text === 'string' ? p.text : '')).join('');
}

// 분석 결과 텍스트를 방금 기록된 ai_call_logs 행에 저장 (어드민에서 펼쳐보기용)
// - 실패해도 본 흐름에 영향 없음 (조용히 무시)
// - 가장 최근의 그 회원/그 stage 성공 로그를 찾아 result_text만 채움
async function saveResultText(supabase, { memberId, stage, text }) {
  try {
    if (!text || !text.trim()) return;
    const trimmed = text.length > 20000 ? text.slice(0, 20000) : text; // 안전 상한
    const { data: rows } = await supabase
      .from('ai_call_logs')
      .select('id')
      .eq('member_id', memberId)
      .eq('model', LOG_MODEL)
      .eq('status', 'success')
      .order('created_at', { ascending: false })
      .limit(1);
    const rowId = rows && rows[0] && rows[0].id;
    if (!rowId) return;
    await supabase
      .from('ai_call_logs')
      .update({ result_text: trimmed })
      .eq('id', rowId);
  } catch (e) {
    console.error('[recipe] saveResultText skip:', e?.message || e);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ code: 'method_not_allowed' });
  }

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

  // 'model'은 프론트가 'claude-sonnet-4-6'을 보내지만, 실제 호출 모델은
  // 이 파일이 GEMINI_MODEL로 강제한다. (존재 여부만 검증 — 기존 동작 유지)
  const { model, max_tokens, system, messages, stage } = body;
  if (!model || !messages) {
    return res.status(400).json({ code: 'missing_required_fields' });
  }

  const skipCharge = SKIP_CHARGE_STAGES.includes(stage);
  const wantStream = body.stream === true;
  const supabase = getSupabase();

  // ─── ai_call_logs 용 측정 변수 ──────────────────────────
  const startTime = Date.now();
  const promptLength = Array.isArray(messages)
    ? messages.reduce((sum, m) => {
        if (typeof m?.content === 'string') return sum + m.content.length;
        if (Array.isArray(m?.content)) {
          return sum + m.content.reduce((s, c) => s + (c?.text?.length || 0), 0);
        }
        return sum;
      }, 0)
    : 0;

  // ─── 3. 크레딧 차감 (RPC) — skipCharge면 건너뜀 ─────────────
  let analysisRef = null;
  let result = null;

  if (!skipCharge) {
    analysisRef = `analysis_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const { data: consumeResult, error: consumeError } = await supabase.rpc(
      'consume_credit_by_member',
      {
        p_member_id: memberId,
        p_amount: 1,
        p_reference: analysisRef,
      }
    );

    if (consumeError) {
      console.error('[recipe] consume RPC failed:', consumeError);
      return res.status(500).json({ code: 'server_error' });
    }

    result = Array.isArray(consumeResult) ? consumeResult[0] : consumeResult;

    const ok = result?.consumed === true || result?.success === true;

    if (!ok) {
      const reason = result?.reason;
      const remaining = Number(result?.credits_remaining ?? 0);

      if (reason === 'member_not_found') {
        return res.status(401).json({
          code: 'not_authenticated',
          message: '로그인이 만료되었어요. 다시 로그인해주세요.',
        });
      }

      if (reason === 'insufficient_credits' || remaining <= 0) {
        await logAiCall({
          member_id: memberId,
          model: LOG_MODEL,
          stage: stage || null,
          status: 'error',
          user_message: '크레딧이 부족해요. 충전 후 이용해주세요.',
          internal_reason: 'insufficient_credits',
          alert_level: 'info',
          error_code: '402',
          duration_ms: Date.now() - startTime,
          prompt_length: promptLength,
        });
        return res.status(402).json({
          code: 'insufficient_credits',
          message: '크레딧이 부족해요. 충전 후 이용해주세요.',
          credits_remaining: remaining,
        });
      }

      console.error('[recipe] unknown consume reason:', result);
      return res.status(500).json({ code: 'server_error' });
    }

    if (result.is_admin) {
      console.log('[recipe] admin bypass:', memberId);
    }
  } else {
    console.log('[recipe] skipCharge (' + stage + '):', memberId);
  }

  // ─── 4. Gemini API 호출 ─────────────────────────────────────
  const geminiBody = anthropicToGeminiBody({ system, messages, max_tokens });

  let geminiResponse;
  try {
    geminiResponse = await fetch(geminiUrl(wantStream), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // ★ 기존 나노바나나 AI Studio 키(AIza...)를 그대로 재활용.
        //   AI Studio 키는 모델 잠금이 없어 gemini-3.5-flash 분석도 이 키로 호출됨.
        //   별도 GEMINI_API_KEY를 만들고 싶으면 아래 이름만 바꾸면 됨.
        'x-goog-api-key': process.env.HAIRO_NANOBANANA2,
      },
      body: JSON.stringify(geminiBody),
    });
  } catch (err) {
    console.error('[recipe] gemini fetch failed:', err);
    if (!skipCharge) {
      await refundCredit(supabase, memberId, analysisRef, result.is_admin);
    }
    await logFailure({
      member_id: memberId,
      model: LOG_MODEL,
      stage: stage || null,
      err,
      user_message: '지금 많은 분이 사용 중이에요. 30초 후 다시 시도해주세요.',
      duration_ms: Date.now() - startTime,
      prompt_length: promptLength,
      refunded: !skipCharge,
    });
    return res.status(502).json({
      code: 'busy',
      message: '지금 많은 분이 사용 중이에요. 30초 후 다시 시도해주세요.\n크레딧은 차감되지 않았습니다.',
    });
  }

  if (!geminiResponse.ok) {
    const errorText = await geminiResponse.text();
    console.error('[recipe] gemini error:', geminiResponse.status, errorText);
    if (!skipCharge) {
      await refundCredit(supabase, memberId, analysisRef, result.is_admin);
    }
    await logFailure({
      member_id: memberId,
      model: LOG_MODEL,
      stage: stage || null,
      err: { message: errorText || `HTTP ${geminiResponse.status}`, status: geminiResponse.status },
      user_message: '지금 많은 분이 사용 중이에요. 30초 후 다시 시도해주세요.',
      duration_ms: Date.now() - startTime,
      prompt_length: promptLength,
      refunded: !skipCharge,
    });
    return res.status(502).json({
      code: 'busy',
      message: '지금 많은 분이 사용 중이에요. 30초 후 다시 시도해주세요.\n크레딧은 차감되지 않았습니다.',
    });
  }

  // ─── 5-A. 스트리밍 응답 (Gemini SSE → Anthropic SSE 변환 릴레이) ───
  // 프론트는 { type:'content_block_delta', delta:{ type:'text_delta', text } } 형식만 읽음.
  // Gemini SSE는 { candidates:[{ content:{ parts:[{text}] } }] } 형식이므로
  // 여기서 텍스트만 뽑아 Anthropic delta 형식으로 다시 써준다.
  if (wantStream) {
    // 응답 시작 = 호출 성공으로 간주 (기존 동작과 동일)
    await logSuccess({
      member_id: memberId,
      model: LOG_MODEL,
      stage: stage || null,
      duration_ms: Date.now() - startTime,
      prompt_length: promptLength,
    });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    try {
      const reader = geminiResponse.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = '';
      let fullText = '';   // 저장용: 흘려보낸 텍스트 전체 모으기

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });

        // SSE 라인 단위 파싱 (마지막 미완성 라인은 다음 청크와 합치기)
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop();

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.indexOf('data:') !== 0) continue;
          const dataStr = line.slice(5).trim();
          if (!dataStr || dataStr === '[DONE]') continue;
          try {
            const evt = JSON.parse(dataStr);
            const cand = evt && evt.candidates && evt.candidates[0];
            const parts = (cand && cand.content && cand.content.parts) || [];
            const delta = parts.map((p) => p.text || '').join('');
            if (delta) {
              fullText += delta;   // 저장용 누적
              // ★ Anthropic 형식 delta 로 변환해서 프론트로 전달
              res.write(
                'data: ' +
                  JSON.stringify({
                    type: 'content_block_delta',
                    delta: { type: 'text_delta', text: delta },
                  }) +
                  '\n\n'
              );
            }
          } catch (_) {
            /* 키프알라이브 / 미완성 라인 무시 */
          }
        }
      }
    } catch (err) {
      console.error('[recipe] stream relay failed:', err);
      try {
        res.write(`event: error\ndata: ${JSON.stringify({ message: 'stream interrupted' })}\n\n`);
      } catch (_) {}
    }
    // 스트림 끝 — 모은 텍스트 저장 (어드민 펼쳐보기용, 실패해도 무시)
    await saveResultText(supabase, { memberId, stage, text: fullText });
    res.end();
    return;
  }

  // ─── 5-B. 일반(non-stream) 응답 (Gemini JSON → Anthropic content[]) ───
  const geminiData = await geminiResponse.json();
  const text = extractGeminiText(geminiData);

  // 빈 응답/안전필터 차단 등으로 쓸 내용이 없으면 → 환불 + busy 처리
  // (Gemini는 차단 시에도 HTTP 200 + 빈 candidates를 줄 수 있어 별도 가드)
  if (!text.trim()) {
    console.error('[recipe] gemini empty/blocked:', JSON.stringify(geminiData).slice(0, 500));
    if (!skipCharge) {
      await refundCredit(supabase, memberId, analysisRef, result.is_admin);
    }
    await logFailure({
      member_id: memberId,
      model: LOG_MODEL,
      stage: stage || null,
      err: { message: 'gemini_empty_or_blocked' },
      user_message: '지금 많은 분이 사용 중이에요. 30초 후 다시 시도해주세요.',
      duration_ms: Date.now() - startTime,
      prompt_length: promptLength,
      refunded: !skipCharge,
    });
    return res.status(502).json({
      code: 'busy',
      message: '지금 많은 분이 사용 중이에요. 30초 후 다시 시도해주세요.\n크레딧은 차감되지 않았습니다.',
    });
  }

  await logSuccess({
    member_id: memberId,
    model: LOG_MODEL,
    stage: stage || null,
    duration_ms: Date.now() - startTime,
    prompt_length: promptLength,
  });

  // 분석 결과 텍스트 저장 (어드민 펼쳐보기용) — 실패해도 무시
  await saveResultText(supabase, { memberId, stage, text });

  // 프론트가 기대하는 Anthropic 형식 그대로: content: [{ type:'text', text }]
  return res.status(200).json({
    content: [{ type: 'text', text }],
    credits_remaining: skipCharge ? undefined : result.credits_remaining,
    is_admin: skipCharge ? undefined : result.is_admin,
  });
}

// ============================================================
// 크레딧 환불 (Gemini 호출 실패 시) — AI 모델 무관, 로직 그대로
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
          credits_remaining: (member.credits_remaining ?? 0) + 1,
          total_used: Math.max(0, (member.total_used ?? 0) - 1),
          updated_at: new Date().toISOString(),
        })
        .eq('member_id', memberId);

      await supabase.from('credit_ledger').insert({
        member_id: memberId,
        type: 'refund',
        amount: 1,
        balance_after: (member.credits_remaining ?? 0) + 1,
        reference,
        note: 'AI 호출 실패 자동 환불',
      });
    }
  } catch (err) {
    console.error('[recipe] refund failed:', err);
  }
}
