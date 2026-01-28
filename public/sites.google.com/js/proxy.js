// js/proxy.js
import{initPage}from'../common/core.js';

await initPage('proxy','Proxy');

const UV_BUNDLE='https://cdn.jsdelivr.net/npm/@titaniumnetwork-dev/ultraviolet@3/dist/uv.bundle.js';
const UV_CONFIG='https://cdn.jsdelivr.net/npm/@titaniumnetwork-dev/ultraviolet@3/dist/uv.config.js';
const UV_SW='/sites.google.com/js/uv.sw.js';

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
    // UVスクリプト読み込み
    await loadScript(UV_CONFIG);
    await loadScript(UV_BUNDLE);
    
    // Service Worker登録
    if('serviceWorker'in navigator){
      await navigator.serviceWorker.register(UV_SW,{
        scope:'/sites.google.com/service/'
      });
    }
    
    console.log('Ultraviolet準備完了');
  }catch(error){
    console.error('UV初期化エラー:',error);
    alert('プロキシの初期化に失敗しました');
  }
}

// スクリプト読み込み
function loadScript(src){
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=src;
    script.onload=resolve;
    script.onerror=reject;
    document.head.appendChild(script);
  });
}

// URL処理
function processUrl(input){
  input=input.trim();
  
  // 空の場合
  if(!input)return'';
  
  // 検索ワード判定（スペース含むor プロトコルなし）
  if(input.includes(' ')||(!input.includes('.')&&!input.startsWith('http'))){
    return`https://www.google.com/search?q=${encodeURIComponent(input)}`;
  }
  
  // プロトコル補完
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
    // UVエンコード
    const encodedUrl=window.__uv$config.prefix+window.__uv$config.encodeUrl(url);
    
    // 佐伊津技法適用
    const saituUrl=encodedUrl+'#youtube.com';
    
    proxyFrame.src=saituUrl;
    urlInput.value=url;
    
    // 読み込み完了待機
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

// クイックリンク
document.querySelectorAll('.quick-link').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const url=btn.dataset.url;
    loadPage(url);
  });
});

// コントロールボタン
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

// 初期化
initUV();
