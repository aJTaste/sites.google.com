import{initPage}from'../common/core.js';

console.log('🚀 [UV] スクリプト開始');

await initPage('uv','UV Proxy');

// ========================================
// 状態管理
// ========================================

const state={
  currentUrl:'',
  isReady:false
};

// ========================================
// DOM要素
// ========================================

const urlInput=document.getElementById('url-input');
const goBtn=document.getElementById('go-btn');
const backBtn=document.getElementById('back-btn');
const forwardBtn=document.getElementById('forward-btn');
const reloadBtn=document.getElementById('reload-btn');
const homeBtn=document.getElementById('home-btn');
const fullscreenBtn=document.getElementById('fullscreen-btn');
const uvContent=document.getElementById('uv-content');
const uvContainer=document.querySelector('.uv-container');
const statusBadge=document.getElementById('status-badge');
const statusText=document.getElementById('status-text');
const swStatus=document.getElementById('sw-status');
const uvStatus=document.getElementById('uv-status');

const welcomeHTML=document.querySelector('.welcome-screen').outerHTML;

console.log('✅ [UV] DOM要素取得完了');

// ========================================
// UV初期化
// ========================================

async function initUV(){
  console.log('🔧 [UV] 初期化開始');
  
  try{
    // Service Workerサポート確認
    if(!('serviceWorker' in navigator)){
      throw new Error('Service Workerがサポートされていません');
    }
    
    console.log('✅ [UV] Service Workerサポート確認OK');
    swStatus.textContent='OK';
    swStatus.className='status-ok';
    statusText.textContent='Service Worker登録中...';
    
    // Ultraviolet確認
    if(typeof Ultraviolet==='undefined'){
      throw new Error('Ultravioletライブラリが見つかりません');
    }
    
    console.log('✅ [UV] Ultraviolet確認OK');
    uvStatus.textContent='OK';
    uvStatus.className='status-ok';
    
    // Service Worker登録
    console.log('🔧 [UV] Service Worker登録開始');
    
    const registration=await navigator.serviceWorker.register('/uv/uv.sw.js',{
      scope:'/uv/service/',
      updateViaCache:'none'
    });
    
    console.log('✅ [UV] Service Worker登録成功',registration);
    
    // アクティブになるまで待機
    if(registration.active){
      console.log('✅ [UV] Service Worker既にアクティブ');
      onReady();
    }else{
      console.log('⏳ [UV] Service Workerアクティブ化待機中...');
      
      if(registration.installing){
        registration.installing.addEventListener('statechange',(e)=>{
          if(e.target.state==='activated'){
            console.log('✅ [UV] Service Workerアクティブ化完了');
            onReady();
          }
        });
      }else if(registration.waiting){
        console.log('✅ [UV] Service Worker待機中→アクティブ化');
        onReady();
      }
    }
    
  }catch(error){
    console.error('❌ [UV] 初期化エラー',error);
    statusBadge.classList.add('error');
    statusBadge.querySelector('.material-symbols-outlined').textContent='error';
    statusText.textContent='初期化失敗';
    swStatus.textContent='FAIL';
    swStatus.className='status-fail';
    showError('初期化エラー',error.message);
  }
}

function onReady(){
  console.log('🎉 [UV] 準備完了！');
  state.isReady=true;
  statusBadge.classList.add('ready');
  statusBadge.querySelector('.material-symbols-outlined').textContent='check_circle';
  statusText.textContent='準備完了';
}

// ========================================
// URL読み込み
// ========================================

function loadUrl(url){
  if(!state.isReady){
    alert('初期化中です。もう少しお待ちください。');
    return;
  }
  
  if(!url){
    return;
  }
  
  // URL正規化
  if(!url.startsWith('http')){
    url='https://'+url;
  }
  
  console.log('🌐 [UV] URL読み込み:',url);
  state.currentUrl=url;
  urlInput.value=url;
  
  showLoading();
  
  try{
    // UVでエンコード
    const encodedUrl=Ultraviolet.codec.xor.encode(url);
    const proxyUrl='/uv/service/'+encodedUrl;
    
    console.log('✅ [UV] プロキシURL:',proxyUrl);
    
    // iframe作成
    const iframe=document.createElement('iframe');
    iframe.className='uv-iframe';
    iframe.src=proxyUrl;
    
    iframe.addEventListener('load',()=>{
      console.log('✅ [UV] ページ読み込み完了');
    });
    
    iframe.addEventListener('error',(e)=>{
      console.error('❌ [UV] iframe読み込みエラー',e);
    });
    
    uvContent.innerHTML='';
    uvContent.appendChild(iframe);
    
  }catch(error){
    console.error('❌ [UV] URL読み込みエラー',error);
    showError('読み込みエラー',error.message);
  }
}

// ========================================
// UI表示関数
// ========================================

function showLoading(){
  uvContent.innerHTML=`
    <div class="loading-screen">
      <div class="loading-spinner"></div>
      <p>読み込み中...</p>
    </div>
  `;
}

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
        <button class="btn-secondary" id="back-home">ホームに戻る</button>
      </div>
    </div>
  `;
  
  document.getElementById('back-home').addEventListener('click',goHome);
}

function goHome(){
  uvContent.innerHTML=welcomeHTML;
  state.currentUrl='';
  urlInput.value='';
}

function reload(){
  if(state.currentUrl){
    loadUrl(state.currentUrl);
  }
}

function goBack(){
  const iframe=uvContent.querySelector('.uv-iframe');
  if(iframe){
    iframe.contentWindow.history.back();
  }
}

function goForward(){
  const iframe=uvContent.querySelector('.uv-iframe');
  if(iframe){
    iframe.contentWindow.history.forward();
  }
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

urlInput.addEventListener('keydown',(e)=>{
  if(e.key==='Enter'){
    loadUrl(urlInput.value);
  }
});

goBtn.addEventListener('click',()=>{
  loadUrl(urlInput.value);
});

backBtn.addEventListener('click',goBack);
forwardBtn.addEventListener('click',goForward);
reloadBtn.addEventListener('click',reload);
homeBtn.addEventListener('click',goHome);
fullscreenBtn.addEventListener('click',toggleFullscreen);

document.addEventListener('keydown',(e)=>{
  if(e.key==='ArrowUp'){
    toggleControls();
  }
  if(e.key==='Escape'&&uvContainer.classList.contains('is-fullscreen')){
    toggleFullscreen();
  }
});

console.log('✅ [UV] イベントリスナー設定完了');

// ========================================
// 初期化実行
// ========================================

// Ultraviolet読み込み待機
setTimeout(()=>{
  if(typeof Ultraviolet!=='undefined'){
    console.log('✅ [UV] Ultraviolet確認OK、初期化開始');
    initUV();
  }else{
    console.error('❌ [UV] Ultravioletが見つかりません');
    statusBadge.classList.add('error');
    statusText.textContent='ライブラリ読み込み失敗';
    showError('初期化エラー','Ultravioletライブラリの読み込みに失敗しました');
  }
},500);
