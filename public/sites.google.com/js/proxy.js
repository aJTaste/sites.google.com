// js/proxy.js（修正版）
import{initPage}from'../common/core.js';

await initPage('proxy','Proxy');

const urlInput=document.getElementById('url-input');
const goBtn=document.getElementById('go-btn');
const proxyFrame=document.getElementById('proxy-frame');
const loading=document.getElementById('loading');
const backBtn=document.getElementById('back-btn');
const forwardBtn=document.getElementById('forward-btn');
const reloadBtn=document.getElementById('reload-btn');
const homeBtn=document.getElementById('home-btn');
const fullscreenBtn=document.getElementById('fullscreen-btn');

let currentUrl='';

// Ultraviolet初期化
async function initUV(){
  try{
    // Service Worker登録
    if('serviceWorker'in navigator){
      const registration=await navigator.serviceWorker.register(
        '/sites.google.com/js/uv.sw.js',
        {scope:'/service/'}
      );
      console.log('Service Worker登録成功:',registration);
    }
  }catch(error){
    console.error('UV初期化エラー:',error);
    alert('プロキシの初期化に失敗しました');
  }
}

// URL処理
function processUrl(input){
  input=input.trim();
  if(!input)return'';
  
  if(input.includes(' ')||(!input.includes('.')&&!input.startsWith('http'))){
    return`https://www.google.com/search?q=${encodeURIComponent(input)}`;
  }
  
  if(!input.startsWith('http://')&&!input.startsWith('https://')){
    input='https://'+input;
  }
  
  return input;
}

// ページ読み込み
async function loadPage(url){
  if(!url)return;
  
  currentUrl=url;
  loading.classList.remove('hidden');
  
  try{
    // XOR エンコード（簡易版）
    const encoded=btoa(url);
    const proxyUrl=`/service/${encoded}#youtube.com`; // 佐伊津技法
    
    proxyFrame.src=proxyUrl;
    urlInput.value=url;
    
    proxyFrame.onload=()=>{
      loading.classList.add('hidden');
    };
    
  }catch(error){
    console.error('ページ読み込みエラー:',error);
    loading.classList.add('hidden');
    alert('ページの読み込みに失敗しました');
  }
}

// イベントリスナー
goBtn.addEventListener('click',()=>{
  const url=processUrl(urlInput.value);
  if(url)loadPage(url);
});

urlInput.addEventListener('keypress',(e)=>{
  if(e.key==='Enter'){
    const url=processUrl(urlInput.value);
    if(url)loadPage(url);
  }
});

document.querySelectorAll('.quick-link').forEach(btn=>{
  btn.addEventListener('click',()=>{
    loadPage(btn.dataset.url);
  });
});

backBtn.addEventListener('click',()=>{
  proxyFrame.contentWindow.history.back();
});

forwardBtn.addEventListener('click',()=>{
  proxyFrame.contentWindow.history.forward();
});

reloadBtn.addEventListener('click',()=>{
  proxyFrame.contentWindow.location.reload();
});

homeBtn.addEventListener('click',()=>{
  loadPage('https://www.google.com');
});

fullscreenBtn.addEventListener('click',()=>{
  const container=document.getElementById('frame-container');
  if(document.fullscreenElement){
    document.exitFullscreen();
  }else{
    container.requestFullscreen();
  }
});

initUV();
