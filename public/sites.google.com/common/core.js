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
        
        <a href="https://github.com/aJTaste/sites.google.com"
           target="_blank"
           id="gh-commit-badge"
           class="gh-commit-badge"
           title="GitHubコミット数">
          <svg class="gh-commit-badge-icon" viewBox="0 0 98 96" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"/></svg>
          <span id="gh-commit-count">…</span>
        </a>

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
            <div id="user-avatar" style="width:36px;height:36px;border-radius:50%;overflow:hidden;background:transparent;"></div>
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

// createSidebar関数の後に追加
function createBottomNav(pageId,role){
  const items=[
    {href:'hub.html',icon:'home',title:'ホーム',id:'hub'},
    {href:'chat.html',icon:'forum',title:'チャット',id:'chat'},
    {href:'gate.html',icon:'disabled_by_default',title:'Gate',id:'gate'},
    {href:'proxy.html',icon:'vpn_key',title:'Proxy',id:'proxy'},
  ];
  const navHTML=items.map(item=>{
    const activeClass=item.id===pageId?'active':'';
    return`<a href="${item.href}" class="bottom-nav-item ${activeClass}">
      <span class="material-symbols-outlined">${item.icon}</span>
      <span>${item.title}</span>
    </a>`;
  }).join('');
  return`<nav class="bottom-nav">${navHTML}</nav>`;
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
  
  if(!requireAuth){
    showPage();
    return null;
  }
  
  try{
    // セッション確認
    const{data:{session},error}=await supabase.auth.getSession();
    
    if(error)throw error;
    
    if(!session){
      if(redirectIfNotAuth){
        window.location.href='/sites.google.com/login.html';
      }
      return null;
    }
    
    currentUser=session.user;
    
    // プロフィール取得
    const{data:profile,error:profileError}=await supabase
      .from('profiles')
      .select('*')
      .eq('id',currentUser.id)
      .single();
    
    if(profileError){
      console.error('プロフィール取得エラー:',profileError);
      alert('アカウント情報の取得に失敗しました');
      await supabase.auth.signOut();
      window.location.href='/sites.google.com/login.html';
      return null;
    }
    
    currentProfile=profile;
    
    // オンライン状態を更新
    await updateOnlineStatus(true);
    
    // 定期的にオンライン状態を更新（30秒ごと）
    if(onlineStatusInterval){
      clearInterval(onlineStatusInterval);
    }
    onlineStatusInterval=setInterval(async()=>{
      await updateOnlineStatus(true);
    },30000);
    
    // オフライン時の処理
    const handleOffline=async()=>{
      await updateOnlineStatus(false);
      if(onlineStatusInterval){
        clearInterval(onlineStatusInterval);
      }
    };
    
    window.addEventListener('beforeunload',handleOffline);
    window.addEventListener('pagehide',handleOffline);
    document.addEventListener('visibilitychange',async()=>{
      if(document.hidden){
        await updateOnlineStatus(false);
      }else{
        await updateOnlineStatus(true);
      }
    });
    
    // UI生成
    const container=document.querySelector('.app-container')||document.body;
    const hasHeader=!container.querySelector('.top-header');
    const hasSidebar=!container.querySelector('.sidebar');
    
    if(hasHeader){
      container.insertAdjacentHTML('afterbegin',createHeader(pageTitle));
    }
    
    // hasSidebar ブロック内
    if(hasSidebar){
      const mainContainer=container.querySelector('.main-container');
      if(mainContainer){
        mainContainer.insertAdjacentHTML('afterbegin',createSidebar(pageId,profile.role));
      }
      // ボトムナビをapp-containerの末尾に追加
      container.insertAdjacentHTML('beforeend',createBottomNav(pageId,profile.role));
    }
    
    // イベントリスナー設定
    setupHeaderEvents();

    fetchGitHubCommits();

    // ダークモード初期化
    initDarkMode();
    
    // アバター表示
    updateAvatarDisplay();
    startHeaderClock();
    
    // db.htmlへのアクセス制御（モデレーター以上）
    if(pageId==='db'){
      if(!['moderator','admin'].includes(profile.role)){
        alert('このページへのアクセス権限がありません');
        window.location.href='/sites.google.com/hub.html';
        return null;
      }
    }
    
    // コールバック実行
    if(onUserLoaded){
      await onUserLoaded(profile);
    }
    
    // ページ表示
    showPage();
    
    return profile;
    
  }catch(error){
    console.error('初期化エラー:',error);
    if(redirectIfNotAuth){
      window.location.href='/sites.google.com/login.html';
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
  const url=currentProfile.avatar_url
  ||geoAvatarDataUrl(currentProfile.id,40);
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

async function fetchGitHubCommits(){
  try {
    // 1. 初回読み込み時にSupabaseから現在のコミット数を取得
    const { data, error } = await supabase
      .from('app_metadata') // コミット数を保存するテーブル（仮）
      .select('commit_count')
      .single();

    if (error) throw error;
    if (data) _applyCommitCount(data.commit_count);

    // 2. Supabase Realtimeで変更をリアルタイム監視（制限なし！）
    supabase
      .channel('commit-count-channel')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_metadata' },
        (payload) => {
          // DBの値が更新されたら、画面の数字も即座に書き換える
          _applyCommitCount(payload.new.commit_count);
        }
      )
      .subscribe();

  } catch(e) {
    document.getElementById('gh-commit-badge')?.style.setProperty('display','none');
    console.warn('[gh-commits]', e.message);
  }
}

function _applyCommitCount(count){
  const el=document.getElementById('gh-commit-count');
  if(el) el.textContent = count.toLocaleString('ja-JP');
}

function _applyCommitCount(count){
  const el=document.getElementById('gh-commit-count');
  if(el)el.textContent=count.toLocaleString('ja-JP');
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
