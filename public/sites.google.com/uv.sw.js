importScripts('https://cdn.jsdelivr.net/npm/@titaniumnetwork-dev/ultraviolet@3/dist/uv.bundle.js');
importScripts('/sites.google.com/uv.config.js');
importScripts('https://cdn.jsdelivr.net/npm/@titaniumnetwork-dev/ultraviolet@3/dist/uv.handler.js');

const uv=new UVServiceWorker();

self.addEventListener('install',()=>{
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch',event=>{
  if(event.request.url.startsWith(location.origin+__uv$config.prefix)){
    event.respondWith(
      uv.fetch(event).catch(err=>{
        console.error('UV fetch error:',err);
        return new Response('Proxy Error',{status:500});
      })
    );
  }
});
