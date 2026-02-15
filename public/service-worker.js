const CACHE_NAME = 'chatconnect-v1';
const urlsToCache = [
  '/',
  '/css/style.css',
  '/js/auth.js',
  '/js/chat.js',
  '/js/mypage.js',
  '/js/admin.js',
  '/manifest.json'
];

// インストール時にキャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// アクティベート時に古いキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ネットワーク優先戦略（APIはキャッシュしない）
self.addEventListener('fetch', (event) => {
  // API リクエストはキャッシュしない
  if (event.request.url.includes('/api/') || 
      event.request.url.includes('/socket.io/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // レスポンスをクローンしてキャッシュに保存
        const responseToCache = response.clone();
        caches.open(CACHE_NAME)
          .then((cache) => cache.put(event.request, responseToCache));
        return response;
      })
      .catch(() => {
        // ネットワークが失敗したらキャッシュから返す
        return caches.match(event.request);
      })
  );
});
