import{initPage}from'../common/core.js';

await initPage('proxy','Proxy');

// ========================================
// 状態管理
// ========================================

const state={
  currentUrl:'',
  modeIndex:0,
  isLoading:false
};

// プロキシサービス定義（優先度順）
const PROXY_SERVICES=[
  {
    name:'corsproxy.io',
    url:(t)=>`https://corsproxy.io/?${encodeURIComponent(t)}`
  },
  {
    name:'AllOrigins',
    url:(t)=>`https://api.allorigins.win/raw?url=${encodeURIComponent(t)}`
  },
  {
    name:'CodeTabs',
    url:(t)=>`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(t)}`
  },
  {
    name:'ThingProxy',
    url:(t)=>`https://thingproxy.freeboard.io/fetch/${t}`
  }
];

const TIMEOUT_MS=12000;

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

const welcomeHTML=document.querySelector('.welcome-screen').outerHTML;

// ========================================
// URL正規化
// ========================================

function normalizeUrl(url){
  url=url.trim();
  if(!url)return'';
  if(!/^https?:\/\//i.test(url)){
    // 検索クエリっぽければGoogle検索に
    if(!url.includes('.')&&!url.startsWith('localhost')){
      return`https://www.google.com/search?q=${encodeURIComponent(url)}`;
    }
    url='https://'+url;
  }
  return url;
}

// ========================================
// fetchWithTimeout
// ========================================

async function fetchWithTimeout(url,ms=TIMEOUT_MS){
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),ms);
  try{
    const res=await fetch(url,{signal:ctrl.signal});
    clearTimeout(timer);
    return res;
  }catch(e){
    clearTimeout(timer);
    throw e;
  }
}

// ========================================
// URL読み込み（自動フォールバック）
// ========================================

async function loadUrl(url,startIndex=null){
  if(!url)return;
  url=normalizeUrl(url);
  if(!url)return;

  state.currentUrl=url;
  urlInput.value=url;
  state.isLoading=true;

  const fromIndex=startIndex!==null?startIndex:state.modeIndex;
  let lastError='';

  for(let i=0;i<PROXY_SERVICES.length;i++){
    const idx=(fromIndex+i)%PROXY_SERVICES.length;
    const proxy=PROXY_SERVICES[idx];

    showLoading(proxy.name,i>0);

    try{
      const proxyUrl=proxy.url(url);
      const response=await fetchWithTimeout(proxyUrl);

      if(!response.ok){
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType=response.headers.get('content-type')||'';

      // バイナリ（画像・PDF等）はiframeで直接表示
      if(isBinary(contentType)){
        const blob=await response.blob();
        const blobUrl=URL.createObjectURL(blob);
        showBlobIframe(blobUrl);
        state.modeIndex=idx;
        updateModeBtn();
        state.isLoading=false;
        return;
      }

      let html=await response.text();
      html=processHtml(html,url);

      const blob=new Blob([html],{type:'text/html;charset=utf-8'});
      const blobUrl=URL.createObjectURL(blob);
      showBlobIframe(blobUrl,url);

      state.modeIndex=idx;
      updateModeBtn();
      state.isLoading=false;
      return;

    }catch(err){
      lastError=err.name==='AbortError'?`タイムアウト(${TIMEOUT_MS/1000}s)`:err.message;
      console.warn(`[Proxy] ${proxy.name} 失敗:`,lastError);
    }
  }

  // 全て失敗
  state.isLoading=false;
  showError(url,lastError);
}

// ========================================
// HTMLを処理
// ========================================

function processHtml(html,baseUrl){
  try{
    const base=new URL(baseUrl);
    const origin=base.origin;
    const baseHref=baseUrl.substring(0,baseUrl.lastIndexOf('/')+1);

    // 既存の<base>タグを除去
    html=html.replace(/<base[^>]*>/gi,'');

    // <head>直後に<base>を挿入
    if(/<head[^>]*>/i.test(html)){
      html=html.replace(/<head([^>]*)>/i,`<head$1><base href="${base.href}">`);
    } else {
      html=`<base href="${base.href}">`+html;
    }

    // srcset属性の相対URLを絶対URLに変換
    html=html.replace(/srcset="([^"]*)"/gi,(match,srcset)=>{
      const converted=srcset.replace(/(^|,\s*)(\S+)/g,(m,sep,src)=>{
        if(/^https?:\/\//i.test(src))return m;
        if(src.startsWith('//'))return sep+'https:'+src;
        if(src.startsWith('/'))return sep+origin+src;
        return sep+baseHref+src;
      });
      return`srcset="${converted}"`;
    });

    // インジェクション: リンク/フォームをプロキシ経由にリダイレクト
    const interceptScript=`
<script>
(function(){
  var _open=XMLHttpRequest.prototype.open;
  // リンクのクリックを親フレームに通知
  document.addEventListener('click',function(e){
    var a=e.target.closest('a');
    if(!a||!a.href)return;
    var href=a.href;
    if(href.startsWith('blob:')||href.startsWith('javascript:'))return;
    e.preventDefault();
    window.parent.postMessage({type:'navigate',url:href},'*');
  },true);
  // フォーム送信を親フレームに通知
  document.addEventListener('submit',function(e){
    var f=e.target;
    if(!f.action)return;
    e.preventDefault();
    window.parent.postMessage({type:'navigate',url:f.action},'*');
  },true);
})();
<\/script>`;

    // </body>の直前に挿入
    if(/<\/body>/i.test(html)){
      html=html.replace(/<\/body>/i,interceptScript+'</body>');
    } else {
      html+=interceptScript;
    }

    return html;
  }catch(e){
    console.warn('HTML処理エラー:',e);
    return html;
  }
}

