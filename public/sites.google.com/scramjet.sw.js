self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(url.pathname==='/sites.google.com/scramjet/service/test'){
    event.respondWith(new Response('SW OK',{status:200}));
  }
});




// scramjet.sw.js (配置: /sites.google.com/scramjet.sw.js)
self.addEventListener("install",e=>self.skipWaiting());
self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));

const DEFAULT_PREFIX = '/sites.google.com/scramjet/service/';
function getPrefix(){ try{ return (self.$scramjet && self.$scramjet.prefix) || DEFAULT_PREFIX; }catch(e){ return DEFAULT_PREFIX; } }

self.addEventListener('fetch', event=>{
  try{
    const reqUrl = new URL(event.request.url);
    const prefix = getPrefix();

    if(!reqUrl.pathname.startsWith(prefix)) return;

    const encoded = reqUrl.pathname.slice(prefix.length);
    if(!encoded) return;

    let target;
    try{ target = decodeURIComponent(encoded); }catch(e){ return; }

    let targetUrl;
    try{
      targetUrl = new URL(target);
      if(!['http:','https:'].includes(targetUrl.protocol)) throw new Error('invalid protocol');
    }catch(e){ return; }

    event.respondWith((async ()=>{
      try{
        let resp;
        try{
          resp = await fetch(targetUrl.href, { mode:'cors', credentials:'omit' });
        }catch(e){
          resp = await fetch(targetUrl.href, { mode:'no-cors', credentials:'omit' });
        }

        if(resp.type==='opaque' || resp.type==='opaque-stream') return resp;

        const headers = new Headers(resp.headers);
        headers.delete('content-security-policy');
        headers.delete('x-frame-options');
        headers.delete('frame-options');

        const body = await resp.arrayBuffer();
        return new Response(body, { status: resp.status, statusText: resp.statusText, headers });
      }catch(err){
        return new Response('Proxy error: '+(err&&err.message||'unknown'), { status:502, headers:{'Content-Type':'text/plain; charset=utf-8'} });
      }
    })());
  }catch(e){
    return;
  }
});
