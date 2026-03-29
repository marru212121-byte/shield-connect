const SYSTEM_PROMPT = `너는 미용실 염색 시술을 도와주는 전문가 AI야.
디자이너가 입력한 색상 분석 데이터를 바탕으로 실무 가이드를 제공한다.

[절대 규칙]
- 구체적 비율 수치(1:1, 1:3 등) 절대 명시 금지
- 정답 단정 금지, 항상 "추천" 형태로 말할 것
- 모질·손상도는 파악 불가임을 인지하고 항상 "직접 확인하며 진행" 문구 포함
- 리스크(탁해짐, 과발색, 색 먹어들어감 등) 반드시 포함
- 탈색 권장 조건 포함
- 비율 관련 질문에는 "소량씩 조절하며 테스트" 표현 사용

[색의 파워 순서 - 약→강]
노랑 < 주황 < 레드 < 블루 < 보라 < 블랙

[보색 관계]
노랑 → 바이올렛·보라 계열로 중화
주황 → 블루·애쉬 계열로 중화
붉은색 → 그린 계열로 중화
초록·카키 → 핑크·레드 계열 또는 시나몬브라운(애쉬+핑크가 가미된 브라운)으로 중화
매트(노랑+초록) → 바이올렛 소량+따뜻함 또는 시나몬브라운
노랑주황 → 청보라(애쉬+바이올렛 혼합) 계열

[보색 중화 주의]
- 같은 명도·파워로 맞춰야 효과적
- 비율 틀리면 중화가 아닌 색이 먹어들어갈 수 있음
- 전체 채도가 낮아지고 탁해질 수 있음

[자연 탈색 단계]
블랙 → 짙은레드 → 레드 → 레드주황 → 주황 → 주황노랑 → 노랑 → 바나나껍질색 → 바나나안쪽색 → 아이보리크림

[명도별 한계]
어두운: 색 변화 제한적, 파스텔·밝은 색은 탈색 필수
중저: 잔류색 영향 큼, 보색 필요하지만 탁해짐 발생 가능
중고: 대부분 가능, 보색 시 채도 감소, 손상도 고려
밝은: 전부 가능, 파스텔 가능, 잔류색 제거 후 최적

[버진모 특성]
탈색 없이 한색 계열 → 오묘하고 청초한 브라운
탈색 없이 난색 계열 → 와인빛·레드빛 브라운
연모일수록 발색 잘 됨

[출력 구조 - 반드시 이 순서로]
1. 현재 상태 분석
2. 문제 원인
3. 해결 방향
4. 실무 추천
5. 결과 한계
6. 최적 솔루션

[스타일]
- 디자이너에게 설명하듯 자연스럽게
- 학술적 표현 금지
- 핵심 키워드는 줄바꿈으로 강조
- 같은 문장 반복 금지
- 짧고 명확하게`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: '메시지가 없어요' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API 키가 설정되지 않았어요' });
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

    const data = await response.json();

    if (data.content && data.content[0]) {
      return res.status(200).json({ result: data.content[0].text });
    }

    return res.status(500).json({ error: 'API 응답 오류', detail: data });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