// ========================================
// iframeの表示
// ========================================

function showBlobIframe(blobUrl,originalUrl){
  const iframe=document.createElement('iframe');
  iframe.className='proxy-iframe';
  iframe.src=blobUrl;
  iframe.sandbox='allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals';
  browserContent.innerHTML='';
  browserContent.appendChild(iframe);
}

// postMessageでナビゲーション受信
window.addEventListener('message',(e)=>{
  if(e.data&&e.data.type==='navigate'&&e.data.url){
    loadUrl(e.data.url);
  }
});

// ========================================
// コンテンツタイプ判定
// ========================================

function isBinary(ct){
  return/image\/|application\/pdf|video\/|audio\//.test(ct);
}

// ========================================
// UI表示
// ========================================

function showLoading(serviceName,isFallback){
  const msg=isFallback
    ?`<p style="font-size:12px;color:var(--text-tertiary);margin-top:8px;">${serviceName} で再試行中...</p>`
    :'';
  browserContent.innerHTML=`
    <div class="loading-screen">
      <div class="loading-spinner"></div>
      <p>読み込み中... (${serviceName})</p>
      ${msg}
    </div>
  `;
}

function showError(url,message){
  browserContent.innerHTML=`
    <div class="error-screen">
      <div class="error-icon">
        <span class="material-symbols-outlined">error</span>
      </div>
      <h2>読み込みに失敗しました</h2>
      <p>${escHtml(message)}</p>
      <p style="font-size:13px;color:var(--text-tertiary);margin-bottom:20px;word-break:break-all;">${escHtml(url)}</p>
      <p style="font-size:12px;color:var(--text-tertiary);margin-bottom:20px;">全てのプロキシサービスで失敗しました。<br>対象サイトがAPIアクセスを拒否している可能性があります。</p>
      <div class="error-actions">
        <button class="btn-primary" id="retry-btn">再試行</button>
        <button class="btn-secondary" id="home-err-btn">ホームへ</button>
      </div>
    </div>
  `;
  document.getElementById('retry-btn').addEventListener('click',()=>loadUrl(url));
  document.getElementById('home-err-btn').addEventListener('click',goHome);
}

function escHtml(str){
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ========================================
// ナビゲーション
// ========================================

function reload(){
  if(state.currentUrl)loadUrl(state.currentUrl);
}

function goHome(){
  browserContent.innerHTML=welcomeHTML;
  state.currentUrl='';
  urlInput.value='';
}

// ========================================
// モード表示更新
// ========================================

function updateModeBtn(){
  const name=PROXY_SERVICES[state.modeIndex].name;
  currentModeText.textContent=name;
  // ウェルカム画面のバッジも更新
  const badge=document.querySelector('.mode-badge');
  if(badge)badge.textContent=name;
}

function switchProxyMode(){
  state.modeIndex=(state.modeIndex+1)%PROXY_SERVICES.length;
  updateModeBtn();
}

// ========================================
// 全画面
// ========================================

let controlsTimer=null;
function toggleFullscreen(){
  const isFs=proxyContainer.classList.toggle('is-fullscreen');
  const icon=fullscreenBtn.querySelector('.material-symbols-outlined');
  icon.textContent=isFs?'fullscreen_exit':'fullscreen';

  if(isFs){
    proxyContainer.addEventListener('mousemove',handleMouseMove);
  } else {
    proxyContainer.removeEventListener('mousemove',handleMouseMove);
    proxyContainer.classList.remove('show-controls');
  }
}

function handleMouseMove(){
  proxyContainer.classList.add('show-controls');
  clearTimeout(controlsTimer);
  controlsTimer=setTimeout(()=>proxyContainer.classList.remove('show-controls'),2000);
}

// ========================================
// イベントリスナー
// ========================================

goBtn.addEventListener('click',()=>loadUrl(urlInput.value));
urlInput.addEventListener('keydown',(e)=>{
  if(e.key==='Enter')loadUrl(urlInput.value);
});
reloadBtn.addEventListener('click',reload);
homeBtn.addEventListener('click',goHome);
fullscreenBtn.addEventListener('click',toggleFullscreen);
proxyModeBtn.addEventListener('click',()=>{
  switchProxyMode();
  if(state.currentUrl)loadUrl(state.currentUrl,state.modeIndex);
});

// 初期表示
updateModeBtn();
