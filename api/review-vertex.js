// api/review-vertex.js
// ═══════════════════════════════════════════════════════════════
// 검수툴 → 글로벌 Vertex(gemini-3.5-flash) 프록시
//   · 브라우저는 이 함수만 호출 (서비스 계정 키 노출 0)
//   · 글로벌 리전이라 503 "high demand" 급감 + 재시도/백오프
//   · 입력:  { systemText, userContent:[{type:'image',source:{media_type,data}}|{type:'text',text}], maxTokens }
//   · 출력:  { text, finishReason }   (검수툴 parseJSON이 text를 그대로 파싱)
// 필요 env: GOOGLE_SERVICE_ACCOUNT_JSON  (Vercel 프로젝트 환경변수)
// ═══════════════════════════════════════════════════════════════
import { getVertexAccessToken, getProjectId } from '../lib/vertex-auth.js';

const MODEL = 'gemini-3.5-flash';
const MAX_ATTEMPTS = 3;
const BACKOFF_MS = 800;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isRetryable = (s) => s === 429 || s === 500 || s === 502 || s === 503 || s === 504;

function toGeminiParts(userContent) {
  return (userContent || []).map((c) => {
    if (c && c.type === 'image' && c.source) {
      return { inlineData: { mimeType: c.source.media_type, data: c.source.data } };
    }
    return { text: (c && c.text) || '' };
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }

  // 바디 파싱 (Vercel가 자동 파싱하지만 문자열로 올 때 대비)
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const { systemText, userContent, maxTokens } = body || {};
  if (!userContent || !Array.isArray(userContent)) {
    res.status(400).json({ error: 'userContent(array) required' });
    return;
  }

  const geminiBody = {
    contents: [{ role: 'user', parts: toGeminiParts(userContent) }],
    generationConfig: {
      maxOutputTokens: maxTokens || 4000,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 },
    },
  };
  if (systemText) geminiBody.systemInstruction = { parts: [{ text: systemText }] };

  // OAuth 토큰
  let token, projectId;
  try {
    token = await getVertexAccessToken();
    projectId = getProjectId();
  } catch (e) {
    res.status(500).json({ error: 'Vertex 인증 실패: ' + (e?.message || String(e)) + ' (GOOGLE_SERVICE_ACCOUNT_JSON env 확인)' });
    return;
  }

  const url = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/global/publishers/google/models/${MODEL}:generateContent`;

  let lastErr = '';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(geminiBody),
      });

      if (r.ok) {
        const data = await r.json();
        const cand = (data.candidates || [])[0];
        const text = ((cand && cand.content && cand.content.parts) || [])
          .map((p) => p.text || '')
          .join('');
        res.status(200).json({ text, finishReason: cand && cand.finishReason });
        return;
      }

      const status = r.status;
      try { lastErr = (await r.text()).slice(0, 300); } catch { lastErr = 'HTTP ' + status; }

      if (!isRetryable(status)) {
        res.status(status).json({ error: `Vertex ${status} · ${lastErr}` });
        return;
      }
      if (attempt < MAX_ATTEMPTS) await sleep(BACKOFF_MS * attempt);
    } catch (e) {
      lastErr = e?.message || String(e);
      if (attempt < MAX_ATTEMPTS) await sleep(BACKOFF_MS * attempt);
    }
  }

  res.status(503).json({ error: `Vertex 재시도 ${MAX_ATTEMPTS}회 실패 · ${lastErr}` });
}
