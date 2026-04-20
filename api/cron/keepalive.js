// api/cron/keepalive.js
// 하루 1회 카페24 API를 호출해서 토큰 자동 갱신 유지
// Vercel Cron이 호출함

import { fetchOrder } from '../../lib/cafe24.js';

export default async function handler(req, res) {
  // Vercel Cron 인증 확인
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    // 존재하지 않는 주문번호로 조회 시도
    // (목적은 토큰 사용해서 리프레시 트리거, 주문 조회 결과 자체는 중요하지 않음)
    await fetchOrder('keepalive-ping').catch(() => {
      // 404 떠도 OK - 토큰은 사용된 것
    });

    console.log('[keepalive] 토큰 갱신 ping 완료:', new Date().toISOString());
    return res.status(200).json({
      ok: true,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[keepalive] 에러:', err);
    return res.status(500).json({ error: err.message });
  }
}
