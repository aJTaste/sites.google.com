// public/sites.google.com/uv.sw.js
console.log('UV Service Worker読み込み開始');

// 順番が重要：bundle -> config -> sw
importScripts('https://cdn.jsdelivr.net/npm/@titaniumnetwork-dev/ultraviolet@3/dist/uv.bundle.js');
importScripts('/sites.google.com/uv.config.js');
importScripts('https://cdn.jsdelivr.net/npm/@titaniumnetwork-dev/ultraviolet@3/dist/uv.sw.js');

const sw=new UVServiceWorker();

self.addEventListener('fetch',(event)=>{
  event.respondWith(
    (async()=>{
      if(event.request.url.startsWith(location.origin+self.__uv$config.prefix)){
        return await sw.fetch(event);
      }
      return await fetch(event.request);
    })()
  );
});
