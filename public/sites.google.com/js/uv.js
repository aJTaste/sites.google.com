import{initPage}from'../common/core.js';

// ページ初期化
await initPage('uv','Ultraviolet');

// ========================================
// 状態管理
// ========================================

const state={
  currentUrl:'',
  swReady:false
};

// ========================================
// DOM要素
// ========================================

const urlInput=document.getElementById('url-input');
const goBtn=document.getElementById('go-btn');
const reloadBtn=document.getElementById('reload-btn');
const homeBtn=document.getElementById('home-btn');
const fullscreenBtn=document.getElementById('fullscreen-btn');
const uvContent=document.getElementById('uv-content');
const uvStatus=document.getElementById('uv-status');
const statusText=document.getElementById('status-text');
const uvContainer=document.querySelector('.uv-container');

// ========================================
// Service Worker登録
// ========================================

async function registerServiceWorker(){
  console.log('[UV] Service Worker登録開始');
  
  try{
    // Service Workerサポート確認
    if(!('serviceWorker' in navigator)){
      throw new Error('このブラウザはService Workerに対応していません');
    }
    
    console.log('[UV] Service Workerサポート確認OK');
    
    // Service Worker登録
    const registration=await navigator.serviceWorker.register(
      '/sites.google.com/uv/uv.sw.js',
      {
        scope:'/sites.google.com/uv/service/',
        type:'classic'
      }
    );
    
    console.log('[UV] Service Worker登録成功:',registration);
    
    // Service Workerがactiveになるまで待機
    if(registration.installing){
      console.log('[UV] Service Workerインストール中...');
      await new Promise((resolve)=>{
        registration.installing.addEventListener('statechange',(e)=>{
          if(e.target.state==='activated'){
            resolve();
          }
        });
      });
    }else if(registration.waiting){
      console.log('[UV] Service Worker待機中...');
      await registration.waiting.postMessage({type:'SKIP_WAITING'});
    }else if(registration.active){
      console.log('[UV] Service Worker既にアクティブ');
    }
    
    // ステータス更新
    state.swReady=true;
    updateStatus('ready','Service Worker準備完了');
    console.log('[UV] Service Worker準備完了');
    
    return registration;
    
  }catch(error){
    console.error('[UV] Service Worker登録エラー:',error);
    updateStatus('error',`エラー: ${error.message}`);
    showError('Service Worker登録失敗',error.message);
    throw error;
  }
}

// ========================================
// ステータス更新
// ========================================

function updateStatus(type,message){
  uvStatus.className=`uv-status ${type}`;
  statusText.textContent=message;
  
  // 成功時は3秒後に非表示
  if(type==='ready'){
    setTimeout(()=>{
      uvStatus.style.display='none';
    },3000);
  }
}

// ========================================
// URL読み込み
// ========================================

async function loadUrl(url){
  if(!url)return;
  
  // Service Worker準備確認
  if(!state.swReady){
    alert('Service Workerの登録が完了していません。しばらく待ってから再試行してください。');
    return;
  }
  
  // URLの正規化
  if(!url.startsWith('http')){
    url='https://'+url;
  }
  
  state.currentUrl=url;
  urlInput.value=url;
  
  console.log('[UV] URL読み込み:',url);
  
  try{
    // Ultraviolet経由のURL生成
    const encodedUrl=__uv$config.encodeUrl(url);
    const proxyUrl=__uv$config.prefix+encodedUrl;
    
    console.log('[UV] プロキシURL:',proxyUrl);
    
    // iframe生成
    const iframe=document.createElement('iframe');
    iframe.className='uv-iframe';
    iframe.src=proxyUrl;
    iframe.sandbox='allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox';
    
    uvContent.innerHTML='';
    uvContent.appendChild(iframe);
    
    console.log('[UV] iframe生成完了');
    
  }catch(error){
    console.error('[UV] URL読み込みエラー:',error);
    showError('読み込み失敗',error.message);
  }
}

// ========================================
// エラー表示
// ========================================

function showError(title,message){
  uvContent.innerHTML=`
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

// ========================================
// ナビゲーション
// ========================================

function reload(){
  if(state.currentUrl){
    loadUrl(state.currentUrl);
  }
}

function goHome(){
  uvContent.innerHTML=document.querySelector('.welcome-screen').outerHTML;
  state.currentUrl='';
  urlInput.value='';
}

function toggleFullscreen(){
  uvContainer.classList.toggle('is-fullscreen');
  
  if(uvContainer.classList.contains('is-fullscreen')){
    fullscreenBtn.querySelector('.material-symbols-outlined').textContent='fullscreen_exit';
  }else{
    fullscreenBtn.querySelector('.material-symbols-outlined').textContent='fullscreen';
    uvContainer.classList.remove('show-controls');
  }
}

function toggleControls(){
  if(!uvContainer.classList.contains('is-fullscreen'))return;
  uvContainer.classList.toggle('show-controls');
}

// ========================================
// イベントリスナー
// ========================================

// URL入力
urlInput.addEventListener('keydown',(e)=>{
  if(e.key==='Enter'){
    loadUrl(urlInput.value);
  }
});

goBtn.addEventListener('click',()=>{
  loadUrl(urlInput.value);
});

// ナビゲーション
reloadBtn.addEventListener('click',reload);
homeBtn.addEventListener('click',goHome);
fullscreenBtn.addEventListener('click',toggleFullscreen);

// キーボードイベント
document.addEventListener('keydown',(e)=>{
  if(e.key==='ArrowUp'){
    toggleControls();
  }
  if(e.key==='Escape'&&uvContainer.classList.contains('is-fullscreen')){
    toggleFullscreen();
  }
});

// ========================================
// 初期化
// ========================================

console.log('[UV] 初期化開始');

// Service Worker登録
registerServiceWorker().then(()=>{
  console.log('[UV] 初期化完了');
}).catch((error)=>{
  console.error('[UV] 初期化失敗:',error);
});
