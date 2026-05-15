const CACHE_NAME = 'shield-v5';

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
