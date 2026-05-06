// api/cron/warm-image.js
// ═══════════════════════════════════════════════════════════════
// HAIRO 사진 생성 함수 워밍업 cron
// ═══════════════════════════════════════════════════════════════
// 목적:
//   1. /api/generate-image 함수 컨테이너를 항상 깨어있게 유지
//   2. Google Generative Language API 연결 풀 유지 (DNS, TLS handshake)
//   → cold start로 인한 첫 호출 timeout 방지
//
// 주의:
//   - Vercel Fluid Compute 쓰는 경우 효과가 미미할 수 있음
//   - 진짜 사진 생성은 안 함 (크레딧 안 씀, 비용 0)
//   - Google API에 가벼운 GET 요청만 보내서 연결 유지
// ═══════════════════════════════════════════════════════════════

export const config = {
  maxDuration: 30,
};

export default async function handler(req, res) {
  // Vercel Cron 인증
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const startTime = Date.now();
  const results = {
    timestamp: new Date().toISOString(),
    google_ping: null,
    elapsed_ms: 0,
  };

  try {
    const geminiKey = process.env.HAIRO_NANOBANANA2;
    if (!geminiKey) {
      results.google_ping = 'no_key';
      return res.status(500).json(results);
    }

    // Google API 가벼운 호출 - 모델 목록 조회 (이미지 생성 X, 비용 0)
    // 목적: TLS handshake + DNS 캐시 + 연결 풀 유지
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1',
        {
          method: 'GET',
          headers: { 'x-goog-api-key': geminiKey },
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);
      results.google_ping = response.ok ? 'ok' : `http_${response.status}`;
    } catch (err) {
      clearTimeout(timeoutId);
      results.google_ping = err.name === 'AbortError' ? 'timeout' : `error_${err.message}`;
    }

    results.elapsed_ms = Date.now() - startTime;
    console.log('[warm-image] ping 완료:', results);
    return res.status(200).json(results);
  } catch (err) {
    console.error('[warm-image] 에러:', err);
    results.elapsed_ms = Date.now() - startTime;
    return res.status(500).json({ ...results, error: err.message });
  }
}
