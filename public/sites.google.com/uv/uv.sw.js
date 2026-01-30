// ://sites.google.com

// 1. ライブラリの読み込み
try {
  importScripts('https://cdn.jsdelivr.net');
} catch (e) {
  console.error('[UV-SW] Failed to load UV bundle from CDN:', e);
}

// 2. 設定の定義 (Ultraviolet が読み込まれた前提)
self.__uv$config = {
  prefix: '/://sites.google.com',
  // ※Vercel単体では動作しないため、外部のBare Serverを指定する必要があります
  bare: 'https://uv.student-portal.workers.dev', 
  encodeUrl: self.Ultraviolet.codec.xor.encode,
  decodeUrl: self.Ultraviolet.codec.xor.decode,
  handler: 'https://cdn.jsdelivr.net',
  client: 'https://cdn.jsdelivr.net',
  bundle: 'https://cdn.jsdelivr.net',
  config: '/://sites.google.com',
  sw: '/://sites.google.com'
};

// 3. インスタンス作成
const uv = new self.UVServiceWorker();

self.addEventListener('fetch', (event) => {
  if (event.request.url.startsWith(self.location.origin + self.__uv$config.prefix)) {
    event.respondWith(uv.fetch(event));
  }
});
