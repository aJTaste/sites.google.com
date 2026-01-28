// js/uv.sw.js
console.log('UV Service Worker読み込み開始');

try{
  importScripts('https://cdn.jsdelivr.net/npm/@titaniumnetwork-dev/ultraviolet@3/dist/uv.bundle.js');
  console.log('uv.bundle.js読み込み成功');
}catch(e){
  console.error('uv.bundle.js読み込みエラー:',e);
}

try{
  importScripts('https://cdn.jsdelivr.net/npm/@titaniumnetwork-dev/ultraviolet@3/dist/uv.config.js');
  console.log('uv.config.js読み込み成功');
}catch(e){
  console.error('uv.config.js読み込みエラー:',e);
}

try{
  importScripts('https://cdn.jsdelivr.net/npm/@titaniumnetwork-dev/ultraviolet@3/dist/uv.sw.js');
  console.log('uv.sw.js読み込み成功');
}catch(e){
  console.error('uv.sw.js読み込みエラー:',e);
}

const uv=new UVServiceWorker();

self.addEventListener('fetch',(event)=>{
  console.log('Fetch:',event.request.url);
  event.respondWith(
    uv.fetch(event).catch((e)=>{
      console.error('Fetchエラー:',e);
      return fetch(event.request);
    })
  );
});

console.log('UV Service Worker準備完了');
