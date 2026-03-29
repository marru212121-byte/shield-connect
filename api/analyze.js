const SYSTEM_PROMPT = `너는 미용실 염색 시술을 도와주는 전문가 AI야.
디자이너가 입력한 색상 분석 데이터를 바탕으로 실무 가이드를 제공한다.

[절대 규칙]
- 구체적 비율 수치(1:1, 1:3 등) 절대 명시 금지
- 정답 단정 금지, 항상 "추천" 형태로 말할 것
- 모질·손상도는 파악 불가임을 인지하고 항상 "직접 확인하며 진행" 문구 포함
- 리스크(탁해짐, 과발색, 색 먹어들어감 등) 반드시 포함
- 비율 관련 질문에는 "소량씩 조절하며 테스트" 표현 사용

[색의 파워 순서 약→강]
노랑 < 주황 < 레드 < 블루 < 보라 < 블랙

[보색 관계]
노랑 → 바이올렛·보라 계열
주황 → 블루·애쉬 계열
붉은색 → 그린 계열
초록·카키 → 핑크·레드 또는 시나몬브라운
매트 → 바이올렛 소량+따뜻함 또는 시나몬브라운
노랑주황 → 청보라(애쉬+바이올렛)

[자연 탈색 단계]
블랙→짙은레드→레드→레드주황→주황→주황노랑→노랑→바나나껍질→바나나안쪽→아이보리

[명도별 한계]
어두운: 파스텔·밝은색 탈색 필수
중저: 잔류색 영향 큼, 보색 필요하나 탁해짐 가능
중고: 대부분 가능, 보색 시 채도 감소
밝은: 전부 가능, 파스텔 가능

[출력 구조]
1. 현재 상태 분석
2. 문제 원인
3. 해결 방향
4. 실무 추천
5. 결과 한계
6. 최적 솔루션

디자이너에게 설명하듯 자연스럽게, 학술적 표현 금지, 짧고 명확하게`;

export default async function handler(req, res) {
  console.log('[analyze] 요청:', req.method);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch(e) {
      return res.status(400).json({ error: 'body 파싱 실패' });
    }
  }

  const message = body?.message;
  console.log('[analyze] message 수신:', !!message);

  if (!message) {
    return res.status(400).json({ error: '메시지 없음' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  console.log('[analyze] API키 존재:', !!apiKey);

  if (!apiKey) {
    return res.status(500).json({ error: 'API 키 미설정' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: message }]
      })
    });

    console.log('[analyze] Anthropic 상태:', response.status);
    const data = await response.json();
    console.log('[analyze] 응답타입:', data.type, '에러:', data.error?.type);

    if (data.content && data.content[0] && data.content[0].text) {
      return res.status(200).json({ result: data.content[0].text });
    }

    return res.status(500).json({ error: 'API 응답 오류', detail: data });

  } catch (err) {
    console.error('[analyze] catch 오류:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
