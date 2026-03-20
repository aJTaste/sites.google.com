const CACHE='apphub-v3';
const STATIC=[
  '/sites.google.com/common/common.css',
  '/sites.google.com/assets/favicon1.svg',
  '/sites.google.com/assets/icon1.svg',
];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(STATIC)));
  self.skipWaiting();
});
self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
  );
  self.clients.claim();
});
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(url.origin!==self.location.origin) return;
  const dst=e.request.destination;
  if(dst==='style'||dst==='image'||dst==='font'){
    e.respondWith(
      caches.match(e.request).then(c=>c||fetch(e.request).then(r=>{
        const clone=r.clone();
        caches.open(CACHE).then(ca=>ca.put(e.request,clone));
        return r;
      }))
    );
    return;
  }
  e.respondWith(
    fetch(e.request).then(r=>{
      if(dst==='script'){
        const clone=r.clone();
        caches.open(CACHE).then(ca=>ca.put(e.request,clone));
      }
      return r;
    }).catch(()=>caches.match(e.request))
  );
});
