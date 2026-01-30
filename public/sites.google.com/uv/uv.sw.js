// Ultraviolet Service Worker

console.log('🔧 [UV-SW] Service Worker起動');

// UVライブラリのインポート（CDNから）
try{
  console.log('📥 [UV-SW] ライブラリ読み込み開始...');
  importScripts('https://cdn.jsdelivr.net/npm/@titaniumnetwork-dev/ultraviolet@3.2.7/dist/uv.bundle.js');
  console.log('✅ [UV-SW] UVライブラリ読み込み完了');
}catch(error){
  console.error('❌ [UV-SW] ライブラリ読み込みエラー:',error);
  throw error;
}

// UV設定を定義（Ultravioletが読み込まれた後）
self.__uv$config={
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

console.log('✅ [UV-SW] 設定完了',self.__uv$config);

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
