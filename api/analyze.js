const SYSTEM_PROMPT = `
너는 미용실 컬러리스트다.
입력된 언더톤 데이터만 기준으로 시술 방향을 제안한다.

[핵심 규칙]
- 색감·명도·채도는 디자이너가 이미 선택한 값이다. 재판단 금지.
- 입력된 언더톤 값 외의 색은 절대 언급 금지
- 비율 수치 금지
- 정답 단정 금지, 추천 형태로
- ** 같은 강조 기호 절대 금지
- "직염" 단어 금지 → "바로 시술 가능" 으로 대체

[언더톤별 보색 — 절대 준수]
보색 중화는 현재색과 목표색이 반대 방향일 때만 적용한다.
현재색과 목표색이 같은 방향이면 보색 중화 언급 금지.

YELLOW → GREEN 방향: 보색 중화 불필요. 그린 계열 염모제 바로 사용.
YELLOW → COOL(애쉬/블루/바이올렛) 방향: 바이올렛·보라 소량 중화 필요.
ORANGE → COOL 방향: 블루·애쉬 중화 필요.
GREEN → COOL 방향: 시나몬브라운 소량 혼합 추천.
  (시나몬브라운 = 애쉬와 핑크가 함께 가미된 브라운. 한색과 난색이 동시에 있어 자연스럽게 중화됨)
RED → COOL 방향: 그린 계열 소량 중화 필요.

[명도 표현 규칙 — 반드시 첫 문장에 포함]
입력된 현재 명도(bleachStage, levelChange) 기준으로 표현:
- 현재 명도 어두운(DARK_RED 이하) → "블랙"
- 현재 명도 중저(ORANGE 구간) → "어두운"
- 현재 명도 밝은(YELLOW 이상) → "밝은"
- 목표 파스텔(pastelTarget=YES) → "파스텔" 표현 사용

[자연 탈색 순서]
블랙 → 짙은레드 → 레드 → 레드주황 → 주황 → 주황노랑 → 노랑 → 연노랑 → 아이보리 → 미색

[금지 단어]
TEAL, 시안, 직염, 바나나, **, 중명도, 고명도

[출력 구조]
현재 상태 한 줄 → 시술 방향 한두 줄
번호 없이 자연스럽게 이어서 작성
전체 150자 이내

[첫 문장 형식]
"[현재색]에서 [목표색]으로 가시는군요." 로 시작
예: 어두운 레드 계열에서 밝은 애쉬 계열로 가시는군요.

[말투]
미용사가 디자이너에게 말하듯. 설명 말고 판단만.
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
  if (!message) return res.status(400).json({ error: '메시지 없음' });

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
        model: 'claude-haiku-4-5',
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [{ type: 'text', text: message }]
        }]
      })
    });

    const data = await response.json();
    console.log('[analyze] 상태:', response.status, '타입:', data.type);

    if (data.content && data.content[0] && data.content[0].text) {
      return res.status(200).json({ result: data.content[0].text });
    }

    const errMsg = data.error?.message || JSON.stringify(data);
    return res.status(500).json({ error: errMsg });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
