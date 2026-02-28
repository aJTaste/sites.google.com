import{initPage}from'../common/core.js';

await initPage('proxy','Proxy');

// ========================================
// 定数
// ========================================

const PROXY_BASE='https://corsproxy.io/?url=';
const TIMEOUT_MS=15000;

function corsProxyUrl(url){
  // スキームとホスト部分を壊さずにそれ以外だけエンコード
  try{
    const u=new URL(url);
    return PROXY_BASE+u.href;
  }catch(e){
    return PROXY_BASE+url;
  }
}

// ========================================
// 状態管理
// ========================================

const state={
  currentUrl:'',
  history:[],
  historyIdx:-1,
  isLoading:false
};

// ========================================
// DOM要素
// ========================================

const urlInput=document.getElementById('url-input');
const goBtn=document.getElementById('go-btn');
const reloadBtn=document.getElementById('reload-btn');
const backBtn=document.getElementById('back-btn');
const forwardBtn=document.getElementById('forward-btn');
const homeBtn=document.getElementById('home-btn');
const fullscreenBtn=document.getElementById('fullscreen-btn');
const browserContent=document.getElementById('browser-content');
const proxyContainer=document.querySelector('.proxy-container');

const welcomeHTML=document.querySelector('.welcome-screen').outerHTML;

// ========================================
// URL正規化
// ========================================

