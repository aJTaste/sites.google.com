function swLog(...args){
  self.clients.matchAll({includeUncontrolled:true,type:'window'})
    .then(clients=>{
      for(const client of clients){
        client.postMessage({
          type:'SW_LOG',
          data:args.map(a=>{
            try{return typeof a==='string'?a:JSON.stringify(a);}
            catch{return String(a);}
          }).join(' ')
        });
      }
    });
}


self.addEventListener("install",e=>{
  swLog('[SW] インストール開始');
  self.skipWaiting();
});

self.addEventListener("activate",e=>{
  swLog('[SW] アクティベート開始');
  e.waitUntil(self.clients.claim());
});

const DEFAULT_PREFIX='/sites.google.com/scramjet/service/';

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
  swLog('[SW] fetch event:',reqUrl.pathname);
  
  try{
    const prefix=getPrefix();
    swLog('[SW] 使用プレフィックス:',prefix);
    
    if(!reqUrl.pathname.startsWith(prefix)){
      swLog('[SW] プレフィックス不一致 - スキップ');
      return;
    }
    
    swLog('[SW] プロキシ処理開始');
    
    const encoded=reqUrl.pathname.slice(prefix.length);
    swLog('[SW] エンコード済みURL:',encoded);
    
    if(!encoded){
      swLog('[SW] エンコードURL空 - スキップ');
      return;
    }
    
    let target;
    try{
      target=decodeURIComponent(encoded);
      swLog('[SW] デコード後URL:',target);
    }catch(e){
      console.error('[SW] デコードエラー:',e);
      return;
    }
    
    let targetUrl;
    try{
      targetUrl=new URL(target);
      swLog('[SW] パース後URL:',targetUrl.href);
      
      if(!['http:','https:'].includes(targetUrl.protocol)){
        throw new Error('invalid protocol');
      }
    }catch(e){
      console.error('[SW] URLパースエラー:',e);
      return;
    }
    
    swLog('[SW] fetch実行:',targetUrl.href);
    
    event.respondWith((async()=>{
      try{
        let resp;
        try{
          swLog('[SW] CORS fetch試行');
          resp=await fetch(targetUrl.href,{mode:'cors',credentials:'omit'});
        }catch(e){
          swLog('[SW] CORS失敗、no-cors試行:',e.message);
          resp=await fetch(targetUrl.href,{mode:'no-cors',credentials:'omit'});
        }
        
        swLog('[SW] fetch成功:',resp.type,resp.status);
        
        if(resp.type==='opaque'||resp.type==='opaque-stream'){
          swLog('[SW] opaque response返却');
          return resp;
        }
        
        const headers=new Headers(resp.headers);
        headers.delete('content-security-policy');
        headers.delete('x-frame-options');
        headers.delete('frame-options');
        
        const body=await resp.arrayBuffer();
        swLog('[SW] レスポンス返却:',body.byteLength,'bytes');
        
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

swLog('[SW] Service Workerスクリプト読み込み完了');
