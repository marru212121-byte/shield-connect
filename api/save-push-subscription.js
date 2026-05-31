// api/save-push-subscription.js
// ═══════════════════════════════════════════════════════════════
// 푸시 구독 정보 저장 — "알림 받기" 허용한 회원의 구독을 보관
// ═══════════════════════════════════════════════════════════════
// POST /api/save-push-subscription
// body: { subscription: {...}, standalone?: bool }
//   - subscription: 브라우저 PushManager.subscribe()가 준 객체
//   - 회원 식별은 쿠키 세션에서 member_id를 읽음 (프론트는 ID 안 보냄)
//   - endpoint 기준 upsert (같은 기기 재구독 시 중복 안 쌓이게)
// 응답: 항상 200 (부가기능 — 실패가 앱을 막으면 안 됨)
// ═══════════════════════════════════════════════════════════════

import { getSessionFromRequest } from '../lib/session.js';
import { getSupabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(200).json({ ok: false, reason: 'method' });
  }

  try {
    // 로그인 회원만 (세션에서 member_id) — 비회원/세션없음은 조용히 무시
    const session = getSessionFromRequest(req);
    if (!session?.memberId) {
      return res.status(200).json({ ok: false, reason: 'no_session' });
    }
    const memberId = session.memberId;

    const body = req.body || {};
    const sub = body.subscription;
    // 구독 객체 최소 검증 (endpoint와 keys가 있어야 발송 가능)
    if (!sub || typeof sub !== 'object' || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
      return res.status(200).json({ ok: false, reason: 'invalid_subscription' });
    }

    const supabase = getSupabase();

    // endpoint 기준 upsert — 같은 기기에서 재구독해도 한 줄로 유지
    await supabase
      .from('push_subscriptions')
      .upsert(
        {
          member_id: memberId,
          endpoint: sub.endpoint,
          p256dh: sub.keys.p256dh,
          auth: sub.keys.auth,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      );

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[save-push-subscription] error:', err?.message || err);
    return res.status(200).json({ ok: false, reason: 'server' });
  }
}
