import{initPage}from'../common/core.js';
await initPage('proxy','Proxy');

const urlInput=document.getElementById('url-input');
const goBtn=document.getElementById('go-btn');
const backBtn=document.getElementById('back-btn');
const forwardBtn=document.getElementById('forward-btn');
const reloadBtn=document.getElementById('reload-btn');
const fullscreenBtn=document.getElementById('fullscreen-btn');
const proxyFrame=document.getElementById('proxy-frame');
const loading=document.getElementById('loading');
const quickLinks=document.querySelectorAll('.quick-link');

let swReady=false;

async function registerSW(){
  if(!('serviceWorker'in navigator)){
    alert('Service Workerに対応していません');
    return false;
  async function registerSW(){
  console.log('1. SW登録開始');
  
  if(!('serviceWorker'in navigator)){
    console.error('Service Worker非対応');
    alert('Service Workerに対応していません');
    return false;
  }
  
  goBtn.disabled=true;
  goBtn.textContent='初期化中...';
  
  try{
    console.log('2. SW登録リクエスト送信');
    const reg=await navigator.serviceWorker.register('/sites.google.com/uv.sw.js',{
      scope:'/sites.google.com/service/'
    });
    
    console.log('3. SW登録成功:',reg);
    console.log('4. SW状態:',reg.installing,reg.waiting,reg.active);
    
    console.log('5. SW Ready待機中...');
    await navigator.serviceWorker.ready;
    console.log('6. SW Ready完了');
    
    await new Promise(resolve=>setTimeout(resolve,500));
    console.log('7. 追加待機完了');
    
    swReady=true;
    goBtn.disabled=false;
    goBtn.innerHTML='<span class="material-symbols-outlined">arrow_forward</span>移動';
    
    console.log('8. 初期化完了 - swReady=true');
    return true;
  }catch(err){
    console.error('SW登録失敗:',err);
    alert('プロキシの初期化に失敗しました: '+err.message);
    goBtn.textContent='初期化失敗';
    return false;
  }
}
  }
  
  goBtn.disabled=true;
  goBtn.textContent='初期化中...';
  
  try{
    const reg=await navigator.serviceWorker.register('/sites.google.com/uv.sw.js',{
      scope:'/sites.google.com/service/'
    });
    
    await navigator.serviceWorker.ready;
    
    await new Promise(resolve=>setTimeout(resolve,500));
    
    swReady=true;
    goBtn.disabled=false;
    goBtn.innerHTML='<span class="material-symbols-outlined">arrow_forward</span>移動';
    
    return true;
  }catch(err){
    console.error('SW登録失敗:',err);
    alert('プロキシの初期化に失敗しました: '+err.message);
    goBtn.textContent='初期化失敗';
    return false;
  }
}

function normalizeURL(input){
  input=input.trim();
  if(!input)return'';
  if(input.includes(' ')||(!input.includes('.')&&!input.startsWith('http'))){
    return'https://www.google.com/search?q='+encodeURIComponent(input);
  }
  if(!/^https?:\/\//i.test(input)){
    input='https://'+input;
  }
  return input;
}

function loadURL(url){
  if(!swReady){
    alert('プロキシの準備ができていません。ページを再読み込みしてください。');
    return;
  }
  
  loading.classList.remove('hidden');
  
  const encoded=__uv$config.encodeUrl(url);
  const proxyURL=__uv$config.prefix+encoded;
  
  proxyFrame.src=proxyURL;
  
  let loadTimeout=setTimeout(()=>{
    loading.classList.add('hidden');
  },4000);
  
  proxyFrame.onload=()=>{
    clearTimeout(loadTimeout);
    loading.classList.add('hidden');
  };
}

goBtn.addEventListener('click',()=>{
  const url=normalizeURL(urlInput.value);
  if(url)loadURL(url);
});

urlInput.addEventListener('keydown',e=>{
  if(e.key==='Enter'){
    const url=normalizeURL(urlInput.value);
    if(url)loadURL(url);
  }
});

quickLinks.forEach(link=>{
  link.addEventListener('click',()=>{
    const url=link.dataset.url;
    urlInput.value=url;
    loadURL(url);
  });
});

backBtn.addEventListener('click',()=>{
  try{
    proxyFrame.contentWindow.history.back();
  }catch(err){
    console.error('戻る失敗:',err);
  }
});

forwardBtn.addEventListener('click',()=>{
  try{
    proxyFrame.contentWindow.history.forward();
  }catch(err){
    console.error('進む失敗:',err);
  }
});

reloadBtn.addEventListener('click',()=>{
  if(proxyFrame.src){
    proxyFrame.src=proxyFrame.src;
  }
});

fullscreenBtn.addEventListener('click',()=>{
  const container=document.querySelector('.proxy-frame-container');
  if(!document.fullscreenElement){
    container.requestFullscreen().catch(err=>{
      console.error('全画面失敗:',err);
    });
  }else{
    document.exitFullscreen();
  }
});

registerSW();
