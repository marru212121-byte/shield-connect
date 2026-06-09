// api/recipe.js
// ═══════════════════════════════════════════════════════════════
// AI 분석 엔드포인트 (member_id 기반 + 크레딧 차감 + 스트리밍 지원)
// ★ 엔진: Google Gemini (텍스트) — 호출 경로를 Vertex AI 글로벌로 이전 ★
// ═══════════════════════════════════════════════════════════════
// 호출 주체: analyzer.html(컬러), cut-analyzer.html(컷) — ※ 프론트는 안 바뀜
//   둘 다 이 한 파일(/api/recipe)을 부른다. stage로만 구분('color' / 'cut' / 'recipe_only').
//
// 이번 변경(3가지 한 번에):
//   ① 엔진 경로 교체: AI Studio 무료 엔드포인트(generativelanguage)
//        → Vertex AI 글로벌(aiplatform.googleapis.com). 503 "high demand" 급감.
//        인증은 나노바나나(generate-image)가 쓰는 lib/vertex-auth.js 를 그대로 재사용.
//   ② 서버 측 짧은 재시도(백오프) + 중단 타이머(timeout).
//        - 버텍스가 일시적으로 혼잡(503/429/5xx)하면 사용자에게 보이기 전에 한 번 더 시도.
//        - 60초 함수 한계 전에 빠르게 끊어 환불·로그가 반드시 실행되게 함(504/크레딧 유실 방지).
//        - 버텍스가 안 되면 기존 AI Studio 경로로 자동 폴백(지금보다 나빠지지 않게).
//   ③ 'fullText is not defined' 버그 수정: 스트리밍 누적 변수를 try 블록 바깥에서 선언.
//
// 프론트 계약은 그대로:
//   요청은 Anthropic 형식({ system, messages[].content[] })으로 들어오고,
//   응답도 Anthropic 형식(content[].text / SSE content_block_delta)으로 내려준다.
//   → 변환은 이 파일 안에서만. analyzer/cut-analyzer 는 수정 불필요.
// ═══════════════════════════════════════════════════════════════

import { getSessionFromRequest } from '../lib/session.js';
import { getSupabase } from '../lib/supabase.js';
import { logSuccess, logFailure, logAiCall } from '../lib/ai-log-helper.js';
// ★ 나노바나나(generate-image)와 동일한 버텍스 인증 헬퍼 재사용
import { getVertexAccessToken, getProjectId } from '../lib/vertex-auth.js';

// ─── 모델 ──────────────────────────────────────────────────────
// 텍스트 분석 모델. 지금까지 쓰던 것과 동일한 모델명을 그대로 유지한다.
// ※ 만약 버텍스에서 404(모델 없음)가 뜨면, 버텍스에서 부르는 모델 ID 표기만
//   살짝 다른 것이므로 아래 VERTEX_TEXT_MODEL 한 줄만 바꾸면 된다.
//   (그래도 자동으로 AI Studio 경로로 폴백하므로 서비스는 안 멈춤.)
const TEXT_MODEL = 'gemini-3.5-flash';

// 버텍스는 모델 ID가 다를 수 있어 별도 상수로 둠(기본은 동일).
const VERTEX_TEXT_MODEL = TEXT_MODEL;

// 어드민 통계/로그에 기록되는 모델 이름 (system.js / overview.js / ai-logs.js 와 동일해야 함)
const LOG_MODEL = 'gemini';

// 크레딧 차감 skip 대상 stage
// - 'customer_message': 고객 안내 생성 (무료, 분석 결과 재가공)
// - 'recipe_only'     : 컬러 분석 Step 2 (레시피) → 무료. 컬러 1회 = 1크레딧이 되도록 skip.
const SKIP_CHARGE_STAGES = ['customer_message', 'recipe_only'];

