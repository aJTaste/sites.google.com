import{initPage}from'../common/core.js';

await initPage('proxy','プロキシブラウザ');

// ========================================
// 状態管理
// ========================================

const state={
  currentUrl:'',
  mode:'allorigins' // allorigins or corsproxy
};

// プロキシサービス定義
const PROXY_SERVICES={
  allorigins:{
    name:'AllOrigins',
    url:(target)=>`https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`
  },
  corsproxy:{
    name:'CORS Proxy',
    url:(target)=>`https://corsproxy.io/?${encodeURIComponent(target)}`
  }
};

// ========================================
// DOM要素
// ========================================

const urlInput=document.getElementById('url-input');
const goBtn=document.getElementById('go-btn');
const reloadBtn=document.getElementById('reload-btn');
const homeBtn=document.getElementById('home-btn');
const fullscreenBtn=document.getElementById('fullscreen-btn');
const proxyModeBtn=document.getElementById('proxy-mode-btn');
const browserContent=document.getElementById('browser-content');
const currentModeText=document.getElementById('current-mode');
const proxyContainer=document.querySelector('.proxy-container');

// ウェルカム画面のHTML（保存しておく）
const welcomeHTML=document.querySelector('.welcome-screen').outerHTML;

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
  
  // ローディング表示
  showLoading();
  
  try{
    const proxy=PROXY_SERVICES[state.mode];
    const proxyUrl=proxy.url(url);
    
    const response=await fetch(proxyUrl);
    
    if(!response.ok){
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    let html=await response.text();
    
    // HTMLを修正（リンククリック対応）
    html=processHtml(html,url);
    
    // sandboxedなiframe内で表示
    const blob=new Blob([html],{type:'text/html'});
    const blobUrl=URL.createObjectURL(blob);
    
    const iframe=document.createElement('iframe');
    iframe.className='proxy-iframe';
    iframe.src=blobUrl;
    iframe.sandbox='allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox';
    
    browserContent.innerHTML='';
    browserContent.appendChild(iframe);
    
    // iframeのリンククリックを監視
    iframe.addEventListener('load',()=>{
      try{
        const iframeDoc=iframe.contentDocument||iframe.contentWindow.document;
        
        // 全リンクにイベントリスナー
        iframeDoc.addEventListener('click',(e)=>{
          const link=e.target.closest('a');
          if(link&&link.href){
            e.preventDefault();
            const newUrl=link.href;
            loadUrl(newUrl);
          }
        });
        
        // フォーム送信を監視
        iframeDoc.addEventListener('submit',(e)=>{
          const form=e.target;
          if(form.action){
            e.preventDefault();
            loadUrl(form.action);
          }
        });
      }catch(err){
        console.warn('iframe監視エラー:',err);
      }
    });
    
  }catch(error){
    console.error('読み込みエラー:',error);
    showError(url,error.message);
  }
}

// HTMLを処理（相対URLを絶対URLに変換）
function processHtml(html,baseUrl){
  try{
    const base=new URL(baseUrl);
    const origin=base.origin;
    
    // <base>タグを追加
    html=html.replace(/<head>/i,`<head><base href="${origin}/">`);
    
    // 相対パスを絶対パスに変換
    html=html.replace(/href="\/([^"]*)"/gi,`href="${origin}/$1"`);
    html=html.replace(/src="\/([^"]*)"/gi,`src="${origin}/$1"`);
    
    return html;
  }catch(e){
    console.warn('HTML処理エラー:',e);
    return html;
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
// プロキシモード切り替え
// ========================================

function switchProxyMode(){
  const modes=Object.keys(PROXY_SERVICES);
  const currentIndex=modes.indexOf(state.mode);
  const nextIndex=(currentIndex+1)%modes.length;
  state.mode=modes[nextIndex];
  
  currentModeText.textContent=PROXY_SERVICES[state.mode].name;
  
  // 現在ページ表示中なら再読み込み
  if(state.currentUrl){
    loadUrl(state.currentUrl);
  }
}

// ========================================
// 全画面
// ========================================

function toggleFullscreen(){
  proxyContainer.classList.toggle('is-fullscreen');
  
  if(proxyContainer.classList.contains('is-fullscreen')){
    fullscreenBtn.querySelector('.material-symbols-outlined').textContent='fullscreen_exit';
  }else{
    fullscreenBtn.querySelector('.material-symbols-outlined').textContent='fullscreen';
    proxyContainer.classList.remove('show-controls');
  }
}

function toggleControls(){
  if(!proxyContainer.classList.contains('is-fullscreen'))return;
  proxyContainer.classList.toggle('show-controls');
}

// キーボードイベント
document.addEventListener('keydown',(e)=>{
  // 上矢印キーでヘッダー表示/非表示切替
  if(e.key==='ArrowUp'){
    toggleControls();
  }
  // ESCキーで全画面解除
  if(e.key==='Escape'&&proxyContainer.classList.contains('is-fullscreen')){
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
proxyModeBtn.addEventListener('click',switchProxyMode);

// ========================================
// 初期化
// ========================================

currentModeText.textContent=PROXY_SERVICES[state.mode].name;

console.log('プロキシブラウザ準備完了！');