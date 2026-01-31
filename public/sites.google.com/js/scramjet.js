import{initPage}from'../common/core.js';
await initPage('scramjet','Scramjet');
const state={
  currentUrl:'',
  swReady:false
};
const urlInput=document.getElementById('url-input');
const goBtn=document.getElementById('go-btn');
const reloadBtn=document.getElementById('reload-btn');
const homeBtn=document.getElementById('home-btn');
const fullscreenBtn=document.getElementById('fullscreen-btn');
const scramjetContent=document.getElementById('scramjet-content');
const scramjetStatus=document.getElementById('scramjet-status');
const statusText=document.getElementById('status-text');
const scramjetContainer=document.querySelector('.scramjet-container');
async function registerServiceWorker(){
  console.log('[Scramjet] Service Worker登録開始');
  try{
    if(!('serviceWorker' in navigator)){
      throw new Error('このブラウザはService Workerに対応していません');
    }
    console.log('[Scramjet] Service Workerサポート確認OK');
    const registration=await navigator.serviceWorker.register(
      'https://unpkg.com/@mercuryworkshop/scramjet/dist/scramjet.sw.js',
      {
        scope:'/sites.google.com/scramjet/service/',
        type:'module'
      }
    );
    console.log('[Scramjet] Service Worker登録成功:',registration);
    if(registration.installing){
      console.log('[Scramjet] Service Workerインストール中...');
      await new Promise((resolve)=>{
        registration.installing.addEventListener('statechange',(e)=>{
          if(e.target.state==='activated'){
            resolve();
          }
        });
      });
    }else if(registration.waiting){
      console.log('[Scramjet] Service Worker待機中...');
      await registration.waiting.postMessage({type:'SKIP_WAITING'});
    }else if(registration.active){
      console.log('[Scramjet] Service Worker既にアクティブ');
    }
    state.swReady=true;
    updateStatus('ready','Service Worker準備完了');
    console.log('[Scramjet] Service Worker準備完了');
    return registration;
  }catch(error){
    console.error('[Scramjet] Service Worker登録エラー:',error);
    updateStatus('error',`エラー: ${error.message}`);
    showError('Service Worker登録失敗',error.message);
    throw error;
  }
}
function updateStatus(type,message){
  scramjetStatus.className=`scramjet-status ${type}`;
  statusText.textContent=message;
  if(type==='ready'){
    setTimeout(()=>{
      scramjetStatus.style.display='none';
    },3000);
  }
}
async function loadUrl(url){
  if(!url)return;
  if(!state.swReady){
    alert('Service Workerの登録が完了していません。しばらく待ってから再試行してください。');
    return;
  }
  if(!url.startsWith('http')){
    url='https://'+url;
  }
  state.currentUrl=url;
  urlInput.value=url;
  console.log('[Scramjet] URL読み込み:',url);
  try{
    const encodedUrl=$scramjet.codec.encode(url);
    const proxyUrl=$scramjet.prefix+encodedUrl;
    console.log('[Scramjet] プロキシURL:',proxyUrl);
    const iframe=document.createElement('iframe');
    iframe.className='scramjet-iframe';
    iframe.src=proxyUrl;
    iframe.sandbox='allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox';
    scramjetContent.innerHTML='';
    scramjetContent.appendChild(iframe);
    console.log('[Scramjet] iframe生成完了');
  }catch(error){
    console.error('[Scramjet] URL読み込みエラー:',error);
    showError('読み込み失敗',error.message);
  }
}
function showError(title,message){
  scramjetContent.innerHTML=`
    <div class="error-screen">
      <div class="error-icon">
        <span class="material-symbols-outlined">error</span>
      </div>
      <h2>${title}</h2>
      <p>${message}</p>
      <div class="error-actions">
        <button class="btn-primary" onclick="location.reload()">再読み込み</button>
        <button class="btn-secondary" id="error-home">ホームに戻る</button>
      </div>
    </div>
  `;
  document.getElementById('error-home').addEventListener('click',goHome);
}
function reload(){
  if(state.currentUrl){
    loadUrl(state.currentUrl);
  }
}
function goHome(){
  scramjetContent.innerHTML=document.querySelector('.welcome-screen').outerHTML;
  state.currentUrl='';
  urlInput.value='';
}
function toggleFullscreen(){
  scramjetContainer.classList.toggle('is-fullscreen');
  if(scramjetContainer.classList.contains('is-fullscreen')){
    fullscreenBtn.querySelector('.material-symbols-outlined').textContent='fullscreen_exit';
  }else{
    fullscreenBtn.querySelector('.material-symbols-outlined').textContent='fullscreen';
    scramjetContainer.classList.remove('show-controls');
  }
}
function toggleControls(){
  if(!scramjetContainer.classList.contains('is-fullscreen'))return;
  scramjetContainer.classList.toggle('show-controls');
}
urlInput.addEventListener('keydown',(e)=>{
  if(e.key==='Enter'){
    loadUrl(urlInput.value);
  }
});
goBtn.addEventListener('click',()=>{
  loadUrl(urlInput.value);
});
reloadBtn.addEventListener('click',reload);
homeBtn.addEventListener('click',goHome);
fullscreenBtn.addEventListener('click',toggleFullscreen);
document.addEventListener('keydown',(e)=>{
  if(e.key==='ArrowUp'){
    toggleControls();
  }
  if(e.key==='Escape'&&scramjetContainer.classList.contains('is-fullscreen')){
    toggleFullscreen();
  }
});
console.log('[Scramjet] 初期化開始');
registerServiceWorker().then(()=>{
  console.log('[Scramjet] 初期化完了');
}).catch((error)=>{
  console.error('[Scramjet] 初期化失敗:',error);
});