// ─── 타임아웃 / 재시도 설정 ────────────────────────────────────
// Vercel 함수 한계가 60초이므로, 그 안에서 호출을 끊고 환불·로그까지 끝내야 한다.
const ATTEMPT_TIMEOUT_MS = 48000; // 한 번의 호출(스트림 전체 포함) 최대 대기
const RETRY_BUDGET_MS = 25000;    // 이 시간 넘게 흘렀으면 재시도하지 않음(시간 부족)
const RETRY_BACKOFF_MS = 1500;    // 재시도 전 대기
const MAX_VERTEX_ATTEMPTS = 2;    // 버텍스 시도 횟수(1차 + 재시도 1회)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── 엔드포인트 URL ────────────────────────────────────────────
function vertexUrl(stream, projectId) {
  const method = stream ? 'streamGenerateContent?alt=sse' : 'generateContent';
  // 글로벌 리전: 나노바나나와 동일
  return `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/${VERTEX_TEXT_MODEL}:${method}`;
}
function aiStudioUrl(stream) {
  const method = stream ? 'streamGenerateContent?alt=sse' : 'generateContent';
  return `https://generativelanguage.googleapis.com/v1beta/models/${TEXT_MODEL}:${method}`;
}

function isRetryableStatus(s) {
  return s === 429 || s === 500 || s === 502 || s === 503 || s === 504;
}

// ─── Anthropic 형식 요청 → Gemini 형식 body 변환 ───────────────
// (Vertex / AI Studio 모두 요청 body 형식은 동일하므로 그대로 재사용)
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
          parts.push({ inlineData: { mimeType: b.source.media_type, data: b.source.data } });
        }
        // 그 외 타입(cache_control 등)은 Gemini에서 의미 없으므로 무시
      });
    }
    contents.push({ role: msg.role === 'assistant' ? 'model' : 'user', parts });
  });

  const body = { contents };

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
    maxOutputTokens: (max_tokens || 1024) + 1024,
    temperature: 1,
    thinkingConfig: { thinkingBudget: 0 }, // 안 보이는 생각 끔 → 즉답·비용 절감·안정성
  };

  return body;
}

function extractGeminiText(geminiData) {
  const cand = geminiData && geminiData.candidates && geminiData.candidates[0];
  const parts = (cand && cand.content && cand.content.parts) || [];
  return parts.map((p) => (typeof p.text === 'string' ? p.text : '')).join('');
}

// ─── 한 번의 업스트림 호출 (timeout 포함) ──────────────────────
// 반환: { resp, controller, tid, via }  — 스트림이면 tid는 호출자가 끝나고 정리
async function fetchUpstreamOnce({ via, stream, geminiBody, accessToken, projectId }) {
  const url = via === 'vertex' ? vertexUrl(stream, projectId) : aiStudioUrl(stream);
  const headers =
    via === 'vertex'
      ? {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          Accept: 'text/event-stream',
        }
      : {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.HAIRO_NANOBANANA2,
        };

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort('timeout'), ATTEMPT_TIMEOUT_MS);

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(geminiBody),
      signal: controller.signal,
    });
    return { resp, controller, tid, via };
  } catch (err) {
    clearTimeout(tid);
    throw err;
  }
}

