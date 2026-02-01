// scramjet.sw.js - Service Worker (placed at /sites.google.com/scramjet.sw.js)

self.addEventListener("install",e=>{
  swLog&&swLog('[SW] インストール開始');
  self.skipWaiting();
});

self.addEventListener("activate",e=>{
  swLog&&swLog('[SW] アクティベート開始');
  e.waitUntil(self.clients.claim());
});

// ログ転送ユーティリティ（ページ側へ postMessage）
function swLog(...args){
  try{
    const msg=args.map(a=>{
      try{return typeof a==='string'?a:JSON.stringify(a);
      }catch{ return String(a); }
    }).join(' ');
    self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{
      for(const c of clients){
        try{ c.postMessage({type:'SW_LOG',data:msg}); }catch(e){}
      }
    });
  }catch(e){}
}

const DEFAULT_PREFIX='/sites.google.com/scramjet/service/';

function getPrefix(){
  try{
    return (self.$scramjet && self.$scramjet.prefix) || DEFAULT_PREFIX;
  }catch(e){
    swLog('[SW] プレフィックス取得例外',e && e.message);
    return DEFAULT_PREFIX;
  }
}

// テストエンドポイント（最優先）
self.addEventListener('fetch',event=>{
  try{
    const url=new URL(event.request.url);
    if(url.pathname==='/sites.google.com/scramjet/service/test'){
      swLog('[SW] test endpoint hit');
      event.respondWith(new Response('SW OK',{headers:{'Content-Type':'text/plain; charset=utf-8'}}));
      return;
    }
  }catch(e){}
});

// メインのプロキシ処理（Scramjet専用パスのみ処理し、その他は無音スキップ）
self.addEventListener('fetch',event=>{
  let reqUrl;
  try{ reqUrl=new URL(event.request.url); }catch{return;}
  const prefix=getPrefix();

  // Scramjet専用パス以外は何もせずスルー（ログも出さない）
  if(!reqUrl.pathname.startsWith(prefix))return;

  swLog('[SW] Scramjet fetch',reqUrl.pathname);

  const encoded=reqUrl.pathname.slice(prefix.length);
  if(!encoded){
    swLog('[SW] エンコードURL空');
    event.respondWith(new Response('Bad request',{status:400}));
    return;
  }

  let target;
  try{ target=decodeURIComponent(encoded); }catch(e){
    swLog('[SW] デコードエラー',e && e.message);
    event.respondWith(new Response('Decode error',{status:400}));
    return;
  }

  let targetUrl;
  try{
    targetUrl=new URL(target);
    if(!['http:','https:'].includes(targetUrl.protocol))throw new Error('invalid protocol');
  }catch(e){
    swLog('[SW] URLパースエラー',e && e.message);
    event.respondWith(new Response('Invalid URL',{status:400}));
    return;
  }

  event.respondWith((async ()=>{
    try{
      swLog('[SW] fetch実行',targetUrl.href);
      let resp;
      try{
        resp=await fetch(targetUrl.href,{mode:'cors',credentials:'omit'});
      }catch(e){
        swLog('[SW] CORS fetch 失敗、no-corsで再試行',e && e.message);
        resp=await fetch(targetUrl.href,{mode:'no-cors',credentials:'omit'});
      }

      swLog('[SW] fetch 成功 type/status',resp.type,resp.status);

      if(resp.type==='opaque' || resp.type==='opaque-stream'){
        swLog('[SW] opaque response返却');
        return resp;
      }

      const headers=new Headers(resp.headers);
      headers.delete('content-security-policy');
      headers.delete('x-frame-options');
      headers.delete('frame-options');

      const body=await resp.arrayBuffer();
      swLog('[SW] レスポンス返却 bytes',body.byteLength);
      return new Response(body,{status:resp.status,statusText:resp.statusText,headers});
    }catch(err){
      swLog('[SW] プロキシエラー',err && err.message);
      return new Response('Proxy error: '+(err && err.message || 'unknown'),{status:502,headers:{'Content-Type':'text/plain; charset=utf-8'}});
    }
  })());
});

swLog('[SW] Service Workerスクリプト読み込み完了');
