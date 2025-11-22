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
  
  // Firebase AuthのUIDからアカウントIDを取得
  const usersRef=ref(database,'users');
  const usersSnapshot=await get(usersRef);
  
  if(!usersSnapshot.exists()){
    alert('ユーザーデータが見つかりません');
    await signOut(auth);
    window.location.href='login.html';
    return;
  }
  
  const users=usersSnapshot.val();
  let currentAccountId=null;
  let currentUserData=null;
  
  // UIDからアカウントIDを検索
  for(const accountId in users){
    if(users[accountId].uid===user.uid){
      currentAccountId=accountId;
      currentUserData=users[accountId];
      break;
    }
  }
  
  if(!currentAccountId||!currentUserData){
    alert('アカウント情報が見つかりません');
    await signOut(auth);
    window.location.href='login.html';
    return;
  }
  
  const userAvatar=document.getElementById('user-avatar');
  if(currentUserData.iconUrl&&currentUserData.iconUrl!=='default'){
    userAvatar.src=currentUserData.iconUrl;
  }
  
  // 管理者パネルへのアクセス権限がある場合、リンクを表示
  if(checkPermission(currentUserData.role,'view_admin_panel')){
    addAdminPanelLink();
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