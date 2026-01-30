// Ultraviolet Service Worker - シンプル版

console.log('🔧 [UV-SW] Service Worker起動');

// CDNからUltravioletライブラリをインポート
importScripts('https://cdn.jsdelivr.net/npm/@titaniumnetwork-dev/ultraviolet@3.2.7/dist/uv.bundle.js');
console.log('✅ [UV-SW] UVライブラリ読み込み完了');

// 設定
const config={
  prefix:'/sites.google.com/uv/service/',
  bare:'https://uv-bare.onrender.com/',
  encodeUrl:Ultraviolet.codec.xor.encode,
  decodeUrl:Ultraviolet.codec.xor.decode,
  handler:'/sites.google.com/uv/uv.handler.js',
  client:'/sites.google.com/uv/uv.client.js',
  bundle:'/sites.google.com/uv/uv.bundle.js',
  config:'/sites.google.com/uv/uv.config.js',
  sw:'/sites.google.com/uv/uv.sw.js'
};

self.__uv$config=config;
console.log('✅ [UV-SW] 設定完了');

// UVインスタンス作成
const uv=new UVServiceWorker();
console.log('✅ [UV-SW] UVインスタンス作成完了');

// fetchイベント
self.addEventListener('fetch',(event)=>{
  if(event.request.url.startsWith(location.origin+config.prefix)){
    event.respondWith(
      (async()=>{
        try{
          return await uv.fetch(event);
        }catch(err){
          console.error('❌ [UV-SW] Fetch Error:',err);
          return new Response('Proxy Error',{status:500});
        }
      })()
    );
  }
});

// アクティベーション
self.addEventListener('activate',(event)=>{
  console.log('🚀 [UV-SW] アクティブ化');
  event.waitUntil(self.clients.claim());
});

console.log('✅ [UV-SW] セットアップ完了');