// ─── 업스트림 확보: 버텍스(재시도) → AI Studio 폴백 ────────────
// ok 응답을 받으면 그 핸들({ resp, tid, via })을 돌려준다.
// 모두 실패하면 status를 단 Error를 throw.
async function acquireUpstream({ stream, geminiBody }) {
  const overallStart = Date.now();
  let lastErr = null;

  // 버텍스 인증 토큰 확보 (실패해도 AI Studio 폴백으로 진행)
  let accessToken = null;
  let projectId = null;
  try {
    accessToken = await getVertexAccessToken();
    projectId = getProjectId();
  } catch (e) {
    console.error('[recipe] vertex auth unavailable:', e?.message || e);
  }

  // ── 1차: 버텍스 글로벌 (재시도 포함) ──
  if (accessToken && projectId) {
    for (let attempt = 1; attempt <= MAX_VERTEX_ATTEMPTS; attempt++) {
      let handle = null;
      try {
        handle = await fetchUpstreamOnce({ via: 'vertex', stream, geminiBody, accessToken, projectId });
        if (handle.resp.ok) {
          console.log(`[recipe] vertex-global ok (attempt ${attempt})`);
          return handle; // ★ 성공: tid는 호출자가 정리
        }
        // ok 아님
        const status = handle.resp.status;
        let detail = '';
        try { detail = (await handle.resp.text()).slice(0, 300); } catch (_) {}
        clearTimeout(handle.tid);
        lastErr = { status, message: detail || `HTTP ${status}` };
        console.error(`[recipe] vertex error ${status} (attempt ${attempt}):`, detail);

        if (!isRetryableStatus(status)) break; // 404/400/401 등 설정성 오류 → 폴백으로
        if (attempt < MAX_VERTEX_ATTEMPTS && Date.now() - overallStart < RETRY_BUDGET_MS) {
          await sleep(RETRY_BACKOFF_MS);
          continue;
        }
        break;
      } catch (e) {
        if (handle?.tid) clearTimeout(handle.tid);
        lastErr = { status: 0, message: e?.message || String(e) };
        console.error(`[recipe] vertex fetch failed (attempt ${attempt}):`, e?.message || e);
        if (attempt < MAX_VERTEX_ATTEMPTS && Date.now() - overallStart < RETRY_BUDGET_MS) {
          await sleep(RETRY_BACKOFF_MS);
          continue;
        }
        break;
      }
    }
  }

  // ── 2차 안전망: AI Studio (generativelanguage) ──
  // 버텍스가 안 되거나 토큰이 없을 때만 도달. 시간 여유가 있을 때 1회 시도.
  if (Date.now() - overallStart < RETRY_BUDGET_MS + RETRY_BACKOFF_MS) {
    let handle = null;
    try {
      console.log('[recipe] falling back to AI Studio endpoint');
      handle = await fetchUpstreamOnce({ via: 'aistudio', stream, geminiBody });
      if (handle.resp.ok) {
        console.log('[recipe] ai-studio ok (fallback)');
        return handle;
      }
      const status = handle.resp.status;
      let detail = '';
      try { detail = (await handle.resp.text()).slice(0, 300); } catch (_) {}
      clearTimeout(handle.tid);
      lastErr = { status, message: detail || `HTTP ${status}` };
      console.error(`[recipe] ai-studio error ${status}:`, detail);
    } catch (e) {
      if (handle?.tid) clearTimeout(handle.tid);
      lastErr = { status: 0, message: e?.message || String(e) };
      console.error('[recipe] ai-studio fetch failed:', e?.message || e);
    }
  }

  const err = new Error(lastErr?.message || 'upstream failed');
  err.status = lastErr?.status || 0;
  throw err;
}

