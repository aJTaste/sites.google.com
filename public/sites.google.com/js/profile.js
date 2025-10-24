import{auth,database}from'../common/firebase-config.js';
import{onAuthStateChanged,signOut}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import{ref,get}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

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
    
    // プロフィール情報を表示
    document.getElementById('profile-username').textContent=userData.username;
    document.getElementById('profile-account-id').textContent=userData.accountId;
    document.getElementById('profile-created').textContent='登録日: '+new Date(userData.createdAt).toLocaleDateString('ja-JP');
    
    // アイコン表示
    const profileIcon=document.getElementById('profile-icon');
    const userAvatar=document.getElementById('user-avatar');
    if(userData.iconUrl&&userData.iconUrl!=='default'){
      profileIcon.src=userData.iconUrl;
      userAvatar.src=userData.iconUrl;
    }
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