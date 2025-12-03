import{initPage}from'../common/core.js';

await initPage('proxy','プロキシブラウザ');

// ========================================
// 状態管理
// ========================================

const state={
  currentUrl:'',
  history:[],
  historyIndex:-1,
  mode:'allorigins', // allorigins, corsproxy, iframe
  bookmarks:[]
};

// プロキシサービス定義
const PROXY_SERVICES={
  allorigins:{
    name:'AllOrigins',
    url:(target)=>`https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`,
    method:'fetch'
  },
  corsproxy:{
    name:'CORS Proxy',
    url:(target)=>`https://corsproxy.io/?${encodeURIComponent(target)}`,
    method:'fetch'
  },
  iframe:{
    name:'Direct (iframe)',
    url:(target)=>target,
    method:'iframe'
  }
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
const bookmarkBtn=document.getElementById('bookmark-btn');
const fullscreenBtn=document.getElementById('fullscreen-btn');
const proxyModeBtn=document.getElementById('proxy-mode-btn');
const browserContent=document.getElementById('browser-content');
const statusText=document.getElementById('status-text');
const currentModeText=document.getElementById('current-mode');

// ========================================
// URL読み込み
// ========================================

async function loadUrl(url){
  if(!url)return;
  
  // URLの正規化
  if(!url.startsWith('http')){
    url='https://'+url;
  }
  
  state.currentUrl=url;
  urlInput.value=url;
  
  // 履歴に追加
  if(state.historyIndex<state.history.length-1){
    state.history=state.history.slice(0,state.historyIndex+1);
  }
  state.history.push(url);
  state.historyIndex=state.history.length-1;
  updateNavigationButtons();
  
  // ローディング表示
  showLoading();
  updateStatus(`読み込み中: ${url}`);
  
  try{
    const proxy=PROXY_SERVICES[state.mode];
    
    if(proxy.method==='iframe'){
      await loadIframe(url);
    }else{
      await loadFetch(proxy.url(url));
    }
    
    updateStatus(`読み込み完了: ${url}`);
  }catch(error){
    console.error('読み込みエラー:',error);
    showError(url,error.message);
    updateStatus(`エラー: ${url}`);
  }
}

// iframe方式で読み込み
async function loadIframe(url){
  browserContent.innerHTML=`<iframe class="proxy-iframe" src="${url}"></iframe>`;
}

// Fetch方式で読み込み
async function loadFetch(proxyUrl){
  const response=await fetch(proxyUrl);
  
  if(!response.ok){
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const html=await response.text();
  
  // HTMLを表示（sandboxedなiframe内で）
  const blob=new Blob([html],{type:'text/html'});
  const blobUrl=URL.createObjectURL(blob);
  
  browserContent.innerHTML=`<iframe class="proxy-iframe" src="${blobUrl}" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>`;
}

// ローディング表示
function showLoading(){
  browserContent.innerHTML=`
    <div class="loading-screen">
      <div class="loading-spinner"></div>
      <p>読み込み中...</p>
    </div>
  `;
}

// エラー表示
function showError(url,message){
  browserContent.innerHTML=`
    <div class="error-screen">
      <div class="error-icon">
        <span class="material-symbols-outlined">error</span>
      </div>
      <h2>読み込みに失敗しました</h2>
      <p>${message}</p>
      <p style="font-size:14px;color:var(--text-tertiary);margin-bottom:24px;">URL: ${url}</p>
      <div class="error-actions">
        <button class="btn-primary" onclick="location.reload()">再読み込み</button>
        <button class="btn-secondary" id="try-another-mode">別のモードで試す</button>
      </div>
    </div>
  `;
  
  // 別モードで試すボタン
  document.getElementById('try-another-mode').addEventListener('click',()=>{
    switchProxyMode();
    loadUrl(url);
  });
}

// ========================================
// ナビゲーション
// ========================================

function goBack(){
  if(state.historyIndex>0){
    state.historyIndex--;
    const url=state.history[state.historyIndex];
    state.currentUrl=url;
    urlInput.value=url;
    loadUrl(url);
    updateNavigationButtons();
  }
}

function goForward(){
  if(state.historyIndex<state.history.length-1){
    state.historyIndex++;
    const url=state.history[state.historyIndex];
    state.currentUrl=url;
    urlInput.value=url;
    loadUrl(url);
    updateNavigationButtons();
  }
}

function reload(){
  if(state.currentUrl){
    loadUrl(state.currentUrl);
  }
}

function goHome(){
  browserContent.innerHTML=document.querySelector('.welcome-screen').outerHTML;
  setupWelcomeScreen();
  state.currentUrl='';
  urlInput.value='';
  updateStatus('ホームページ');
}

function updateNavigationButtons(){
  backBtn.disabled=state.historyIndex<=0;
  forwardBtn.disabled=state.historyIndex>=state.history.length-1;
}

// ========================================
// プロキシモード切り替え
// ========================================

function switchProxyMode(){
  const modes=Object.keys(PROXY_SERVICES);
  const currentIndex=modes.indexOf(state.mode);
  const nextIndex=(currentIndex+1)%modes.length;
  state.mode=modes[nextIndex];
  
  currentModeText.textContent=PROXY_SERVICES[state.mode].name;
  updateStatus(`プロキシモード: ${PROXY_SERVICES[state.mode].name}`);
  
  // モードボタンの状態更新
  document.querySelectorAll('.mode-btn').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.mode===state.mode);
  });
}

