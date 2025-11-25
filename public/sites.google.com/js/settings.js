import{initPage}from'../common/core.js';
import{database}from'../common/core.js';
import{ref,update}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

let currentAccountId=null;
let currentIconBase64='';

// ページ初期化
const userData=await initPage('settings','設定',{
  onUserLoaded:(data)=>{
    currentAccountId=data.accountId;
    
    // 情報を表示
    document.getElementById('account-id-display').textContent=data.accountId;
    document.getElementById('created-date').textContent=new Date(data.createdAt).toLocaleDateString('ja-JP');
    document.getElementById('username-input').value=data.username;
    
    // アイコン表示
    const iconPreview=document.getElementById('icon-preview');
    if(data.iconUrl&&data.iconUrl!=='default'){
      iconPreview.src=data.iconUrl;
      currentIconBase64=data.iconUrl;
    }
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