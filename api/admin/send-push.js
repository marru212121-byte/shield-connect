// api/admin/send-push.js
// ═══════════════════════════════════════════════════════════════
// 푸시 발송 + 구독자 목록 (어드민 전용)
// ═══════════════════════════════════════════════════════════════
// GET  /api/admin/send-push
//   → 구독자 목록 (member_id별로 묶음, 회원 정보 일부 포함)
// POST /api/admin/send-push
//   body: { title, body, url?, target: 'all' | string[] }
//     - target 'all'  → 전체 구독자
//     - target [...]  → 선택한 member_id 배열만
//   → web-push로 발송. 만료된 구독(410/404)은 자동 삭제.
// ═══════════════════════════════════════════════════════════════

import webpush from 'web-push';
import { requireAdmin } from '../../lib/admin-auth.js';
import { getSupabase } from '../../lib/supabase.js';

// VAPID 설정 (환경변수에서 읽음)
//   VAPID_PUBLIC_KEY  : 공개키 (프론트와 동일)
//   VAPID_PRIVATE_KEY : 개인키 (절대 노출 금지)
//   VAPID_SUBJECT     : mailto:이메일 또는 사이트 URL (없으면 기본값)
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@shield-connect.app';

let vapidReady = false;
function ensureVapid() {
  if (vapidReady) return true;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  vapidReady = true;
  return true;
}

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  res.setHeader('Cache-Control', 'no-store');

  const supabase = getSupabase();

  // ─── 구독자 목록 ────────────────────────────────────────
  if (req.method === 'GET') {
    try {
      const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('member_id, endpoint, created_at')
        .order('created_at', { ascending: false });

      // member_id별로 묶기 (한 회원이 여러 기기 구독 가능)
      const byMember = {};
      for (const s of subs || []) {
        if (!byMember[s.member_id]) {
          byMember[s.member_id] = { member_id: s.member_id, devices: 0, last: s.created_at };
        }
        byMember[s.member_id].devices++;
      }
      const subscribers = Object.values(byMember);

      return res.status(200).json({
        total_subscribers: subscribers.length,
        total_devices: (subs || []).length,
        subscribers,
      });
    } catch (err) {
      console.error('[admin/send-push GET] error:', err);
      return res.status(500).json({ code: 'server_error', message: err.message });
    }
  }

  // ─── 발송 ────────────────────────────────────────────────
  if (req.method === 'POST') {
    if (!ensureVapid()) {
      return res.status(500).json({
        code: 'vapid_not_configured',
        message: 'VAPID 키 환경변수(VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)가 설정되지 않았어요.',
      });
    }

    try {
      const { title, body, url, target } = req.body || {};
      if (!title || !String(title).trim()) {
        return res.status(400).json({ code: 'missing_title', message: '알림 제목을 입력해주세요.' });
      }

      // 대상 구독 조회
      let q = supabase.from('push_subscriptions').select('member_id, endpoint, p256dh, auth');
      if (Array.isArray(target) && target.length > 0) {
        q = q.in('member_id', target);
      } // target === 'all' 또는 미지정이면 전체
      const { data: subs } = await q;

      if (!subs || subs.length === 0) {
        return res.status(200).json({ ok: true, sent: 0, failed: 0, removed: 0, message: '발송 대상이 없어요.' });
      }

      const payload = JSON.stringify({
        title: String(title),
        body: body ? String(body) : '',
        url: url ? String(url) : '/',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
      });

      let sent = 0, failed = 0;
      const expiredEndpoints = [];

      // 순차 발송 (구독 수 적을 때 충분. 많아지면 배치/병렬로 개선)
      for (const s of subs) {
        const subscription = {
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth },
        };
        try {
          await webpush.sendNotification(subscription, payload);
          sent++;
        } catch (err) {
          failed++;
          // 410 Gone / 404 = 만료·해지된 구독 → 정리 대상
          const code = err?.statusCode;
          if (code === 410 || code === 404) {
            expiredEndpoints.push(s.endpoint);
          } else {
            console.error('[admin/send-push] send fail:', code, err?.body || err?.message);
          }
        }
      }

      // 만료된 구독 자동 삭제 (다음 발송부터 깔끔하게)
      let removed = 0;
      if (expiredEndpoints.length > 0) {
        const { error: delErr } = await supabase
          .from('push_subscriptions')
          .delete()
          .in('endpoint', expiredEndpoints);
        if (!delErr) removed = expiredEndpoints.length;
      }

      return res.status(200).json({ ok: true, sent, failed, removed });
    } catch (err) {
      console.error('[admin/send-push POST] error:', err);
      return res.status(500).json({ code: 'server_error', message: err.message });
    }
  }

  return res.status(405).json({ code: 'method_not_allowed' });
}
