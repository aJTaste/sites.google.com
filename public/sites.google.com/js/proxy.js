// js/proxy.js（デバッグ版）
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
    console.log('UV初期化開始...');
    
    // Service Worker登録
    if('serviceWorker'in navigator){
      console.log('Service Worker対応ブラウザ');
      
      // 既存のSW削除（クリーンスタート）
      const registrations=await navigator.serviceWorker.getRegistrations();
      for(let registration of registrations){
        await registration.unregister();
        console.log('既存SW削除:',registration.scope);
      }
      
      // 新規登録
      const registration=await navigator.serviceWorker.register(
        '/sites.google.com/js/uv.sw.js',
        {scope:'/sites.google.com/service/'}
      );
      
      console.log('Service Worker登録成功:',registration);
      
      // アクティブ化待機
      await navigator.serviceWorker.ready;
      console.log('Service Workerアクティブ化完了');
      
    }else{
      throw new Error('このブラウザはService Workerに対応していません');
    }
  }catch(error){
    console.error('UV初期化エラー詳細:',error);
    alert(`プロキシの初期化に失敗しました: ${error.message}`);
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
    console.log('ページ読み込み開始:',url);
    
    // Base64エンコード
    const encoded=btoa(url);
    const proxyUrl=`/sites.google.com/service/${encoded}#youtube.com`;
    
    console.log('プロキシURL:',proxyUrl);
    
    proxyFrame.src=proxyUrl;
    urlInput.value=url;
    
    proxyFrame.onload=()=>{
      console.log('ページ読み込み完了');
      loading.classList.add('hidden');
    };
    
    proxyFrame.onerror=(e)=>{
      console.error('iframe読み込みエラー:',e);
      loading.classList.add('hidden');
      alert('ページの読み込みに失敗しました');
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
  try{
    proxyFrame.contentWindow.history.back();
  }catch(e){
    console.error('戻るエラー:',e);
  }
});

forwardBtn.addEventListener('click',()=>{
  try{
    proxyFrame.contentWindow.history.forward();
  }catch(e){
    console.error('進むエラー:',e);
  }
});

reloadBtn.addEventListener('click',()=>{
  try{
    proxyFrame.contentWindow.location.reload();
  }catch(e){
    console.error('リロードエラー:',e);
  }
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

// 初期化実行
initUV();
