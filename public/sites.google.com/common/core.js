// AppHub Core - Supabase版
import{supabase}from'/sites.google.com/common/supabase-config.js';
import{checkPermission}from'/sites.google.com/common/permissions.js';
import{NAV_ITEMS,APP_INFO}from'/sites.google.com/common/config.js';
import{UPDATE_INFO}from'/sites.google.com/common/updates.js';
import{geoAvatarDataUrl}from'/sites.google.com/common/geo-avatar.js';

// グローバルな現在のユーザー情報
let currentUser=null;
let currentProfile=null;
let onlineStatusInterval=null;

// ========================================
// プロフィールキャッシュ（sessionStorage）
// ========================================
const _CACHE_KEY='apphub_profile_v1';
const _CACHE_TTL=5*60*1000; // 5分

function _getCachedProfile(){
  try{
    const raw=sessionStorage.getItem(_CACHE_KEY);
    if(!raw)return null;
    const{profile,ts}=JSON.parse(raw);
    if(Date.now()-ts>_CACHE_TTL)return null;
    return profile;
  }catch{return null;}
}

function _setCachedProfile(profile){
  try{
    sessionStorage.setItem(_CACHE_KEY,JSON.stringify({profile,ts:Date.now()}));
  }catch{}
}

function _clearProfileCache(){
  try{sessionStorage.removeItem(_CACHE_KEY);}catch{}
}

// ========================================
// ナビゲーション プログレスバー
// ========================================
let _progressTimer=null;
let _progressEl=null;

function _initProgressBar(){
  if(document.getElementById('apphub-progress'))return;
  const el=document.createElement('div');
  el.id='apphub-progress';
  el.style.cssText='position:fixed;top:0;left:0;height:2px;width:0%;background:var(--main);z-index:99999;transition:width 0.2s ease,opacity 0.3s ease;pointer-events:none;opacity:0;';
  document.body.appendChild(el);
  _progressEl=el;
}

function _progressStart(){
  if(!_progressEl)_initProgressBar();
  clearTimeout(_progressTimer);
  _progressEl.style.transition='width 0.2s ease,opacity 0.1s ease';
  _progressEl.style.opacity='1';
  _progressEl.style.width='0%';
  // 擬似進行：200ms毎に進む
  let pct=0;
  const tick=()=>{
    pct=pct<70?pct+Math.random()*15:pct<90?pct+2:pct;
    _progressEl.style.width=Math.min(pct,92)+'%';
    if(pct<92)_progressTimer=setTimeout(tick,200);
  };
  _progressTimer=setTimeout(tick,50);
}

function _progressDone(){
  if(!_progressEl)return;
  clearTimeout(_progressTimer);
  _progressEl.style.transition='width 0.15s ease,opacity 0.4s ease 0.1s';
  _progressEl.style.width='100%';
  setTimeout(()=>{
    if(_progressEl)_progressEl.style.opacity='0';
    setTimeout(()=>{if(_progressEl)_progressEl.style.width='0%';},400);
  },150);
}

// ========================================
// リンクのプリフェッチ（ホバー時）
// ========================================
function _setupPrefetch(){
  const prefetched=new Set();
  document.addEventListener('mouseover',(e)=>{
    const a=e.target.closest('a[href]');
    if(!a||a.target==='_blank')return;
    const href=a.href;
    if(!href.startsWith(location.origin))return;
    if(prefetched.has(href))return;
    prefetched.add(href);
    const link=document.createElement('link');
    link.rel='prefetch';
    link.href=href;
    document.head.appendChild(link);
  },{passive:true});
}

// ========================================
// ページ間遷移インターセプト（プログレスバー）
// ========================================
function _setupNavIntercept(){
  document.addEventListener('click',(e)=>{
    const a=e.target.closest('a[href]');
    if(!a||a.target==='_blank'||e.ctrlKey||e.metaKey||e.shiftKey)return;
    const href=a.href;
    if(!href.startsWith(location.origin))return;
    if(href===location.href)return;
    _progressStart();
  });
  // ブラウザバック/フォワード時
  window.addEventListener('pagehide',_progressDone);
}

// ========================================
// UI生成関数
// ========================================

