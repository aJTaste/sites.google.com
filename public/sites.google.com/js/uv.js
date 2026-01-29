import{initPage}from'../common/core.js';

await initPage('uv','Ultraviolet Proxy');

// ========================================
// 状態管理
// ========================================

const state={
  currentUrl:'',
  currentServer:0
};

// 公開Ultravioletサーバー一覧
const UV_SERVERS=[
  {
    name:'Server 1',
    url:'https://uv.holy.how/service/'
  },
  {
    name:'Server 2',
    url:'https://static-uv.onrender.com/service/'
  },
  {
    name:'Server 3',
    url:'https://uv.edu.iamjasonafrica.dev/service/'
  },
  {
    name:'Server 4',
    url:'https://uv-demo.titaniumnetwork.org/service/'
  }
];

// ========================================
// DOM要素
// ========================================

const urlInput=document.getElementById('url-input');
const goBtn=document.getElementById('go-btn');
const reloadBtn=document.getElementById('reload-btn');
const homeBtn=document.getElementById('home-btn');
const fullscreenBtn=document.getElementById('fullscreen-btn');
const serverToggleBtn=document.getElementById('server-toggle-btn');
const browserContent=document.getElementById('browser-content');
const currentServerText=document.getElementById('current-server');
const uvContainer=document.querySelector('.uv-container');

// ウェルカム画面のHTML（保存しておく）
const welcomeHTML=document.querySelector('.welcome-screen').outerHTML;

// ========================================
// URL読み込み
// ========================================

function loadUrl(url){
  if(!url)return;
  
  // URLの正規化
  if(!url.startsWith('http')){
    url='https://'+url;
  }
  
  state.currentUrl=url;
  urlInput.value=url;
  
  // ローディング表示
  showLoading();
  
  try{
    // Ultravioletサーバー経由でアクセス
    const server=UV_SERVERS[state.currentServer];
    const encodedUrl=encodeURIComponent(url);
    const proxyUrl=`${server.url}${encodedUrl}`;
    
    // iframeで表示
    const iframe=document.createElement('iframe');
    iframe.className='uv-iframe';
    iframe.src=proxyUrl;
    iframe.sandbox='allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads';
    
    browserContent.innerHTML='';
    browserContent.appendChild(iframe);
    
    // エラーハンドリング
    iframe.addEventListener('error',()=>{
      showError(url,'読み込みに失敗しました。サーバーを切り替えてお試しください。');
    });
    
    // 読み込み完了後の処理
    iframe.addEventListener('load',()=>{
      console.log('ページ読み込み完了:',url);
    });
    
  }catch(error){
    console.error('読み込みエラー:',error);
    showError(url,error.message);
  }
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
        <button class="btn-secondary" id="try-another-server">別のサーバーで試す</button>
      </div>
    </div>
  `;
  
  // 別サーバーで試すボタン
  document.getElementById('try-another-server').addEventListener('click',()=>{
    switchServer();
    loadUrl(url);
  });
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
  browserContent.innerHTML=welcomeHTML;
  state.currentUrl='';
  urlInput.value='';
}

// ========================================
// サーバー切り替え
// ========================================

function switchServer(){
  state.currentServer=(state.currentServer+1)%UV_SERVERS.length;
  const server=UV_SERVERS[state.currentServer];
  currentServerText.textContent=server.name;
  
  // 現在ページ表示中なら再読み込み
  if(state.currentUrl){
    loadUrl(state.currentUrl);
  }
}

// ========================================
// 全画面
// ========================================

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

// キーボードイベント
document.addEventListener('keydown',(e)=>{
  // 上矢印キーでヘッダー表示/非表示切替
  if(e.key==='ArrowUp'){
    toggleControls();
  }
  // ESCキーで全画面解除
  if(e.key==='Escape'&&uvContainer.classList.contains('is-fullscreen')){
    toggleFullscreen();
  }
});

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

// ツールバー
fullscreenBtn.addEventListener('click',toggleFullscreen);
serverToggleBtn.addEventListener('click',switchServer);

// ========================================
// 初期化
// ========================================

currentServerText.textContent=UV_SERVERS[state.currentServer].name;

console.log('Ultraviolet Proxy準備完了！');
