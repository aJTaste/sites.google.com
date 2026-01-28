// public/sites.google.com/uv.sw.js
importScripts('/sites.google.com/js/uv.bundle.js');
importScripts('/sites.google.com/uv.config.js');
importScripts('/sites.google.com/js/uv.handler.js');

const uv=new UVServiceWorker();

self.addEventListener('fetch',event=>{
  event.respondWith(
    uv.fetch(event).catch(()=>fetch(event.request))
  );
});
