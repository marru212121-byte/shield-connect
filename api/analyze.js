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
[명도 표현 규칙]


[문장 생성 규칙]

첫 문장은 반드시
"현재 색감 → 목표 색감" 구조로 시작한다.
디자이너가 선택한 명도는 아래 기준으로만 표현한다.
- 중저명도 이하 → "어두운"
- 중저명도 초과 → "밝은"
- 밝은 단계에서 채도가 낮은 경우 → "파스텔"

다른 표현(중명도, 고명도 등)은 사용하지 않는다.
[예시] 어두운 레드계열에서 밝은 애쉬계열로가시려고하는군요


[금지]
- TEAL, 시안 등 현장 외 용어 금지
- 명도 재판단 금지
- 없는 색 언급 금지
-바나나필 단어금지


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
[언더톤별 보색 규칙 — 반드시 준수]

[언더톤 세분화 규칙]

현재 언더톤이 YELLOW일 경우:
- 순수 노랑 상태로 판단한다
- 보색은 바이올렛·보라만 사용한다

현재 언더톤이 YELLOW_ORANGE일 경우:
- 노랑에 주황이 섞인 상태로 판단한다
- 보색은 청보라(애쉬+바이올렛 혼합) 계열을 사용한다

추론으로 새로운 색을 만들지 말고
입력값에 존재하는 언더톤만 기준으로 판단한다.
현재 언더톤이 YELLOW일 경우:
- 보색은 바이올렛·보라만 사용한다
- 주황, 붉은기, 애쉬, 블루 관련 표현은 절대 금지
- 위 규칙을 어기면 잘못된 답변이다

현재 언더톤이 ORANGE일 경우:
- 보색은 블루·애쉬만 사용한다

현재 언더톤이 RED일 경우:
- 보색은 블루와 그린만 사용한다
현재 명도보다 목표 명도가 높은 경우:
- 색 적용보다 명도 확보가 우선이다
- 명도가 부족한 상태에서는 파스텔 표현이 어렵다
- 필요 시 탈색 또는 명도 상승 공정이 선행되어야 한다


→ 이미 한색 계열
→ 난색 방향 시 탈색 언급
[출력 규칙]
- 짧고 바로 쓰는 말
- 각 항목 2줄 이내
- 전체 200자 이내
[출력 구조]
1. 현재 상태
2. 시술 방향

[출력 규칙]
- ** 같은 강조 표시 절대 금지
- "직염" 단어 사용 금지, 대신 "바로 시술 가능" 사용
- 전체 200자 이내
- 번호 없이 자연스럽게 이어서 작성
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
