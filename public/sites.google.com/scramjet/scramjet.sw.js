// scramjet.sw.js
// 最小限のプロキシ機能を持つ Service Worker

self.addEventListener("install", e => { self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(self.clients.claim()); });

// self.$scramjet は scramjet.config.js でページ側に設定される（存在しない場合はデフォルトを使用）
const DEFAULT_PREFIX = '/sites.google.com/scramjet/service/';

function getPrefix(){
  try{
    return (self.$scramjet && self.$scramjet.prefix) || DEFAULT_PREFIX;
  }catch(e){
    return DEFAULT_PREFIX;
  }
}

self.addEventListener('fetch', event=>{
  try{
    const reqUrl = new URL(event.request.url);
    const prefix = getPrefix();

    // scope 内のリクエストのみ対象（scopeの外はSWが受け取らないが念のため）
    if(!reqUrl.pathname.startsWith(prefix)) return;

    const encoded = reqUrl.pathname.slice(prefix.length);
    if(!encoded) return;

    let target;
    try{
      target = decodeURIComponent(encoded);
    }catch(e){
      // デコード失敗は無視してパススルー
      return;
    }

    // target が有効な absolute URL かチェック
    let targetUrl;
    try{
      targetUrl = new URL(target);
      if(!['http:','https:'].includes(targetUrl.protocol)) throw new Error('invalid protocol');
    }catch(e){
      return;
    }

    event.respondWith((async ()=>{
      try{
        // リモートへのフェッチ
        // mode:'cors' を試し、失敗する場合は no-cors でフェールバックする
        let resp;
        try{
          resp = await fetch(targetUrl.href, { mode:'cors', credentials:'omit' });
        }catch(e){
          // CORS 等で失敗した場合、no-cors で取得（opaque response）
          resp = await fetch(targetUrl.href, { mode:'no-cors', credentials:'omit' });
        }

        // opaque レスポンスならそのまま返す（ヘッダ改変不可）
        if(resp.type === 'opaque' || resp.type === 'opaque-stream'){
          return resp;
        }

        // 通常のレスポンスならヘッダのうちセキュリティによって阻害するものを削除して返す
        const headers = new Headers(resp.headers);
        headers.delete('content-security-policy');
        headers.delete('x-frame-options');
        headers.delete('frame-options');

        const body = await resp.arrayBuffer();
        return new Response(body, {
          status: resp.status,
          statusText: resp.statusText,
          headers
        });
      }catch(err){
        return new Response('Proxy error: '+(err && err.message || 'unknown'), { status:502, headers: {'Content-Type':'text/plain; charset=utf-8'} });
      }
    })());
  }catch(e){
    // 何もしない（安全のため）
    return;
  }
});
