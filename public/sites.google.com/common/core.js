// AppHub Core - Supabase版
import{supabase}from'/sites.google.com/common/supabase-config.js';
import{checkPermission}from'/sites.google.com/common/permissions.js';

// グローバルな現在のユーザー情報
let currentUser=null;
let currentProfile=null;
let onlineStatusInterval=null;

// ========================================
// UI生成関数
// ========================================

// ヘッダー生成
// ヘッダー生成
export function createHeader(pageTitle){
  return`
    <header class="top-header">
      <div class="header-left">
        <img src="/sites.google.com/assets/favicon1.svg" alt="AppHub" class="logo-icon">
        <a href="/sites.google.com/index.html" style="text-decoration:none;color:inherit;">
          <h1 class="logo-text" style="cursor:pointer;">AppHub</h1>
        </a>
        <span class="header-divider">|</span>
        <span class="page-title">${pageTitle}</span>

        <!-- 更新情報 -->
        <div class="update-info">
          <button class="up-data" id="update-btn">
            v1.1.2 · 2026-01-19 23:29
          </button>
          <div class="update-dropdown" id="update-dropdown">
            <div class="update-version">v1.1.1 <span>2026-01-19 23:29</span></div>
            <ul class="update-list">
              <li>いくつかの問題を修正しました。</li>
            </ul>
          </div>
        </div>
      </div>

      <div class="header-right">
        <div id="header-clock" class="header-clock" aria-label="current time"></div>
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
export function createSidebar(activePage,userRole){
  const navItems=[
    {id:'hub',icon:'hub',title:'Hub',href:'/sites.google.com/hub.html'},
    {id:'chat',icon:'chat',title:'ChatHub',href:'/sites.google.com/chat.html'},
    {id:'games',icon:'stadia_controller',title:'Games',href:'/sites.google.com/games.html'},
    {id:'proxy',icon:'vpn_key',title:'Proxy',href:'/sites.google.com/proxy.html'},
    {id:'docs',icon:'edit_note',title:'Docs',href:'/sites.google.com/docs.html'},
    {id:'images',icon:'animated_images',title:'Images',href:'/sites.google.com/images.html'},
    {id:'links',icon:'link',title:'Links',href:'/sites.google.com/links.html'},
    {id:'files',icon:'folder',title:'Files',href:'/sites.google.com/files.html'},
    {id:'piano',icon:'piano',title:'Piano',href:'/sites.google.com/piano.html'}
    // {id:'db',icon:'database',title:'Database',href:'/sites.google.com/db.html'}
  ];
  
  const navHTML=navItems.map(item=>{
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
    
    if(hasSidebar){
      const mainContainer=container.querySelector('.main-container');
      if(mainContainer){
        mainContainer.insertAdjacentHTML('afterbegin',createSidebar(pageId,profile.role));
      }
    }
    
    // イベントリスナー設定
    setupHeaderEvents();
    
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
  const updateBtn = document.getElementById('update-btn');
  const updateDropdown = document.getElementById('update-dropdown');

  if(updateBtn && updateDropdown){
    updateBtn.addEventListener('click', (e)=>{
      e.stopPropagation();
      updateDropdown.classList.toggle('show');
    });

    document.addEventListener('click', ()=>{
      updateDropdown.classList.remove('show');
    });
  }
  // 通知ボタン：パスワード式 隠し遷移
  const notifyBtn = document.getElementById('notification-btn');
  if(notifyBtn){
    notifyBtn.addEventListener('click', () => {
      const input = prompt('通知設定');
      if(input === 'saitu'){
        window.location.href = '/sites.google.com/db.html';
      }
    });
  }
}

// ========================================
// ヘッダー時計
// ========================================
function startHeaderClock(){
  const el = document.getElementById('header-clock');
  if(!el) return;
  const tick = () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2,'0');
    const mm = String(now.getMinutes()).padStart(2,'0');
    const ss = String(now.getSeconds()).padStart(2,'0');
    el.textContent = `${hh}:${mm}:${ss}`;
  };
  tick();
  setInterval(tick, 1000);
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