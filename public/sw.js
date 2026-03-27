const CACHE_VERSION = 'v6';
const CACHE = `apphub-${CACHE_VERSION}`;
const STATIC = [
  '/sites.google.com/assets/favicon1.svg',
  '/sites.google.com/assets/icon1.svg',
  '/sites.google.com/manifest.json',
  '/sites.google.com/index.html',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(STATIC))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE).map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// pwa.js から SKIP_WAITING を受け取ったら即座に有効化
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

function staleWhileRevalidate(request) {
  return caches.match(request).then(cachedResponse => {
    const networkFetch = fetch(request).then(networkResponse => {
      if (networkResponse && networkResponse.ok) {
        const clone = networkResponse.clone();
        caches.open(CACHE).then(cache => cache.put(request, clone));
      }
      return networkResponse;
    }).catch(() => null);

    return cachedResponse || networkFetch;
  });
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  if (url.origin !== self.location.origin) return;

  const destination = e.request.destination;

  // 画像・フォントはキャッシュファースト
  if (destination === 'image' || destination === 'font') {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(networkResponse => {
          if (!networkResponse || !networkResponse.ok) return networkResponse;
          const clone = networkResponse.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
          return networkResponse;
        });
      })
    );
    return;
  }

  // ドキュメント（ナビゲーション）の場合はネットワーク優先、失敗時キャッシュ
  if (e.request.mode === 'navigate' || destination === 'document') {
    e.respondWith(
      fetch(e.request).then(networkResponse => {
        if (networkResponse && networkResponse.ok) {
          const clone = networkResponse.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return networkResponse;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // CSS/JS/その他は stale-while-revalidate で更新を反映
  e.respondWith(staleWhileRevalidate(e.request));
});
