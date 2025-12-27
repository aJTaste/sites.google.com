// ========================================
// AppHub Core - Supabase版
// ========================================

import{supabase}from'./supabase-config.js';
import{checkPermission}from'./permissions.js';

export{supabase};

// ========================================
// UI生成関数
// ========================================

export function createHeader(pageTitle){
  return`
    <header class="top-header">
      <div class="header-left">
        <img src="assets/favicon1.svg" alt="AppHub" class="logo-icon">
        <a href="index.html" style="text-decoration:none;color:inherit;">
          <h1 class="logo-text" style="cursor:pointer;">AppHub</h1>
        </a>
        <span class="header-divider">|</span>
        <span class="page-title">${pageTitle}</span>
      </div>
      <div class="header-right">
        <button class="icon-btn" id="notification-btn" title="通知">
          <span class="material-symbols-outlined">notifications</span>
        </button>
        <div class="user-menu">
          <button class="user-btn" id="user-btn">
            <div id="user-avatar" style="width:36px;height:36px;border-radius:50%;background:#FF6B35;"></div>
          </button>
          <div class="user-dropdown" id="user-dropdown">
            <div class="dropdown-item" id="profile-btn">
              <span class="material-symbols-outlined">person</span>
              <span>プロフィール</span>
            </div>
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

export function createSidebar(activePage,userRole){
  const navItems=[
    {id:'index',icon:'home',title:'Home',href:'index.html'},
    {id:'chat',icon:'chat',title:'ChatHub',href:'chat.html'},
    {id:'links',icon:'link',title:'Links',href:'links.html'},
    {id:'files',icon:'folder',title:'Files',href:'files.html'},
    {id:'proxy',icon:'vpn_key',title:'Proxy',href:'proxy.html'},
    {id:'images',icon:'animated_images',title:'Images',href:'images.html'},
    {id:'piano',icon:'piano',title:'Piano',href:'piano.html'},
    {id:'db',icon:'database',title:'Database',href:'db.html'}
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
  
  if(requireAuth){
    return new Promise((resolve)=>{
      supabase.auth.onAuthStateChange(async(event,session)=>{
        if(!session){
          if(redirectIfNotAuth){
            window.location.href='login.html';
          }
          resolve(null);
          return;
        }
        
        // ユーザーデータ取得
        const userData=await getUserData(session.user.id);
        if(!userData){
          alert('アカウント情報が見つかりません');
          await supabase.auth.signOut();
          window.location.href='login.html';
          resolve(null);
          return;
        }
        
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
            mainContainer.insertAdjacentHTML('afterbegin',createSidebar(pageId,userData.role));
          }
        }
        
        // イベントリスナー設定
        setupHeaderEvents();
        
        // アバター表示
        updateAvatar(userData);
        
        // db.htmlへのアクセス制御（モデレーター以上のみ）
        if(pageId==='db'){
          if(!checkPermission(userData.role,'view_admin_panel')){
            alert('このページへのアクセス権限がありません');
            window.location.href='index.html';
            resolve(null);
            return;
          }
        }
        
        // オンライン状態を更新
        await supabase
          .from('profiles')
          .update({
            is_online:true,
            last_online:new Date().toISOString()
          })
          .eq('id',session.user.id);
        
        // ページ離脱時にオフライン状態に
        window.addEventListener('beforeunload',async()=>{
          await supabase
            .from('profiles')
            .update({
              is_online:false,
              last_online:new Date().toISOString()
            })
            .eq('id',session.user.id);
        });
        
        // コールバック実行
        if(onUserLoaded){
          await onUserLoaded(userData);
        }
        
        showPage();
        resolve(userData);
      });
    });
  }
  
  return Promise.resolve(null);
}

// ページを表示
function showPage(){
  document.body.classList.remove('page-loading');
  document.body.classList.add('page-loaded');
}

// ユーザーデータ取得
async function getUserData(userId){
  try{
    const{data,error}=await supabase
      .from('profiles')
      .select('*')
      .eq('id',userId)
      .single();
    
    if(error)throw error;
    return data;
  }catch(error){
    console.error('ユーザーデータ取得エラー:',error);
    return null;
  }
}

// アバター表示更新
function updateAvatar(userData){
  const userAvatar=document.getElementById('user-avatar');
  if(!userAvatar)return;
  
  if(userData.avatar_color&&userData.avatar_color.startsWith('http')){
    // 画像URL
    userAvatar.innerHTML=`<img src="${userData.avatar_color}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  }else{
    // カラー
    userAvatar.style.background=userData.avatar_color||'#FF6B35';
  }
}

// ヘッダーイベント設定
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
      window.location.href='profile.html';
    });
  }
  
  const settingsBtn=document.getElementById('settings-btn');
  if(settingsBtn){
    settingsBtn.addEventListener('click',()=>{
      window.location.href='settings.html';
    });
  }
  
  const logoutBtn=document.getElementById('logout-btn');
  if(logoutBtn){
    logoutBtn.addEventListener('click',async()=>{
      try{
        await supabase.auth.signOut();
        window.location.href='login.html';
      }catch(error){
        console.error(error);
        alert('ログアウトに失敗しました');
      }
    });
  }
}

export{getUserData,setupHeaderEvents,updateAvatar};
