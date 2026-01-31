// Ultraviolet Service Worker
console.log('🔧 [UV-SW] Service Worker起動');

// UVライブラリをCDNからインポート
importScripts('https://cdn.jsdelivr.net/npm/@titaniumnetwork-dev/ultraviolet@3.2.7/dist/uv.bundle.js');
importScripts('https://cdn.jsdelivr.net/npm/@titaniumnetwork-dev/ultraviolet@3.2.7/dist/uv.handler.js');
importScripts('https://cdn.jsdelivr.net/npm/@titaniumnetwork-dev/ultraviolet@3.2.7/dist/uv.sw.js');

console.log('✅ [UV-SW] ライブラリ読み込み完了');

// 設定
const uvConfig={
  prefix:'/sites.google.com/uv/service/',
  bare:'https://uv-bare.onrender.com/',
  encodeUrl:Ultraviolet.codec.xor.encode,
  decodeUrl:Ultraviolet.codec.xor.decode
};

self.__uv$config=uvConfig;

// UVインスタンス
const uv=new UVServiceWorker();

// インストールイベント
self.addEventListener('install',(event)=>{
  console.log('📦 [UV-SW] インストール');
  event.waitUntil(self.skipWaiting());
});

// アクティベーションイベント
self.addEventListener('activate',(event)=>{
  console.log('🚀 [UV-SW] アクティブ化');
  event.waitUntil(self.clients.claim());
});

// Fetchイベント
self.addEventListener('fetch',(event)=>{
  const url=new URL(event.request.url);
  
  if(url.pathname.startsWith(uvConfig.prefix)){
    console.log('🌐 [UV-SW] プロキシリクエスト:',url.pathname);
    
    event.respondWith(
      (async()=>{
        try{
          const response=await uv.fetch(event);
          console.log('✅ [UV-SW] レスポンス成功');
          return response;
        }catch(err){
          console.error('❌ [UV-SW] Fetch Error:',err);
          return new Response(`プロキシエラー: ${err.message}`,{
            status:500,
            headers:{'Content-Type':'text/plain;charset=utf-8'}
          });
        }
      })()
    );
  }
});

console.log('✅ [UV-SW] セットアップ完了');
