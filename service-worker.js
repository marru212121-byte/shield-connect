const CACHE_NAME = 'shield-v6';

// 설치: 빈 캐시로 시작
self.addEventListener('install', e => {
  self.skipWaiting();
});

// 활성화: 이전 캐시 삭제
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// fetch: network-first (항상 최신 버전 우선)
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  // ★ v5 (2026-05-15): /api/* 는 SW 우회 — 개인 데이터(잔액 등) 캐시 금지
  // 잔액·세션·어드민 데이터는 항상 서버에서 최신값 받도록
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/')) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// ════════════════════════════════════════════════════════════
// 푸시 알림 (v6, 2026-05-31 추가) — 위 캐시 로직과 완전히 독립
//   · 서버(web-push)가 보낸 푸시를 받아 알림 표시
//   · 알림 탭하면 앱(홈)을 열거나 이미 열린 탭으로 포커스
//   · 캐시/fetch 로직은 전혀 건드리지 않음
// ════════════════════════════════════════════════════════════
self.addEventListener('push', e => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch (_) {
    // JSON 아니면 텍스트로
    try { data = { body: e.data.text() }; } catch (__) { data = {}; }
  }

  const title = data.title || '쉴드 디자이너 커넥트';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    data: { url: data.url || '/' },   // 탭했을 때 열 주소
    tag: data.tag || undefined,        // 같은 tag면 알림 덮어쓰기(중복 방지)
  };

  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const targetUrl = (e.notification.data && e.notification.data.url) || '/';

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // 이미 열린 창이 있으면 그쪽으로 포커스
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            try { client.navigate(targetUrl); } catch (_) {}
          }
          return;
        }
      }
      // 열린 창이 없으면 새로 염
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
