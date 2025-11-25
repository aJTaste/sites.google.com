import{initPage}from'../common/core.js';

// ページ初期化
const userData=await initPage('profile','プロフィール',{
  onUserLoaded:(data)=>{
    // プロフィール情報を表示
    document.getElementById('profile-username').textContent=data.username;
    document.getElementById('profile-account-id').textContent=data.accountId;
    document.getElementById('profile-created').textContent='登録日: '+new Date(data.createdAt).toLocaleDateString('ja-JP');
    
    // アイコン表示
    const profileIcon=document.getElementById('profile-icon');
    if(data.iconUrl&&data.iconUrl!=='default'){
      profileIcon.src=data.iconUrl;
    }
  }
});

// プロフィール編集（設定画面へ）
document.getElementById('edit-profile-btn').addEventListener('click',()=>{
  window.location.href='settings.html';
});