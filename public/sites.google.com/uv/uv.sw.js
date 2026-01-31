// Ultraviolet Service Worker
importScripts('/sites.google.com/uv/uv.bundle.js');
importScripts('/sites.google.com/uv/uv.config.js');

const uv=new UVServiceWorker();

self.addEventListener('fetch',(event)=>{
  event.respondWith(
    (async()=>{
      if(uv.route(event)){
        return await uv.fetch(event);
      }
      return await fetch(event.request);
    })()
  );
});

self.addEventListener('message',(event)=>{
  if(event.data&&event.data.type==='SKIP_WAITING'){
    self.skipWaiting();
  }
});

console.log('[UV SW] Service Worker起動完了');
