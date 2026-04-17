export default async function handler(req, res) {
  /* CORS */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  /* body 파싱 */
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) {
      return res.status(400).json({ error: 'body 파싱 실패' });
    }
  }

  const { messages, system, model, max_tokens } = body || {};
  if (!messages) return res.status(400).json({ error: 'messages 없음' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API 키 미설정' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-6',
        max_tokens: max_tokens || 2048,
        system: system || '',
        messages: messages
      })
    });

    const data = await response.json();

    /* 캐시 사용량 로그 (Vercel Logs에서 확인 가능) */
    if (data.usage) {
      const u = data.usage;
      console.log(JSON.stringify({
        tag: 'claude_usage',
        model: model || 'claude-sonnet-4-6',
        input_tokens: u.input_tokens || 0,
        cache_creation_input_tokens: u.cache_creation_input_tokens || 0,
        cache_read_input_tokens: u.cache_read_input_tokens || 0,
        output_tokens: u.output_tokens || 0,
        cache_hit: (u.cache_read_input_tokens || 0) > 0
      }));
    }

    if (data.content) {
      return res.status(200).json(data);
    }

    /* 에러 응답도 로그 */
    console.error(JSON.stringify({
      tag: 'claude_error',
      status: response.status,
      error: data.error || data
    }));

    const errMsg = data.error?.message || JSON.stringify(data);
    return res.status(500).json({ error: errMsg });

  } catch (err) {
    console.error(JSON.stringify({
      tag: 'claude_fetch_error',
      message: err.message
    }));
    return res.status(500).json({ error: err.message });
  }
}