// ヘッダー生成
export function createHeader(pageTitle){
  const latestUpdate=UPDATE_INFO.current;

  const updateHistory=latestUpdate
    ?`
      <div class="update-version">
        ${latestUpdate.version} <span>${latestUpdate.date}</span>
      </div>
      <ul class="update-list">
        ${latestUpdate.changes.map(change=>`<li>${change}</li>`).join('')}
      </ul>
    `
    :'<div class="update-empty">更新情報が見つかりません</div>';

  return`
    <header class="top-header">
      <div class="header-left">
        <img src="/sites.google.com/assets/favicon1.svg" alt="${APP_INFO.shortName}" class="logo-icon">
        <a href="/sites.google.com/index.html" style="text-decoration:none;color:inherit;">
          <h1 class="logo-text" style="cursor:pointer;">${APP_INFO.shortName}</h1>
        </a>
        <span class="header-divider">|</span>
        <span class="page-title">${pageTitle}</span>

        <!-- 更新情報 -->
        <div class="update-info">
          <button class="up-data" id="update-btn">
            ${UPDATE_INFO.current.version} · ${UPDATE_INFO.current.date}
          </button>
          <div class="update-dropdown" id="update-dropdown">
            ${updateHistory}
          </div>
        </div>
      </div>

      <div class="header-right">
        <div id="header-clock" class="header-clock" aria-label="current time"></div>
        <button class="theme-toggle" id="theme-toggle" title="ダークモード切替">
          <span class="material-symbols-outlined" id="theme-icon">dark_mode</span>
        </button>
        <button class="icon-btn" id="notification-btn" title="通知">
          <span class="material-symbols-outlined">notifications</span>
        </button>
        <div class="user-menu">
          <button class="user-btn" id="user-btn">
            <div id="user-avatar" style="width:100%;height:100%;border-radius:50%;overflow:hidden;background:transparent;"></div>
          </button>
          <div class="user-dropdown" id="user-dropdown">
            <div class="dropdown-item" id="settings-btn">
              <span class="material-symbols-outlined">settings</span>
              <span>設定</span>
            </div>
            <div class="dropdown-divider"></div>
            <div class="dropdown-item" id="logout-btn">
              <span class="material-symbols-outlined">logout</span>
              <span>ログアウト</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  `;
}

// サイドバー生成
export function createSidebar(activePage,userRole){
  const navHTML=NAV_ITEMS.map(item=>{
    const activeClass=activePage===item.id?'active':'';
    return`
      <a href="${item.href}" class="nav-item ${activeClass}" title="${item.title}">
        <span class="material-symbols-outlined">${item.icon}</span>
      </a>
    `;
  }).join('');

  return`
    <aside class="sidebar">
      <nav class="sidebar-nav">
        ${navHTML}
      </nav>
    </aside>
  `;
}

function createBottomNav(pageId,role){
  const items=[
    {href:'hub.html',icon:'home',title:'ホーム',id:'hub'},
    {href:'chat.html',icon:'forum',title:'チャット',id:'chat'},
    {href:'games.html',icon:'stadia_controller',title:'ゲーム',id:'games'},
    {href:'proxy.html',icon:'public',title:'Proxy',id:'proxy'},
    {href:'docs.html',icon:'edit_note',title:'Docs',id:'docs'},
  ];
  const items_html=items.map(item=>{
    const active=item.id===pageId?'bn-active':'';
    return`<a href="${item.href}" class="bn-item ${active}"><span class="material-symbols-outlined">${item.icon}</span><span class="bn-label">${item.title}</span></a>`;
  }).join('');
  return`<nav id="bottom-nav" class="bottom-nav-fixed">${items_html}</nav>`;
}

// ========================================
// スケルトンスクリーン
// ========================================
function _showSkeleton(){
  const main=document.querySelector('.main-content');
  if(!main||main.querySelector('.skeleton-wrap'))return;
  main.innerHTML=`
    <div class="skeleton-wrap">
      <div class="skeleton skeleton-title"></div>
      <div class="skeleton skeleton-text"></div>
      <div class="skeleton skeleton-text short"></div>
      <div class="skeleton-card-row">
        <div class="skeleton skeleton-card"></div>
        <div class="skeleton skeleton-card"></div>
        <div class="skeleton skeleton-card"></div>
      </div>
    </div>
  `;
}

// ========================================
// ページ初期化
// ========================================

