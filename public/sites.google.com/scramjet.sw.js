self.addEventListener("install",e=>{
  console.log('[SW] インストール開始');
  self.skipWaiting();
});

self.addEventListener("activate",e=>{
  console.log('[SW] アクティベート開始');
  e.waitUntil(self.clients.claim());
});

const DEFAULT_PREFIX='/sites.google.com/';

function getPrefix(){
  try{
    return(self.$scramjet&&self.$scramjet.prefix)||DEFAULT_PREFIX;
  }catch(e){
    console.error('[SW] プレフィックス取得エラー:',e);
    return DEFAULT_PREFIX;
  }
}

self.addEventListener('fetch',event=>{
  const reqUrl=new URL(event.request.url);
  
  // 全てのリクエストをログ出力
  console.log('[SW] fetch event:',reqUrl.pathname);
  
  try{
    const prefix=getPrefix();
    console.log('[SW] 使用プレフィックス:',prefix);
    
    if(!reqUrl.pathname.startsWith(prefix)){
      console.log('[SW] プレフィックス不一致 - スキップ');
      return;
    }
    
    console.log('[SW] プロキシ処理開始');
    
    const encoded=reqUrl.pathname.slice(prefix.length);
    console.log('[SW] エンコード済みURL:',encoded);
    
    if(!encoded){
      console.log('[SW] エンコードURL空 - スキップ');
      return;
    }
    
    let target;
    try{
      target=decodeURIComponent(encoded);
      console.log('[SW] デコード後URL:',target);
    }catch(e){
      console.error('[SW] デコードエラー:',e);
      return;
    }
    
    let targetUrl;
    try{
      targetUrl=new URL(target);
      console.log('[SW] パース後URL:',targetUrl.href);
      
      if(!['http:','https:'].includes(targetUrl.protocol)){
        throw new Error('invalid protocol');
      }
    }catch(e){
      console.error('[SW] URLパースエラー:',e);
      return;
    }
    
    console.log('[SW] fetch実行:',targetUrl.href);
    
    event.respondWith((async()=>{
      try{
        let resp;
        try{
          console.log('[SW] CORS fetch試行');
          resp=await fetch(targetUrl.href,{mode:'cors',credentials:'omit'});
        }catch(e){
          console.log('[SW] CORS失敗、no-cors試行:',e.message);
          resp=await fetch(targetUrl.href,{mode:'no-cors',credentials:'omit'});
        }
        
        console.log('[SW] fetch成功:',resp.type,resp.status);
        
        if(resp.type==='opaque'||resp.type==='opaque-stream'){
          console.log('[SW] opaque response返却');
          return resp;
        }
        
        const headers=new Headers(resp.headers);
        headers.delete('content-security-policy');
        headers.delete('x-frame-options');
        headers.delete('frame-options');
        
        const body=await resp.arrayBuffer();
        console.log('[SW] レスポンス返却:',body.byteLength,'bytes');
        
        return new Response(body,{
          status:resp.status,
          statusText:resp.statusText,
          headers
        });
      }catch(err){
        console.error('[SW] プロキシエラー:',err);
        return new Response('Proxy error: '+(err&&err.message||'unknown'),{
          status:502,
          headers:{'Content-Type':'text/plain; charset=utf-8'}
        });
      }
    })());
  }catch(e){
    console.error('[SW] 外側エラー:',e);
    return;
  }
});

console.log('[SW] Service Workerスクリプト読み込み完了');
