// public/sites.google.com/js/uv.sw.js（修正版）
importScripts('/sites.google.com/js/uv.bundle.js');
importScripts('/sites.google.com/js/uv.config.js');
importScripts('/sites.google.com/js/uv.handler.js');

const uv=new UVServiceWorker();

self.addEventListener('fetch',(event)=>{
  event.respondWith(
    uv.fetch(event).catch(()=>fetch(event.request))
  );
});
