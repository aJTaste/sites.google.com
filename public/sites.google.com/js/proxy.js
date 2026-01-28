// public/sites.google.com/js/proxy.js
import{initPage}from'../common/core.js';
await initPage('proxy','Proxy');

const urlInput=document.getElementById('url-input');
const goBtn=document.getElementById('go-btn');
const proxyFrame=document.getElementById('proxy-frame');
const loading=document.getElementById('loading');

async function initUV(){
  if(!('serviceWorker'in navigator)){
    alert('Service Worker 非対応');
    return;
  }
  await navigator.serviceWorker.register(
    '/sites.google.com/uv.sw.js',
    {scope:'/sites.google.com/'}
  );
}

function normalize(input){
  input=input.trim();
  if(!input)return'';
  if(input.includes(' ')||!input.includes('.')){
    return'https://www.google.com/search?q='+encodeURIComponent(input);
  }
  if(!/^https?:\/\//.test(input)){
    input='https://'+input;
  }
  return input;
}

function loadPage(url){
  loading.classList.remove('hidden');
  const encoded=__uv$config.encodeUrl(url);
  proxyFrame.src=__uv$config.prefix+encoded+'#youtube.com';
  proxyFrame.onload=()=>loading.classList.add('hidden');
}

goBtn.onclick=()=>{
  const url=normalize(urlInput.value);
  if(url)loadPage(url);
};

urlInput.onkeydown=e=>{
  if(e.key==='Enter'){
    const url=normalize(urlInput.value);
    if(url)loadPage(url);
  }
};

initUV();