// ========================================
// ステータス更新
// ========================================

function updateStatus(text){
  statusText.textContent=text;
}

// ========================================
// お気に入り
// ========================================

function toggleBookmark(){
  if(!state.currentUrl)return;
  
  const exists=state.bookmarks.some(b=>b.url===state.currentUrl);
  
  if(exists){
    state.bookmarks=state.bookmarks.filter(b=>b.url!==state.currentUrl);
    alert('お気に入りから削除しました');
  }else{
    state.bookmarks.push({
      url:state.currentUrl,
      title:state.currentUrl
    });
    alert('お気に入りに追加しました');
  }
  
  saveBookmarks();
}

function saveBookmarks(){
  try{
    localStorage.setItem('proxy_bookmarks',JSON.stringify(state.bookmarks));
  }catch(e){
    console.warn('お気に入りの保存に失敗:',e);
  }
}

function loadBookmarks(){
  try{
    const saved=localStorage.getItem('proxy_bookmarks');
    if(saved){
      state.bookmarks=JSON.parse(saved);
    }
  }catch(e){
    console.warn('お気に入りの読み込みに失敗:',e);
  }
}

// ========================================
// 全画面
// ========================================

function toggleFullscreen(){
  const container=document.querySelector('.proxy-container');
  
  if(!document.fullscreenElement){
    container.requestFullscreen().catch(err=>{
      console.error('全画面エラー:',err);
    });
  }else{
    document.exitFullscreen();
  }
}

// ========================================
// ウェルカム画面のセットアップ
// ========================================

function setupWelcomeScreen(){
  // クイックリンク
  document.querySelectorAll('.quick-link').forEach(link=>{
    link.addEventListener('click',()=>{
      loadUrl(link.dataset.url);
    });
  });
  
  // モードボタン
  document.querySelectorAll('.mode-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.mode-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      state.mode=btn.dataset.mode;
      currentModeText.textContent=PROXY_SERVICES[state.mode].name;
      updateStatus(`プロキシモード: ${PROXY_SERVICES[state.mode].name}`);
    });
  });
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
backBtn.addEventListener('click',goBack);
forwardBtn.addEventListener('click',goForward);
reloadBtn.addEventListener('click',reload);
homeBtn.addEventListener('click',goHome);

// ツールバー
bookmarkBtn.addEventListener('click',toggleBookmark);
fullscreenBtn.addEventListener('click',toggleFullscreen);
proxyModeBtn.addEventListener('click',switchProxyMode);

// ブックマークバー
document.querySelectorAll('.bookmark-item').forEach(item=>{
  item.addEventListener('click',()=>{
    loadUrl(item.dataset.url);
  });
});

// ========================================
// 初期化
// ========================================

loadBookmarks();
setupWelcomeScreen();
currentModeText.textContent=PROXY_SERVICES[state.mode].name;

console.log('プロキシブラウザ準備完了！');