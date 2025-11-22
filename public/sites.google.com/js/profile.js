import{auth,database}from'../common/firebase-config.js';
import{onAuthStateChanged,signOut}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import{ref,get}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

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
  
  // プロフィール情報を表示
  document.getElementById('profile-username').textContent=currentUserData.username;
  document.getElementById('profile-account-id').textContent=currentUserData.accountId;
  document.getElementById('profile-created').textContent='登録日: '+new Date(currentUserData.createdAt).toLocaleDateString('ja-JP');
  
  // アイコン表示
  const profileIcon=document.getElementById('profile-icon');
  const userAvatar=document.getElementById('user-avatar');
  if(currentUserData.iconUrl&&currentUserData.iconUrl!=='default'){
    profileIcon.src=currentUserData.iconUrl;
    userAvatar.src=currentUserData.iconUrl;
  }
});

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

// 設定ページへ
document.getElementById('settings-btn').addEventListener('click',()=>{
  window.location.href='settings.html';
});

// プロフィール編集（設定画面へ）
document.getElementById('edit-profile-btn').addEventListener('click',()=>{
  window.location.href='settings.html';
});

// ログアウト
document.getElementById('logout-btn').addEventListener('click',async()=>{
  try{
    await signOut(auth);
    window.location.href='login.html';
  }catch(error){
    console.error(error);
    alert('ログアウトに失敗しました');
  }
});