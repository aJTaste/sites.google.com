// uv.sw.js

// 1. ライブラリを最初に読み込む
try {
  importScripts('https://cdn.jsdelivr.net/npm/@titaniumnetwork-dev/ultraviolet@3.2.7/dist/uv.bundle.js');
} catch (e) {
  console.error('UV bundle failed to load', e);
}

// 2. Ultraviolet が存在することを確認してから設定を行う
// 注意: Ultraviolet.codec ではなく Ultraviolet.encode など、
// 読み込んだライブラリのバージョンに合わせた正しいパスを指定してください。
self.__uv$config = {
  prefix: '/sites.google.com/uv/service/',
  bare: '/bare/', // VercelではBare Serverの構築が必要です
  encodeUrl: self.Ultraviolet.codec.xor.encode,
  decodeUrl: self.Ultraviolet.codec.xor.decode,
  handler: '/sites.google.com/uv/uv.handler.js',
  client: '/sites.google.com/uv/uv.client.js',
  bundle: '/sites.google.com/uv/uv.bundle.js',
  config: '/sites.google.com/uv/uv.config.js',
  sw: '/sites.google.com/uv/uv.sw.js'
};

const uv = new UVServiceWorker();

self.addEventListener('fetch', (event) => {
  if (event.request.url.startsWith(self.location.origin + self.__uv$config.prefix)) {
    event.respondWith(uv.fetch(event));
  }
});