// 분석 결과 텍스트를 ai_call_logs 행에 저장 (어드민 펼쳐보기용). 실패해도 본 흐름 무관.
async function saveResultText(supabase, { memberId, stage, text, rowId: preferredRowId = null }) {
  try {
    if (!text || !text.trim()) return;
    const trimmed = text.length > 20000 ? text.slice(0, 20000) : text;

    if (preferredRowId) {
      await supabase.from('ai_call_logs').update({ result_text: trimmed }).eq('id', preferredRowId);
      return;
    }

    let q = supabase
      .from('ai_call_logs')
      .select('id')
      .eq('member_id', memberId)
      .eq('model', LOG_MODEL)
      .eq('status', 'success');
    if (stage == null) q = q.is('stage', null);
    else q = q.eq('stage', stage);

    const { data: rows } = await q.order('created_at', { ascending: false }).limit(1);
    const rowId = rows && rows[0] && rows[0].id;
    if (!rowId) return;
    await supabase.from('ai_call_logs').update({ result_text: trimmed }).eq('id', rowId);
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

  const { model, max_tokens, system, messages, stage } = body;
  if (!model || !messages) {
    return res.status(400).json({ code: 'missing_required_fields' });
  }

  const skipCharge = SKIP_CHARGE_STAGES.includes(stage);
  const wantStream = body.stream === true;
  const supabase = getSupabase();

  // ─── 측정 변수 ──────────────────────────────────────────────
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
      { p_member_id: memberId, p_amount: 1, p_reference: analysisRef }
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

    if (result.is_admin) console.log('[recipe] admin bypass:', memberId);
  } else {
    console.log('[recipe] skipCharge (' + stage + '):', memberId);
  }

  // ─── 4. 업스트림 호출 (버텍스 글로벌 → 재시도 → AI Studio 폴백) ──
  const geminiBody = anthropicToGeminiBody({ system, messages, max_tokens });

  let handle;
  try {
    handle = await acquireUpstream({ stream: wantStream, geminiBody });
  } catch (err) {
    console.error('[recipe] all upstreams failed:', err?.status, err?.message);
    if (!skipCharge) {
      await refundCredit(supabase, memberId, analysisRef, result.is_admin);
    }
    await logFailure({
      member_id: memberId,
      model: LOG_MODEL,
      stage: stage || null,
      err: { message: err?.message || 'upstream failed', status: err?.status || 0 },
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

  const upstream = handle.resp;
  const upstreamTid = handle.tid; // 스트림 끝까지 살려두는 timeout

  // ─── 5-A. 스트리밍 응답 (Gemini SSE → Anthropic SSE 변환 릴레이) ───
  if (wantStream) {
    await logSuccess({
      member_id: memberId,
      model: LOG_MODEL,
      stage: stage || null,
      duration_ms: Date.now() - startTime,
      prompt_length: promptLength,
    });

    // 방금 만든 성공 로그 행 id를 스트리밍 시작 전에 미리 확보
    let streamLogRowId = null;
    try {
      let idq = supabase
        .from('ai_call_logs')
        .select('id')
        .eq('member_id', memberId)
        .eq('model', LOG_MODEL)
        .eq('status', 'success');
      if (stage == null) idq = idq.is('stage', null);
      else idq = idq.eq('stage', stage);
      const { data: idRows } = await idq.order('created_at', { ascending: false }).limit(1);
      streamLogRowId = (idRows && idRows[0] && idRows[0].id) || null;
    } catch (_) {
      streamLogRowId = null;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // ★ 버그 수정: 누적 변수를 try 바깥에서 선언해야 스트림 종료 후에도 접근 가능
    //   (이전엔 try 안에서 선언해 'fullText is not defined' 에러 발생 — recipe.js:417)
    let fullText = '';

    try {
      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
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
              fullText += delta;
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
      console.error('[recipe] stream relay failed:', err?.message || err);
      try {
        res.write(`event: error\ndata: ${JSON.stringify({ message: 'stream interrupted' })}\n\n`);
      } catch (_) {}
    } finally {
      clearTimeout(upstreamTid); // 스트림 끝 → 중단 타이머 해제
    }

    await saveResultText(supabase, { memberId, stage, text: fullText, rowId: streamLogRowId });
    res.end();
    return;
  }

  // ─── 5-B. 일반(non-stream) 응답 (Gemini JSON → Anthropic content[]) ───
  let geminiData;
  try {
    geminiData = await upstream.json();
  } finally {
    clearTimeout(upstreamTid);
  }
  const text = extractGeminiText(geminiData);

  // 빈 응답/안전필터 차단 → 환불 + busy
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

  await saveResultText(supabase, { memberId, stage, text });

  return res.status(200).json({
    content: [{ type: 'text', text }],
    credits_remaining: skipCharge ? undefined : result.credits_remaining,
    is_admin: skipCharge ? undefined : result.is_admin,
  });
}

// ============================================================
// 크레딧 환불 (호출 실패 시) — 로직 그대로
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
