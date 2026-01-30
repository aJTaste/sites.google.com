import{initPage}from'../common/core.js';

console.log('🚀 [UV] スクリプト読み込み開始');

await initPage('uv','UV Proxy');

// ========================================
// デバッグユーティリティ
// ========================================

const DEBUG={
  log:(msg,data)=>{
    console.log(`🔵 [UV] ${msg}`,data||'');
  },
  warn:(msg,data)=>{
    console.warn(`⚠️ [UV] ${msg}`,data||'');
  },
  error:(msg,data)=>{
    console.error(`❌ [UV] ${msg}`,data||'');
  },
  success:(msg,data)=>{
    console.log(`✅ [UV] ${msg}`,data||'');
  }
};

// ========================================
// 状態管理
// ========================================

const state={
  currentUrl:'',
  isReady:false,
  swRegistered:false,
  uvLoaded:false
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

// ウェルカム画面のHTML保存
const welcomeHTML=document.querySelector('.welcome-screen').outerHTML;

DEBUG.log('DOM要素取得完了');

// ========================================
// Ultravioletライブラリ読み込み待機
// ========================================

function waitForUltraviolet(){
  return new Promise((resolve,reject)=>{
    DEBUG.log('Ultraviolet読み込み待機開始');
    
    if(typeof Ultraviolet!=='undefined'){
      DEBUG.success('Ultraviolet既に読み込み済み');
      resolve();
      return;
    }
    
    let attempts=0;
    const maxAttempts=50;
    const interval=setInterval(()=>{
      attempts++;
      DEBUG.log(`Ultraviolet確認中... (${attempts}/${maxAttempts})`);
      
      if(typeof Ultraviolet!=='undefined'){
        clearInterval(interval);
        DEBUG.success('Ultraviolet読み込み完了');
        resolve();
      }else if(attempts>=maxAttempts){
        clearInterval(interval);
        DEBUG.error('Ultraviolet読み込みタイムアウト');
        reject(new Error('Ultravioletライブラリの読み込みがタイムアウトしました'));
      }
    },100);
  });
}

// ========================================
// UV 初期化
// ========================================

async function initUV(){
  DEBUG.log('UV初期化開始');
  
  try{
    // Service Worker サポート確認
    if(!('serviceWorker' in navigator)){
      throw new Error('Service Workerがサポートされていません');
    }
    
    DEBUG.success('Service Worker サポート確認OK');
    updateStatus('sw','OK','UVライブラリ確認中...');
    
    // Ultraviolet読み込み待機
    await waitForUltraviolet();
    
    // Ultravioletオブジェクトの確認（HTMLで読み込み済み）
    if(typeof Ultraviolet==='undefined'){
      throw new Error('Ultravioletライブラリが見つかりません');
    }
    
    DEBUG.success('Ultravioletオブジェクト確認OK');
    state.uvLoaded=true;
    updateStatus('uv','OK','Service Worker登録中...');
    
    // UV設定を定義（Ultraviolet読み込み後）
    DEBUG.log('UV設定を定義');
    window.__uv$config={
      prefix:'/sites.google.com/uv/service/',
      bare:'https://uv-bare.onrender.com/',
      encodeUrl:Ultraviolet.codec.xor.encode,
      decodeUrl:Ultraviolet.codec.xor.decode,
      handler:'/sites.google.com/uv/uv.handler.js',
      client:'/sites.google.com/uv/uv.client.js',
      bundle:'/sites.google.com/uv/uv.bundle.js',
      config:'/sites.google.com/uv/uv.config.js',
      sw:'/sites.google.com/uv/uv.sw.js'
    };
    DEBUG.success('UV設定完了');
    
    // Service Worker 登録
    DEBUG.log('Service Worker登録開始: /sites.google.com/uv/uv.sw.js');
    
    const registration=await navigator.serviceWorker.register(
      '/sites.google.com/uv/uv.sw.js',
      {
        scope:'/sites.google.com/uv/service/',
        updateViaCache:'none'
      }
    );
    
    DEBUG.success('Service Worker登録成功',registration);
    state.swRegistered=true;
    updateStatus('sw','OK','準備完了！');
    
    // アクティブ化を待機
    await navigator.serviceWorker.ready;
    DEBUG.success('Service Workerアクティブ化完了');
    
    // 準備完了
    state.isReady=true;
    statusBadge.classList.add('ready');
    statusBadge.querySelector('.material-symbols-outlined').textContent='check_circle';
    statusText.textContent='準備完了';
    
    DEBUG.success('UV初期化完了！');
    
  }catch(error){
    DEBUG.error('UV初期化エラー',error);
    updateStatus('error','FAIL',error.message);
    showError('初期化エラー',error.message);
  }
}

// ========================================
// スクリプト動的読み込み
// ========================================

function loadScript(src){
  return new Promise((resolve,reject)=>{
    DEBUG.log(`スクリプト読み込み: ${src}`);
    const script=document.createElement('script');
    script.src=src;
    script.onload=()=>{
      DEBUG.success(`スクリプト読み込み成功: ${src}`);
      resolve();
    };
    script.onerror=()=>{
      DEBUG.error(`スクリプト読み込み失敗: ${src}`);
      reject(new Error(`Failed to load: ${src}`));
    };
    document.head.appendChild(script);
  });
}

// ========================================
// ステータス更新
// ========================================

function updateStatus(type,status,message){
  DEBUG.log(`ステータス更新: ${type} = ${status}`);
  
  if(type==='sw'){
    swStatus.textContent=status;
    swStatus.className=status==='OK'?'status-ok':'status-fail';
  }else if(type==='uv'){
    uvStatus.textContent=status;
    uvStatus.className=status==='OK'?'status-ok':'status-fail';
  }else if(type==='error'){
    statusBadge.classList.add('error');
    statusBadge.querySelector('.material-symbols-outlined').textContent='error';
  }
  
  if(message){
    statusText.textContent=message;
  }
}

// ========================================
// URL読み込み
// ========================================

async function loadUrl(url){
  if(!state.isReady){
    DEBUG.warn('UVの準備ができていません');
    alert('初期化中です。もう少しお待ちください。');
    return;
  }
  
  if(!url){
    DEBUG.warn('URLが空です');
    return;
  }
  
  // URLの正規化
  if(!url.startsWith('http')){
    url='https://'+url;
  }
  
  DEBUG.log(`URL読み込み開始: ${url}`);
  state.currentUrl=url;
  urlInput.value=url;
  
  showLoading();
  
  try{
    // UVでエンコード
    DEBUG.log('URL エンコード中...');
    const encodedUrl=window.__uv$config.encodeUrl(url);
    DEBUG.log('エンコード完了',encodedUrl);
    
    // プロキシURL生成
    const proxyUrl='/sites.google.com/uv/service/'+encodedUrl;
    DEBUG.log('プロキシURL生成',proxyUrl);
    
    // iframe作成
    DEBUG.log('iframe作成中...');
    const iframe=document.createElement('iframe');
    iframe.className='uv-iframe';
    iframe.src=proxyUrl;
    
    iframe.addEventListener('load',()=>{
      DEBUG.success('ページ読み込み完了');
    });
    
    iframe.addEventListener('error',(e)=>{
      DEBUG.error('iframe読み込みエラー',e);
    });
    
    uvContent.innerHTML='';
    uvContent.appendChild(iframe);
    
    DEBUG.success('iframe表示完了');
    
  }catch(error){
    DEBUG.error('URL読み込みエラー',error);
    showError('読み込みエラー',error.message);
  }
}

// ========================================
// ローディング表示
// ========================================

function showLoading(){
  DEBUG.log('ローディング表示');
  uvContent.innerHTML=`
    <div class="loading-screen">
      <div class="loading-spinner"></div>
      <p>読み込み中...</p>
    </div>
  `;
}

// ========================================
// エラー表示
// ========================================

function showError(title,message){
  DEBUG.error(`エラー表示: ${title} - ${message}`);
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

// ========================================
// ナビゲーション
// ========================================

function reload(){
  DEBUG.log('再読み込み');
  if(state.currentUrl){
    loadUrl(state.currentUrl);
  }
}

function goHome(){
  DEBUG.log('ホームに戻る');
  uvContent.innerHTML=welcomeHTML;
  state.currentUrl='';
  urlInput.value='';
}

function goBack(){
  DEBUG.log('戻る');
  const iframe=uvContent.querySelector('.uv-iframe');
  if(iframe){
    iframe.contentWindow.history.back();
  }
}

function goForward(){
  DEBUG.log('進む');
  const iframe=uvContent.querySelector('.uv-iframe');
  if(iframe){
    iframe.contentWindow.history.forward();
  }
}

// ========================================
// 全画面
// ========================================

function toggleFullscreen(){
  DEBUG.log('全画面切替');
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

DEBUG.log('イベントリスナー設定開始');

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
backBtn.addEventListener('click',goBack);
forwardBtn.addEventListener('click',goForward);
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

DEBUG.success('イベントリスナー設定完了');

// ========================================
// 初期化実行
// ========================================

DEBUG.log('UV初期化を開始します...');

// DOMとライブラリの読み込みを待つ
setTimeout(()=>{
  if(typeof Ultraviolet==='undefined'){
    DEBUG.error('Ultravioletが読み込まれていません！');
    console.error('window.Ultraviolet:',window.Ultraviolet);
    console.error('グローバルオブジェクト:',Object.keys(window).filter(k=>k.includes('Ultra')||k.includes('uv')));
    updateStatus('error','FAIL','Ultravioletライブラリが見つかりません');
    showError('初期化エラー','Ultravioletライブラリの読み込みに失敗しました');
  }else{
    DEBUG.log('Ultraviolet確認OK、初期化開始');
    initUV();
  }
},500);
