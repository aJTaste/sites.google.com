import{auth,database}from'../common/firebase-config.js';
import{onAuthStateChanged,signOut}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import{ref,get}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import{checkPermission}from'../common/permissions.js';

// ログイン状態チェック
onAuthStateChanged(auth,async(user)=>{
  if(!user){
    window.location.href='login.html';
    return;
  }
  
  const userRef=ref(database,`users/${user.uid}`);
  const snapshot=await get(userRef);
  
  if(snapshot.exists()){
    const userData=snapshot.val();
    const userAvatar=document.getElementById('user-avatar');
    if(userData.iconUrl&&userData.iconUrl!=='default'){
      userAvatar.src=userData.iconUrl;
    }
    
    // 管理者パネルへのアクセス権限がある場合、リンクを表示
    if(checkPermission(userData.role,'view_admin_panel')){
      addAdminPanelLink();
    }
  }
});

// 管理者パネルリンクを追加
function addAdminPanelLink(){
  const sidebar=document.querySelector('.sidebar-nav');
  const adminLink=document.createElement('a');
  adminLink.href='admin.html';
  adminLink.className='nav-item';
  adminLink.title='管理者パネル';
  adminLink.innerHTML=`
    <span class="material-icons">admin_panel_settings</span>
  `;
  sidebar.appendChild(adminLink);
}

// ユーザーメニューの開閉
const userBtn=document.getElementById('user-btn');
const userDropdown=document.getElementById('user-dropdown');

userBtn.addEventListener('click',(e)=>{
  e.stopPropagation();
  userDropdown.classList.toggle('show');
});

document.addEventListener('click',()=>{
  userDropdown.classList.remove('show');
});

// プロフィールページへ
document.getElementById('profile-btn').addEventListener('click',()=>{
  window.location.href='profile.html';
});

// 設定ページへ
document.getElementById('settings-btn').addEventListener('click',()=>{
  window.location.href='settings.html';
});

// ログアウト
const logoutBtn=document.getElementById('logout-btn');

logoutBtn.addEventListener('click',async()=>{
  try{
    await signOut(auth);
    window.location.href='login.html';
  }catch(error){
    console.error(error);
    alert('ログアウトに失敗しました');
  }
});