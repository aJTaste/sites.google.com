import{auth,database}from'../common/firebase-config.js';
import{onAuthStateChanged,signOut}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import{ref,get,update}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

let currentAccountId=null;
let currentIconBase64='';

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
  let userData=null;
  
  // UIDからアカウントIDを検索
  for(const accountId in users){
    if(users[accountId].uid===user.uid){
      currentAccountId=accountId;
      userData=users[accountId];
      break;
    }
  }
  
  if(!currentAccountId||!userData){
    alert('アカウント情報が見つかりません');
    await signOut(auth);
    window.location.href='login.html';
    return;
  }
  
  // 情報を表示
  document.getElementById('account-id-display').textContent=userData.accountId;
  document.getElementById('created-date').textContent=new Date(userData.createdAt).toLocaleDateString('ja-JP');
  document.getElementById('username-input').value=userData.username;
  
  // アイコン表示
  const iconPreview=document.getElementById('icon-preview');
  const userAvatar=document.getElementById('user-avatar');
  if(userData.iconUrl&&userData.iconUrl!=='default'){
    iconPreview.src=userData.iconUrl;
    userAvatar.src=userData.iconUrl;
    currentIconBase64=userData.iconUrl;
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

// プロフィールページへ
document.getElementById('profile-btn').addEventListener('click',()=>{
  window.location.href='profile.html';
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

// ユーザー名保存
document.getElementById('username-save-btn').addEventListener('click',async()=>{
  const usernameInput=document.getElementById('username-input');
  const username=usernameInput.value.trim();
  const usernameError=document.getElementById('username-error');
  const usernameSuccess=document.getElementById('username-success');
  
  usernameError.textContent='';
  usernameSuccess.textContent='';
  
  if(username.length<1||username.length>100){
    usernameError.textContent='ユーザー名は1-100文字で入力してください';
    return;
  }
  
  try{
    await update(ref(database,`users/${currentAccountId}`),{
      username:username
    });
    usernameSuccess.textContent='✓ 保存しました';
  }catch(error){
    console.error(error);
    usernameError.textContent='保存に失敗しました';
  }
});

// アイコン画像選択
document.getElementById('upload-icon-btn').addEventListener('click',()=>{
  document.getElementById('icon-file').click();
});

document.getElementById('icon-file').addEventListener('change',(e)=>{
  const file=e.target.files[0];
  if(!file)return;
  
  const iconError=document.getElementById('icon-error');
  iconError.textContent='';
  
  if(file.size>500*1024){
    iconError.textContent='画像サイズは500KB以下にしてください';
    return;
  }
  
  const reader=new FileReader();
  reader.onload=(e)=>{
    document.getElementById('icon-preview').src=e.target.result;
    currentIconBase64=e.target.result;
  };
  reader.readAsDataURL(file);
});

// デフォルトアイコン
document.getElementById('default-icon-btn').addEventListener('click',()=>{
  document.getElementById('icon-preview').src='assets/github-mark.svg';
  currentIconBase64='default';
});

// アイコン保存
document.getElementById('icon-save-btn').addEventListener('click',async()=>{
  const iconError=document.getElementById('icon-error');
  const iconSuccess=document.getElementById('icon-success');
  
  iconError.textContent='';
  iconSuccess.textContent='';
  
  try{
    await update(ref(database,`users/${currentAccountId}`),{
      iconUrl:currentIconBase64||'default'
    });
    
    // ヘッダーのアイコンも更新
    const userAvatar=document.getElementById('user-avatar');
    if(currentIconBase64&&currentIconBase64!=='default'){
      userAvatar.src=currentIconBase64;
    }else{
      userAvatar.src='assets/github-mark.svg';
    }
    
    iconSuccess.textContent='✓ 保存しました';
  }catch(error){
    console.error(error);
    iconError.textContent='保存に失敗しました';
  }
});