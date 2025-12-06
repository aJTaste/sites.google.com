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
    {id:'index',icon:'home',title:'ホーム',href:'index.html'},
    {id:'chat',icon:'chat',title:'チャット',href:'chat.html'},
    {id:'proxy',icon:'vpn_key',title:'プロキシ',href:'proxy.html'},
    {id:'capture',icon:'screenshot_monitor',title:'スクショ',href:'capture.html'},
    {id:'piano',icon:'piano',title:'ピアノ',href:'piano.html'},
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






// ========================================
// スクリーンショット・録画システム
// ========================================

// IndexedDB設定
const DB_NAME='apphub_captures';
const DB_VERSION=1;
let db=null;

// 録画状態
let mediaRecorder=null;
let recordedChunks=[];
let isRecording=false;

// ========================================
// IndexedDB初期化
// ========================================

async function initDB(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
      db=request.result;
      resolve(db);
    };
    
    request.onupgradeneeded=(e)=>{
      const db=e.target.result;
      
      // スクリーンショット用
      if(!db.objectStoreNames.contains('screenshots')){
        const store=db.createObjectStore('screenshots',{keyPath:'id',autoIncrement:true});
        store.createIndex('timestamp','timestamp',{unique:false});
      }
      
      // 録画用
      if(!db.objectStoreNames.contains('recordings')){
        const store=db.createObjectStore('recordings',{keyPath:'id',autoIncrement:true});
        store.createIndex('timestamp','timestamp',{unique:false});
      }
    };
  });
}

// ========================================
// スクリーンショット撮影
// ========================================

async function takeScreenshot(){
  try{
    // 画面選択
    const stream=await navigator.mediaDevices.getDisplayMedia({
      video:{mediaSource:'screen'}
    });
    
    // ビデオトラックから1フレーム取得
    const track=stream.getVideoTracks()[0];
    const imageCapture=new ImageCapture(track);
    const bitmap=await imageCapture.grabFrame();
    
    // Canvasに描画
    const canvas=document.createElement('canvas');
    canvas.width=bitmap.width;
    canvas.height=bitmap.height;
    const ctx=canvas.getContext('2d');
    ctx.drawImage(bitmap,0,0);
    
    // 停止
    stream.getTracks().forEach(track=>track.stop());
    
    // Blobに変換
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    
    // IndexedDBに保存
    await saveScreenshot(blob);
    
    // 通知
    showNotification('📸 スクリーンショットを保存しました');
    
    return blob;
  }catch(error){
    console.error('スクリーンショットエラー:',error);
    if(error.name!=='NotAllowedError'){
      showNotification('❌ スクリーンショットに失敗しました','error');
    }
  }
}

// スクリーンショットをDBに保存
async function saveScreenshot(blob){
  const transaction=db.transaction(['screenshots'],'readwrite');
  const store=transaction.objectStore('screenshots');
  
  const data={
    blob:blob,
    timestamp:Date.now(),
    type:'screenshot'
  };
  
  await store.add(data);
}

// ========================================
// 録画機能
// ========================================

async function startRecording(){
  try{
    // 画面選択
    const stream=await navigator.mediaDevices.getDisplayMedia({
      video:{mediaSource:'screen'},
      audio:true // 音声も録画
    });
    
    recordedChunks=[];
    
    // MediaRecorder設定
    mediaRecorder=new MediaRecorder(stream,{
      mimeType:'video/webm;codecs=vp9'
    });
    
    mediaRecorder.ondataavailable=(e)=>{
      if(e.data.size>0){
        recordedChunks.push(e.data);
      }
    };
    
    mediaRecorder.onstop=async()=>{
      const blob=new Blob(recordedChunks,{type:'video/webm'});
      await saveRecording(blob);
      showNotification('🎥 録画を保存しました');
      
      // ストリーム停止
      stream.getTracks().forEach(track=>track.stop());
    };
    
    mediaRecorder.start();
    isRecording=true;
    
    showNotification('🔴 録画を開始しました');
    
    // 録画停止ボタンを表示
    showRecordingIndicator();
    
  }catch(error){
    console.error('録画エラー:',error);
    if(error.name!=='NotAllowedError'){
      showNotification('❌ 録画に失敗しました','error');
    }
  }
}

function stopRecording(){
  if(mediaRecorder&&isRecording){
    mediaRecorder.stop();
    isRecording=false;
    hideRecordingIndicator();
  }
}

// 録画をDBに保存
async function saveRecording(blob){
  const transaction=db.transaction(['recordings'],'readwrite');
  const store=transaction.objectStore('recordings');
  
  const data={
    blob:blob,
    timestamp:Date.now(),
    type:'recording'
  };
  
  await store.add(data);
}

// ========================================
// 録画インジケーター
// ========================================

function showRecordingIndicator(){
  const indicator=document.createElement('div');
  indicator.id='recording-indicator';
  indicator.innerHTML=`
    <div style="position:fixed;top:20px;right:20px;background:#ff0000;color:#fff;padding:12px 20px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);z-index:10000;display:flex;align-items:center;gap:12px;font-family:sans-serif;font-size:14px;font-weight:600;">
      <div style="width:12px;height:12px;background:#fff;border-radius:50%;animation:pulse 1s infinite;"></div>
      録画中
      <button onclick="window.stopRecording()" style="background:#fff;color:#ff0000;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-weight:600;margin-left:8px;">停止</button>
    </div>
    <style>
      @keyframes pulse{
        0%,100%{opacity:1;}
        50%{opacity:0.3;}
      }
    </style>
  `;
  document.body.appendChild(indicator);
}

function hideRecordingIndicator(){
  const indicator=document.getElementById('recording-indicator');
  if(indicator){
    indicator.remove();
  }
}

// ========================================
// 通知表示
// ========================================

function showNotification(message,type='success'){
  const notification=document.createElement('div');
  const bgColor=type==='error'?'#ff4444':'#00a77a';
  
  notification.innerHTML=`
    <div style="position:fixed;top:20px;right:20px;background:${bgColor};color:#fff;padding:12px 20px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);z-index:10000;font-family:sans-serif;font-size:14px;animation:slideIn 0.3s;">
      ${message}
    </div>
    <style>
      @keyframes slideIn{
        from{transform:translateX(100%);}
        to{transform:translateX(0);}
      }
    </style>
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(()=>{
    notification.style.opacity='0';
    notification.style.transition='opacity 0.3s';
    setTimeout(()=>notification.remove(),300);
  },3000);
}

// ========================================
// ショートカットキー監視
// ========================================

document.addEventListener('keydown',(e)=>{
  // Meta + S: スクリーンショット
  if(e.ctrlKey&&e.altKey&&e.key==='s'){
    e.preventDefault();
    takeScreenshot();
  }
  
  // Meta + R: 録画開始/停止
  if(e.ctrlKey&&e.altKey&&e.key==='r'){
    e.preventDefault();
    if(isRecording){
      stopRecording();
    }else{
      startRecording();
    }
  }
});

// ========================================
// グローバルに公開
// ========================================

window.takeScreenshot=takeScreenshot;
window.startRecording=startRecording;
window.stopRecording=stopRecording;

// ========================================
// 初期化
// ========================================

initDB().then(()=>{
  console.log('📸 スクリーンショットシステム準備完了');
}).catch(err=>{
  console.error('IndexedDB初期化エラー:',err);
});