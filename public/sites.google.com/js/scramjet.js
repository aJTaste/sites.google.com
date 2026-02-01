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
  console.log('[Scramjet] パス:','/sites.google.com/scramjet/scramjet.sw.js');
  console.log('[Scramjet] スコープ:','/sites.google.com/scramjet/service/');
  try{
    if(!('serviceWorker' in navigator)){
      throw new Error('このブラウザはService Workerに対応していません');
    }
    console.log('[Scramjet] Service Workerサポート確認OK');
    const registration=await navigator.serviceWorker.register(
      '/sites.google.com/scramjet.sw.js',
      {
        scope:'/sites.google.com/scramjet/'
      }
    );
    console.log('[Scramjet] Service Worker登録成功:',registration);
    console.log('[Scramjet] registration.installing:',registration.installing);
    console.log('[Scramjet] registration.waiting:',registration.waiting);
    console.log('[Scramjet] registration.active:',registration.active);
    if(registration.installing){
      console.log('[Scramjet] Service Workerインストール中...');
      await new Promise((resolve)=>{
        registration.installing.addEventListener('statechange',(e)=>{
          console.log('[Scramjet] state変更:',e.target.state);
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
    await new Promise(resolve=>setTimeout(resolve,1000));

    // registration を受け取った直後（登録成功ログのあと）
// registration を受け取った直後に挿入（registration は register() の戻り値）
if(!navigator.serviceWorker.controller && registration && registration.active && !sessionStorage.getItem('scramjet_sw_reloaded')){
  sessionStorage.setItem('scramjet_sw_reloaded','1');
  console.log('[Scramjet] ページを Service Worker 管理下にするためリロードします');
  try{
    // 一度だけリロードしてページをコントローラ下に入れる
    location.reload();
  }catch(e){
    console.warn('[Scramjet] リロードに失敗しました:', e);
  }
}


    
    state.swReady=true;
    updateStatus('ready','Service Worker準備完了');
    console.log('[Scramjet] Service Worker準備完了');
    return registration;
  }catch(error){
    console.error('[Scramjet] Service Worker登録エラー:',error);
    console.error('[Scramjet] エラー名:',error.name);
    console.error('[Scramjet] エラーメッセージ:',error.message);
    console.error('[Scramjet] エラースタック:',error.stack);
    updateStatus('error',`エラー: ${error.name} - ${error.message}`);
    showError('Service Worker登録失敗',`${error.name}: ${error.message || 'Unknown error'}`);
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
    const encodedUrl=self.$scramjet.codec.encode(url);
    const proxyUrl=self.$scramjet.prefix+encodedUrl;
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
      <p style="font-size:12px;color:var(--text-tertiary);margin-top:16px;">
        Erudaコンソールで詳細なエラーログを確認できます
      </p>
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
  const welcome=`
    <div class="welcome-screen">
      <div class="welcome-icon">
        <span class="material-symbols-outlined">rocket_launch</span>
      </div>
      <h2>Scramjet Proxy</h2>
      <p>軽量で高速なWebプロキシ</p>
      <div class="info-box">
        <h3>使い方</h3>
        <ol>
          <li>Service Workerの登録が完了するまで待つ</li>
          <li>URLバーにアクセスしたいURLを入力</li>
          <li>全画面ボタンで最大化できます</li>
        </ol>
      </div>
      <div class="feature-list">
        <div class="feature-item">
          <span class="material-symbols-outlined">bolt</span>
          <span>超高速処理</span>
        </div>
        <div class="feature-item">
          <span class="material-symbols-outlined">code</span>
          <span>最新Web技術対応</span>
        </div>
        <div class="feature-item">
          <span class="material-symbols-outlined">security</span>
          <span>安全なプロキシ</span>
        </div>
      </div>
    </div>
  `;
  scramjetContent.innerHTML=welcome;
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
console.log('[Scramjet] window.location:',window.location);
console.log('[Scramjet] Service Worker対応:',('serviceWorker' in navigator));
registerServiceWorker().then(()=>{
  console.log('[Scramjet] 初期化完了');
}).catch((error)=>{
  console.error('[Scramjet] 初期化失敗:',error);
});
