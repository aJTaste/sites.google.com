// AppHub Core - Supabase版
import { supabase } from './supabase-config.js';
import { checkPermission } from './permissions.js';
import { NAV_ITEMS, APP_INFO } from './config.js';
import { UPDATE_INFO } from './updates.js';

// グローバルな現在のユーザー情報
let currentUser = null;
let currentProfile = null;
let onlineStatusInterval = null;

// ========================================
// UI生成関数
// ========================================

// ヘッダー生成
export function createHeader(pageTitle) {
  const latestUpdate = UPDATE_INFO.current;

  const updateHistory = latestUpdate
    ? `
      <div class="update-version">
        ${latestUpdate.version} <span>${latestUpdate.date}</span>
      </div>
      <ul class="update-list">
        ${latestUpdate.changes.map(change => `<li>${change}</li>`).join('')}
      </ul>
    `
    : '<div class="update-empty">更新情報が見つかりません</div>';

  return `
    <header class="top-header">
      <div class="header-left">
        <img src="/sites.google.com/assets/favicon1.svg" alt="${APP_INFO.shortName}" class="logo-icon">
        <a href="/sites.google.com/index.html" style="text-decoration:none;color:inherit;">
          <h1 class="logo-text" style="cursor:pointer;">${APP_INFO.shortName}</h1>
        </a>
        <span class="header-divider">|</span>
        <span class="page-title">${pageTitle}</span>

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
            <div id="user-avatar" style="width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#FF6B35;color:#fff;font-weight:600;font-size:14px;">?</div>
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
export function createSidebar(activePage) {
  const navHTML = NAV_ITEMS.map(item => {
    const activeClass = activePage === item.id ? 'active' : '';
    return `
      <a href="${item.href}" class="nav-item ${activeClass}" title="${item.title}">
        <span class="material-symbols-outlined">${item.icon}</span>
      </a>
    `;
  }).join('');

  return `
    <aside class="sidebar">
      <nav class="sidebar-nav">
        ${navHTML}
      </nav>
    </aside>
  `;
}

// ========================================
// ページ初期化
// ========================================

export async function initPage(pageId, pageTitle, options = {}) {
  const {
    requireAuth = true,
    redirectIfNotAuth = true,
    onUserLoaded = null
  } = options;

  if (!requireAuth) {
    showPage();
    return null;
  }

  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;

    if (!session) {
      if (redirectIfNotAuth) {
        window.location.href = '/sites.google.com/login.html';
      }
      return null;
    }

    currentUser = session.user;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .single();

    if (profileError) throw profileError;

    currentProfile = profile;

    await updateOnlineStatus(true);

    if (onlineStatusInterval) clearInterval(onlineStatusInterval);
    onlineStatusInterval = setInterval(() => updateOnlineStatus(true), 30000);

    const container = document.querySelector('.app-container') || document.body;

    if (!container.querySelector('.top-header')) {
      container.insertAdjacentHTML('afterbegin', createHeader(pageTitle));
    }

    const mainContainer = container.querySelector('.main-container');
    if (mainContainer && !container.querySelector('.sidebar')) {
      mainContainer.insertAdjacentHTML('afterbegin', createSidebar(pageId));
    }

    setupHeaderEvents();
    initDarkMode();
    updateAvatarDisplay();
    startHeaderClock();

    if (pageId === 'db' && !['moderator', 'admin'].includes(profile.role)) {
      alert('このページへのアクセス権限がありません');
      window.location.href = '/sites.google.com/hub.html';
      return null;
    }

    if (onUserLoaded) await onUserLoaded(profile);

    showPage();
    return profile;

  } catch (error) {
    console.error('初期化エラー:', error);
    if (redirectIfNotAuth) {
      window.location.href = '/sites.google.com/login.html';
    }
    return null;
  }
}

// オンライン状態を更新
async function updateOnlineStatus(isOnline){
  try{
    await supabase
      .from('profiles')
      .update({
        is_online:isOnline,
        last_online:new Date().toISOString()
      })
      .eq('id',currentUser.id);
  }catch(error){
    console.error('オンライン状態更新エラー:',error);
  }
}

// ========================================
// アバター表示更新
// ========================================

function updateAvatarDisplay(){
  const userAvatar=document.getElementById('user-avatar');
  if(!userAvatar||!currentProfile)return;
  
  if(currentProfile.avatar_url){
    // 画像URLがある場合
    userAvatar.innerHTML=`<img src="${currentProfile.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  }else{
    // デフォルト：イニシャル + 背景色
    const initial=currentProfile.display_name.charAt(0).toUpperCase();
    userAvatar.style.background=currentProfile.avatar_color||'#FF6B35';
    userAvatar.textContent=initial;
  }
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
  
  const profileBtn=document.getElementById('profile-btn');
  if(profileBtn){
    profileBtn.addEventListener('click',()=>{
      window.location.href='/sites.google.com/profile.html';
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
        // オフライン状態に更新
        await updateOnlineStatus(false);
        if(onlineStatusInterval){
          clearInterval(onlineStatusInterval);
        }
        
        await supabase.auth.signOut();
        window.location.href='/sites.google.com/login.html';
      }catch(error){
        console.error('ログアウトエラー:',error);
        alert('ログアウトに失敗しました');
      }
    });
  }
  
  // 更新情報ドロップダウン
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
  
  // 通知ボタン：パスワード式 隠し遷移
  const notifyBtn=document.getElementById('notification-btn');
  if(notifyBtn){
    notifyBtn.addEventListener('click',()=>{
      const input=prompt('通知設定');
      if(input==='saitu'){
        window.location.href='/sites.google.com/db.html';
      }
    });
  }

  // ダークモード切替
  const themeToggle=document.getElementById('theme-toggle');
  const themeIcon=document.getElementById('theme-icon');

  if(themeToggle&&themeIcon){
    // 初期状態を読み込み
    const savedTheme=localStorage.getItem('darkModeEnabled');
    const isDark=savedTheme==='true';
    
    if(isDark){
      document.documentElement.setAttribute('data-theme','dark');
      themeIcon.textContent='light_mode';
    }
    
    // クリックイベント
    themeToggle.addEventListener('click',()=>{
      const currentTheme=document.documentElement.getAttribute('data-theme');
      const newTheme=currentTheme==='dark'?'light':'dark';
      
      document.documentElement.setAttribute('data-theme',newTheme);
      
      if(newTheme==='dark'){
        themeIcon.textContent='light_mode';
        localStorage.setItem('darkModeEnabled','true');
      }else{
        themeIcon.textContent='dark_mode';
        localStorage.setItem('darkModeEnabled','false');
      }
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

// ダークモード初期化
function initDarkMode(){
  const savedTheme=localStorage.getItem('darkModeEnabled');
  if(savedTheme==='true'){
    document.documentElement.setAttribute('data-theme','dark');
  }
}

// ========================================
// ユーティリティ関数
// ========================================

// 現在のユーザー情報を取得
export function getCurrentUser(){
  return currentUser;
}

export function getCurrentProfile(){
  return currentProfile;
}

// Supabaseクライアントをエクスポート
export{supabase};