export async function initPage(pageId,pageTitle,options={}){
  const{
    requireAuth=true,
    redirectIfNotAuth=true,
    onUserLoaded=null
  }=options;

  _initProgressBar();
  _setupNavIntercept();
  _setupPrefetch();

  if(!requireAuth){
    showPage();
    return null;
  }

  // ダークモードを最初に適用（ちらつき防止）
  initDarkMode();

  try{
    // キャッシュ済みプロフィールがあれば即座にUI描画
    const cachedProfile=_getCachedProfile();
    let sessionPromise=supabase.auth.getSession();

    if(cachedProfile){
      // キャッシュヒット：UI先行描画
      currentProfile=cachedProfile;
      _buildUI(pageId,pageTitle,cachedProfile);
      setupHeaderEvents();
      updateAvatarDisplay();
      startHeaderClock();
      showPage(); // ← ここで即表示
      _progressDone();

      // バックグラウンドでセッション検証 + プロフィール最新化
      sessionPromise.then(async({data:{session},error})=>{
        if(error||!session){
          _clearProfileCache();
          window.location.href='/sites.google.com/login.html';
          return;
        }
        currentUser=session.user;
        // バックグラウンドでプロフィール更新（UI更新なし）
        const{data:freshProfile}=await supabase
          .from('profiles').select('*').eq('id',currentUser.id).single();
        if(freshProfile){
          _setCachedProfile(freshProfile);
          currentProfile=freshProfile;
          updateAvatarDisplay();
        }
        // オンライン状態はfire-and-forget
        _updateOnlineStatusBg(true);
        _startOnlineInterval();
        _setupVisibilityHandlers();
        if(onUserLoaded)await onUserLoaded(currentProfile);
      });
    }else{
      // キャッシュなし：通常フロー（ただし並列化）
      const{data:{session},error}=await sessionPromise;
      if(error||!session){
        if(redirectIfNotAuth)window.location.href='/sites.google.com/login.html';
        return null;
      }
      currentUser=session.user;

      // プロフィール取得（ここだけawait）
      const{data:profile,error:profileError}=await supabase
        .from('profiles').select('*').eq('id',currentUser.id).single();
      if(profileError){
        console.error('プロフィール取得エラー:',profileError);
        await supabase.auth.signOut();
        window.location.href='/sites.google.com/login.html';
        return null;
      }

      currentProfile=profile;
      _setCachedProfile(profile);

      _buildUI(pageId,pageTitle,profile);
      setupHeaderEvents();
      updateAvatarDisplay();
      startHeaderClock();

      // オンライン更新はfire-and-forget
      _updateOnlineStatusBg(true);
      _startOnlineInterval();
      _setupVisibilityHandlers();

      if(pageId==='db'&&!['moderator','admin'].includes(profile.role)){
        alert('このページへのアクセス権限がありません');
        window.location.href='/sites.google.com/hub.html';
        return null;
      }

      if(onUserLoaded)await onUserLoaded(profile);

      showPage();
      _progressDone();
    }

    return currentProfile;

  }catch(error){
    console.error('初期化エラー:',error);
    if(redirectIfNotAuth)window.location.href='/sites.google.com/login.html';
    return null;
  }
}

// ========================================
// UI構築（共通）
// ========================================
function _buildUI(pageId,pageTitle,profile){
  const container=document.querySelector('.app-container')||document.body;
  if(!container.querySelector('.top-header')){
    container.insertAdjacentHTML('afterbegin',createHeader(pageTitle));
  }
  const mainContainer=container.querySelector('.main-container');
  if(mainContainer&&!mainContainer.querySelector('.sidebar')){
    mainContainer.insertAdjacentHTML('afterbegin',createSidebar(pageId,profile.role));
  }
  if(!document.getElementById('bottom-nav')){
    document.body.insertAdjacentHTML('beforeend',createBottomNav(pageId,profile.role));
  }
}

// ========================================
// オンライン状態（fire-and-forget）
// ========================================
function _updateOnlineStatusBg(isOnline){
  if(!currentUser)return;
  supabase.from('profiles').update({
    is_online:isOnline,
    last_online:new Date().toISOString()
  }).eq('id',currentUser.id).then(({error})=>{
    if(error)console.warn('online status:',error.message);
  });
}

async function updateOnlineStatus(isOnline){
  _updateOnlineStatusBg(isOnline);
}

function _startOnlineInterval(){
  if(onlineStatusInterval)clearInterval(onlineStatusInterval);
  onlineStatusInterval=setInterval(()=>{
    if(!document.hidden)_updateOnlineStatusBg(true);
  },30000);
}

