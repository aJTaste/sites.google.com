// Ultraviolet Service Worker

console.log('🔧 [UV-SW] Service Worker起動');

// UVライブラリのインポート
importScripts('/sites.google.com/uv/uv.bundle.js');
importScripts('/sites.google.com/uv/uv.config.js');

console.log('✅ [UV-SW] UVライブラリ読み込み完了');

// UVインスタンス作成
const uv=new UVServiceWorker();

console.log('✅ [UV-SW] UVインスタンス作成完了');

// fetchイベントハンドラー
self.addEventListener('fetch',(event)=>{
  console.log('📡 [UV-SW] Fetch:',event.request.url);
  
  // UVリクエストの場合のみ処理
  if(event.request.url.startsWith(self.registration.scope)){
    console.log('🔄 [UV-SW] UV処理開始');
    event.respondWith(
      (async()=>{
        try{
          const response=await uv.fetch(event);
          console.log('✅ [UV-SW] UV処理完了');
          return response;
        }catch(error){
          console.error('❌ [UV-SW] UV処理エラー:',error);
          return new Response('Proxy Error',{
            status:500,
            statusText:'Internal Server Error'
          });
        }
      })()
    );
  }
});

// アクティベーション
self.addEventListener('activate',(event)=>{
  console.log('🚀 [UV-SW] Service Worker アクティブ化');
  event.waitUntil(clients.claim());
});

console.log('✅ [UV-SW] Service Worker セットアップ完了');
