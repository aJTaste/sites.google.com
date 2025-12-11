// ========================================
// AppHub Core - すべてのページで使う共通処理
// ========================================

// Firebase設定
import{initializeApp}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import{getAuth,onAuthStateChanged,signOut}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import{getDatabase,ref,get}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import{checkPermission}from'./permissions.js';

const firebaseConfig={
  apiKey:"AIzaSyDM_jJDGjN0mlV6FqBVzZTL5Qx95yaHruc",
  authDomain:"apphub-ajtaste.firebaseapp.com",
  databaseURL:"https://apphub-ajtaste-default-rtdb.firebaseio.com/",
  projectId:"apphub-ajtaste",
  storageBucket:"apphub-ajtaste.firebasestorage.app",
  messagingSenderId:"135285241813",
  appId:"1:135285241813:web:513e2aaa8f8dcd04556f5c"
};

const app=initializeApp(firebaseConfig);
export const auth=getAuth(app);
export const database=getDatabase(app);

// ========================================
// UI生成関数
// ========================================

// ヘッダー生成
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
            <img id="user-avatar" src="assets/github-mark.svg" alt="ユーザーアイコン">
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

// サイドバー生成（管理者パネルを常時表示）
export function createSidebar(activePage,userRole){
  const navItems=[
    {id:'index',icon:'home',title:'Home',href:'index.html'},
    {id:'chat',icon:'chat',title:'ChatHub',href:'chat.html'},
    {id:'proxy',icon:'vpn_key',title:'Proxy',href:'proxy.html'},
    {id:'images',icon:'animated_images',title:'Images',href:'images.html'},
    {id:'piano',icon:'piano',title:'Piano',href:'piano.html'},
    {id:'admin',icon:'admin_panel_settings',title:'管理者パネル',href:'admin.html'}
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
  
  // 認証チェック
  if(requireAuth){
    return new Promise((resolve)=>{
      onAuthStateChanged(auth,async(user)=>{
        if(!user){
          if(redirectIfNotAuth){
            window.location.href='login.html';
          }
          resolve(null);
          return;
        }
        
        // ユーザーデータ取得
        const userData=await getUserData(user.uid);
        if(!userData){
          alert('アカウント情報が見つかりません');
          await signOut(auth);
          window.location.href='login.html';
          resolve(null);
          return;
        }
        
        // UI生成（ユーザーデータ取得後）
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
        
        // アイコン表示
        const userAvatar=document.getElementById('user-avatar');
        if(userAvatar&&userData.iconUrl&&userData.iconUrl!=='default'){
          userAvatar.src=userData.iconUrl;
        }
        
        // 管理者パネルへのアクセス制御（モデレーター以上のみアクセス可能）
        if(pageId==='admin'){
          if(!checkPermission(userData.role,'view_admin_panel')){
            alert('このページへのアクセス権限がありません');
            window.location.href='index.html';
            resolve(null);
            return;
          }
        }
        
        // コールバック実行
        if(onUserLoaded){
          await onUserLoaded(userData);
        }
        
        // ✨ ローディング完了 - ページを表示
        showPage();
        
        resolve(userData);
      });
    });
  }
  
  return Promise.resolve(null);
}

// ========================================
// ローディング制御
// ========================================

// ページを表示（フェードイン）
function showPage(){
  // body の .page-loading クラスを削除
  document.body.classList.remove('page-loading');
  document.body.classList.add('page-loaded');
}

// ========================================
// ユーティリティ関数
// ========================================

// ユーザーデータ取得
async function getUserData(uid){
  const usersRef=ref(database,'users');
  const snapshot=await get(usersRef);
  
  if(!snapshot.exists())return null;
  
  const users=snapshot.val();
  for(const accountId in users){
    if(users[accountId].uid===uid){
      return{
        accountId:accountId,
        ...users[accountId]
      };
    }
  }
  
  return null;
}

// ヘッダーイベント設定
function setupHeaderEvents(){
  // ユーザーメニュー
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
  
  // プロフィール
  const profileBtn=document.getElementById('profile-btn');
  if(profileBtn){
    profileBtn.addEventListener('click',()=>{
      window.location.href='profile.html';
    });
  }
  
  // 設定
  const settingsBtn=document.getElementById('settings-btn');
  if(settingsBtn){
    settingsBtn.addEventListener('click',()=>{
      window.location.href='settings.html';
    });
  }
  
  // ログアウト
  const logoutBtn=document.getElementById('logout-btn');
  if(logoutBtn){
    logoutBtn.addEventListener('click',async()=>{
      try{
        await signOut(auth);
        window.location.href='login.html';
      }catch(error){
        console.error(error);
        alert('ログアウトに失敗しました');
      }
    });
  }
}

// ========================================
// エクスポート
// ========================================

export{getUserData,setupHeaderEvents};