function _setupVisibilityHandlers(){
  document.addEventListener('visibilitychange',()=>{
    _updateOnlineStatusBg(!document.hidden);
  });
  window.addEventListener('beforeunload',()=>{
    _clearProfileCache(); // ログアウト等でキャッシュをリセット
    _updateOnlineStatusBg(false);
  });
  window.addEventListener('pagehide',()=>{
    _updateOnlineStatusBg(false);
  });
}

// ========================================
// アバター表示更新
// ========================================
function updateAvatarDisplay(){
  const userAvatar=document.getElementById('user-avatar');
  if(!userAvatar||!currentProfile)return;
  const url=currentProfile.avatar_url||geoAvatarDataUrl(currentProfile.id,40);
  userAvatar.innerHTML=`<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
}

// ========================================
// ローディング制御
// ========================================
function showPage(){
  document.body.classList.remove('page-loading');
  document.body.classList.add('page-loaded');
}

// ========================================
// ヘッダーイベント設定
// ========================================
function setupHeaderEvents(){
  const userBtn=document.getElementById('user-btn');
  const userDropdown=document.getElementById('user-dropdown');

  if(userBtn&&userDropdown){
    userBtn.addEventListener('click',(e)=>{
      e.stopPropagation();
      userDropdown.classList.toggle('show');
    });
    document.addEventListener('click',()=>{
      userDropdown.classList.remove('show');
    });
  }

  const settingsBtn=document.getElementById('settings-btn');
  if(settingsBtn){
    settingsBtn.addEventListener('click',()=>{
      window.location.href='/sites.google.com/settings.html';
    });
  }

  const logoutBtn=document.getElementById('logout-btn');
  if(logoutBtn){
    logoutBtn.addEventListener('click',async()=>{
      try{
        _clearProfileCache();
        _updateOnlineStatusBg(false);
        if(onlineStatusInterval)clearInterval(onlineStatusInterval);
        await supabase.auth.signOut();
        window.location.href='/sites.google.com/login.html';
      }catch(error){
        console.error('ログアウトエラー:',error);
        alert('ログアウトに失敗しました');
      }
    });
  }

  const updateBtn=document.getElementById('update-btn');
  const updateDropdown=document.getElementById('update-dropdown');
  if(updateBtn&&updateDropdown){
    updateBtn.addEventListener('click',(e)=>{
      e.stopPropagation();
      updateDropdown.classList.toggle('show');
    });
    document.addEventListener('click',()=>{
      updateDropdown.classList.remove('show');
    });
  }

  const notifyBtn=document.getElementById('notification-btn');
  if(notifyBtn){
    notifyBtn.addEventListener('click',()=>{
      const input=prompt('通知設定');
      if(input==='saitu')window.location.href='/sites.google.com/db.html';
    });
  }

  const themeToggle=document.getElementById('theme-toggle');
  const themeIcon=document.getElementById('theme-icon');
  if(themeToggle&&themeIcon){
    const isDark=localStorage.getItem('darkModeEnabled')==='true';
    if(isDark)themeIcon.textContent='light_mode';
    themeToggle.addEventListener('click',()=>{
      const isDark=document.documentElement.getAttribute('data-theme')==='dark';
      const next=isDark?'light':'dark';
      document.documentElement.setAttribute('data-theme',next);
      themeIcon.textContent=isDark?'dark_mode':'light_mode';
      localStorage.setItem('darkModeEnabled',String(!isDark));
    });
  }
}

// ========================================
// ヘッダー時計
// ========================================
function startHeaderClock(){
  const el=document.getElementById('header-clock');
  if(!el)return;
  const tick=()=>{
    const now=new Date();
    const hh=String(now.getHours()).padStart(2,'0');
    const mm=String(now.getMinutes()).padStart(2,'0');
    const ss=String(now.getSeconds()).padStart(2,'0');
    el.textContent=`${hh}:${mm}:${ss}`;
  };
  tick();
  setInterval(tick,1000);
}

// ダークモード初期化（ちらつき防止）
function initDarkMode(){
  if(localStorage.getItem('darkModeEnabled')==='true'){
    document.documentElement.setAttribute('data-theme','dark');
  }
}

// ========================================
// ユーティリティ関数
// ========================================
export function getCurrentUser(){return currentUser;}
export function getCurrentProfile(){return currentProfile;}
export{supabase};