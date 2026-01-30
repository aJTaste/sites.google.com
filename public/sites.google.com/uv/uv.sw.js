/* sites.google.com/uv/uv.sw.js */
try {
    // 1. ライブラリ読み込み
    importScripts('https://cdn.jsdelivr.net');

    // 2. 設定
    self.__uv$config = {
        prefix: '/://sites.google.com',
        bare: 'https://uv.student-portal.workers.dev', 
        encodeUrl: self.Ultraviolet.codec.xor.encode,
        decodeUrl: self.Ultraviolet.codec.xor.decode,
        handler: 'https://cdn.jsdelivr.net',
        client: 'https://cdn.jsdelivr.net',
        bundle: 'https://cdn.jsdelivr.net',
        config: '/://sites.google.com',
        sw: '/sites.google.com/uv/uv.sw.js'
    };

    // 3. インスタンス初期化
    if (self.UVServiceWorker) {
        const uv = new self.UVServiceWorker();
        self.addEventListener('fetch', (event) => {
            if (event.request.url.startsWith(self.location.origin + self.__uv$config.prefix)) {
                event.respondWith(uv.fetch(event));
            }
        });
    }
} catch (e) {
    console.error('Critical SW Evaluation Error:', e);
}
