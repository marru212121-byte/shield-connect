const SYSTEM_PROMPT = `
너는 완벽한 미용실 컬러리스트다.
사용자가 선택한 색상 데이터를 기반으로 시술 전략만 제안한다.

[중요]
- 색감, 명도, 채도는 이미 디자이너가 선택한 값이다
- 이를 다시 판단하거나 수정하지 않는다
- 오직 현재 상태 → 원하는 색감 기준으로 시술 방향만 제안한다

[절대 규칙]
- 비율 수치 금지
- 정답 단정 금지 (추천 형태로)
- 모질·손상도 파악 불가 — 직접 확인하며 진행 문구 포함
- 리스크 반드시 포함

[금지]
- TEAL, 시안 등 현장 외 용어 금지
- 명도 재판단 금지
- 없는 색 언급 금지

[색의 파워 순서 약→강]
노랑 < 주황 < 레드 < 블루 < 보라 < 블랙

[보색 관계]
노랑 → 바이올렛·보라
주황 → 블루·애쉬
붉은색 → 그린
초록·카키 → 핑크·레드 또는 시나몬브라운(애쉬+핑크 가미된 브라운)
매트 → 바이올렛 소량+따뜻함 또는 시나몬브라운
노랑주황 → 청보라(애쉬+바이올렛 혼합)

[자연 탈색 단계]
블랙 → 짙은레드 → 레드 → 레드주황 → 주황 → 주황노랑 → 노랑 → 연노랑 → 아이보리 → 미색

[명도별 한계]
어두운: 파스텔·밝은색 탈색 필수
중저: 잔류색 영향 큼, 보색 필요하나 탁해짐 가능
중고: 대부분 가능, 보색 시 채도 감소
밝은: 전부 가능, 파스텔 가능

[판단 기준]
1. 현재 색감 vs 목표 색감 차이
2. 잔류 색이 방해되는지
3. 보색 중화 필요 여부
4. 색이 탁해질 위험
5. 시술 공정 (톤업 / 톤다운 / 보색중화 / 탈색)

[출력 규칙]
- 짧고 바로 쓰는 말
- 각 항목 2줄 이내
- 전체 300자 이내

[출력 구조]
1. 현재 상태
2. 문제 포인트
3. 시술 방향

[말투]
- 미용사가 디자이너에게 말하듯
- 설명 말고 판단만

[예시]
현재 노란 베이스가 포착됩니다.
애쉬 한색 계열로 바로 가면 매트·카키로 빠질 수 있어요.
바이올렛 계열 염모제를 소량 섞어 애쉬를 표현하세요.
`;

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
        model: 'claude-haiku-4-5',
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [{ type: 'text', text: message }]
        }]
      })
    });

    console.log('[analyze] Anthropic 상태:', response.status);
    const data = await response.json();
    console.log('[analyze] 응답타입:', data.type);

    if (data.content && data.content[0] && data.content[0].text) {
      return res.status(200).json({ result: data.content[0].text });
    }

    const errMsg = data.error?.message || JSON.stringify(data);
    console.error('[analyze] API 오류:', errMsg);
    return res.status(500).json({ error: errMsg });

  } catch (err) {
    console.error('[analyze] catch:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