function normalizeUrl(url){
  url=url.trim();
  if(!url)return'';
  if(!/^https?:\/\//i.test(url)){
    if(!url.includes('.')&&!url.startsWith('localhost')){
      return'https://www.google.com/search?q='+encodeURIComponent(url);
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
// URL読み込み
// ========================================

async function loadUrl(url,addHistory=true){
  if(!url)return;
  url=normalizeUrl(url);
  if(!url)return;

  state.currentUrl=url;
  urlInput.value=url;
  state.isLoading=true;
  updateNavBtns();
  showLoading();

  try{
    const proxyUrl=corsProxyUrl(url);
    const response=await fetchWithTimeout(proxyUrl);

    if(!response.ok){
      throw new Error('HTTP '+response.status+' '+response.statusText);
    }

    const contentType=response.headers.get('content-type')||'';

    if(isBinary(contentType)){
      const blob=await response.blob();
      showBlobIframe(URL.createObjectURL(blob));
    }else{
      let html=await response.text();
      html=processHtml(html,url);
      const blob=new Blob([html],{type:'text/html;charset=utf-8'});
      showBlobIframe(URL.createObjectURL(blob));
    }

    if(addHistory){
      state.history.splice(state.historyIdx+1);
      state.history.push(url);
      state.historyIdx=state.history.length-1;
    }

  }catch(err){
    const msg=err.name==='AbortError'
      ?`タイムアウト(${TIMEOUT_MS/1000}s)`
      :err.message;
    showError(url,msg);
  }

  state.isLoading=false;
  updateNavBtns();
}

// ========================================
// HTMLを処理
// ========================================

// URLを絶対パスにしてproxy経由に変換
function toProxy(url,baseHref){
  if(!url)return url;
  url=url.trim();
  if(
    url.startsWith('blob:')||
    url.startsWith('data:')||
    url.startsWith('javascript:')||
    url.startsWith('#')||
    url.startsWith('mailto:')||
    url.startsWith('tel:')
  )return url;
  // protocol-relative
  if(url.startsWith('//')){
    try{url='https:'+url;}catch(e){return url;}
  }
  try{
    const abs=new URL(url,baseHref).href;
    return corsProxyUrl(abs);
  }catch(e){return url;}
}

// 特定タグの特定属性を書き換え
function rewriteAttr(html,tag,attr,baseHref){
  const re=new RegExp(
    '(<'+tag+'(?:[^>]*?)\\s'+attr+'=)("([^"]*)"|(\'([^\']*)\'))',
    'gi'
  );
  return html.replace(re,(m,pre,q,v1,_,v2)=>{
    const val=v1!==undefined?v1:v2;
    const q0=q[0];
    return pre+q0+toProxy(val,baseHref)+q0;
  });
}

// srcset属性を書き換え
function rewriteSrcset(srcset,baseHref){
  // "url 2x, url2 1x" 形式
  return srcset.replace(/((?:^|,)\s*)([^\s,]+)/g,(m,sep,src)=>{
    return sep+toProxy(src,baseHref);
  });
}

// CSS内のurl()を書き換え
function rewriteCssUrls(css,baseHref){
  return css.replace(/url\(\s*(['"]?)([^'"\)\s]+)\1\s*\)/gi,(m,q,url)=>{
    return'url('+q+toProxy(url,baseHref)+q+')';
  });
}

function processHtml(html,baseUrl){
  try{
    const base=new URL(baseUrl);
    const baseHref=base.href;

    // 既存の<base>タグを除去（相対URL解決は自前で行う）
    html=html.replace(/<base[^>]*>/gi,'');

    // リソース系のsrc属性を書き換え
    for(const tag of['img','script','video','audio','source','track','embed']){
      html=rewriteAttr(html,tag,'src',baseHref);
    }

    // <link href>を書き換え（stylesheet / icon等）
    html=rewriteAttr(html,'link','href',baseHref);

    // srcset属性を書き換え
    html=html.replace(/(srcset=)("([^"]*)"|(\'([^\']*)\'))/gi,(m,pre,q,v1,_,v2)=>{
      const val=v1!==undefined?v1:v2;
      const q0=q[0];
      return pre+q0+rewriteSrcset(val,baseHref)+q0;
    });

    // <style>ブロック内のurl()を書き換え
    html=html.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/gi,(m,open,css,close)=>{
      return open+rewriteCssUrls(css,baseHref)+close;
    });

    // style属性内のurl()を書き換え
    html=html.replace(/(\sstyle=)(["'])([\s\S]*?)\2/gi,(m,pre,q,css)=>{
      return pre+q+rewriteCssUrls(css,baseHref)+q;
    });

    // <a href>と<form action>はプロキシせず、JS側でインターセプト
    // インジェクションスクリプト
    const safeBase=baseHref.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const interceptScript=`<script>
(function(){
  var BASE='${safeBase}';
  function resolve(url){
    try{return new URL(url,BASE).href;}catch(e){return url;}
  }
  document.addEventListener('click',function(e){
    var a=e.target.closest('a');
    if(!a)return;
    var href=a.getAttribute('href');
    if(!href||href.startsWith('javascript:')||href.startsWith('#'))return;
    e.preventDefault();
    window.parent.postMessage({type:'navigate',url:resolve(href)},'*');
  },true);
  document.addEventListener('submit',function(e){
    var f=e.target;
    var action=f.getAttribute('action')||BASE;
    e.preventDefault();
    window.parent.postMessage({type:'navigate',url:resolve(action)},'*');
  },true);
})();
<\/script>`;

    if(/<\/body>/i.test(html)){
      html=html.replace(/<\/body>/i,interceptScript+'</body>');
    }else{
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

function showBlobIframe(blobUrl){
  const iframe=document.createElement('iframe');
  iframe.className='proxy-iframe';
  iframe.src=blobUrl;
  iframe.sandbox='allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals';
  browserContent.innerHTML='';
  browserContent.appendChild(iframe);
}

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

function showLoading(){
  browserContent.innerHTML=`
    <div class="loading-screen">
      <div class="loading-spinner"></div>
      <p>読み込み中...</p>
      <p style="font-size:12px;color:var(--text-tertiary);margin-top:8px;">corsproxy.io</p>
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
      <p style="font-size:12px;color:var(--text-tertiary);margin-bottom:20px;">
        対象サイトがAPIアクセスを拒否しているか、<br>corsproxy.ioが応答していない可能性があります。
      </p>
      <div class="error-actions">
        <button class="btn-primary" id="retry-btn">再試行</button>
        <button class="btn-secondary" id="home-err-btn">ホームへ</button>
      </div>
    </div>
  `;
  document.getElementById('retry-btn').addEventListener('click',()=>loadUrl(url,false));
  document.getElementById('home-err-btn').addEventListener('click',goHome);
}

function escHtml(str){
  return str
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
}

// ========================================
// ナビゲーション
// ========================================

function goBack(){
  if(state.historyIdx<=0)return;
  state.historyIdx--;
  const url=state.history[state.historyIdx];
  state.currentUrl=url;
  urlInput.value=url;
  loadUrl(url,false);
}

function goForward(){
  if(state.historyIdx>=state.history.length-1)return;
  state.historyIdx++;
  const url=state.history[state.historyIdx];
  state.currentUrl=url;
  urlInput.value=url;
  loadUrl(url,false);
}

function reload(){
  if(state.currentUrl)loadUrl(state.currentUrl,false);
}

function goHome(){
  browserContent.innerHTML=welcomeHTML;
  state.currentUrl='';
  urlInput.value='';
  updateNavBtns();
}

function updateNavBtns(){
  backBtn.disabled=state.historyIdx<=0;
  forwardBtn.disabled=state.historyIdx>=state.history.length-1;
  reloadBtn.disabled=!state.currentUrl||state.isLoading;
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
  }else{
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
backBtn.addEventListener('click',goBack);
forwardBtn.addEventListener('click',goForward);
homeBtn.addEventListener('click',goHome);
fullscreenBtn.addEventListener('click',toggleFullscreen);

updateNavBtns();
