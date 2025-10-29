import{auth,database}from'../common/firebase-config.js';
import{createUserWithEmailAndPassword}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import{ref,set,get}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// DOM要素取得
const form=document.getElementById('register-form');
const accountIdInput=document.getElementById('account-id');
const passwordInput=document.getElementById('password');
const passwordConfirmInput=document.getElementById('password-confirm');
const usernameInput=document.getElementById('username');
const iconFileInput=document.getElementById('icon-file');
const iconPreview=document.getElementById('icon-preview');
const uploadBtn=document.getElementById('upload-btn');
const defaultBtn=document.getElementById('default-btn');

let iconBase64='';

uploadBtn.addEventListener('click',()=>{
  iconFileInput.click();
});

defaultBtn.addEventListener('click',()=>{
  iconPreview.src='assets/school.png';
  iconBase64='';
});

iconFileInput.addEventListener('change',(e)=>{
  const file=e.target.files[0];
  if(!file)return;
  
  if(file.size>500*1024){
    document.getElementById('icon-error').textContent='画像サイズは500KB以下にしてください';
    return;
  }
  
  document.getElementById('icon-error').textContent='';
  
  const reader=new FileReader();
  reader.onload=(e)=>{
    iconPreview.src=e.target.result;
    iconBase64=e.target.result;
  };
  reader.readAsDataURL(file);
});

accountIdInput.addEventListener('input',async()=>{
  const accountId=accountIdInput.value.trim();
  const idError=document.getElementById('id-error');
  const idHelp=document.getElementById('id-help');
  
  if(accountId.length<2){
    idError.textContent='';
    idHelp.textContent='';
    return;
  }
  
  const email=`${accountId}@ajtaste.jp`;
  const usersRef=ref(database,'users');
  const snapshot=await get(usersRef);
  
  if(snapshot.exists()){
    const users=snapshot.val();
    const exists=Object.values(users).some(user=>user.accountId===accountId);
    
    if(exists){
      idError.textContent='このIDはすでに使用されています';
      idHelp.textContent='';
    }else{
      idError.textContent='';
      idHelp.textContent='✓ 使用可能なIDです';
    }
  }else{
    idError.textContent='';
    idHelp.textContent='✓ 使用可能なIDです';
  }
});

form.addEventListener('submit',async(e)=>{
  e.preventDefault();
  
  const accountId=accountIdInput.value.trim();
  const password=passwordInput.value;
  const passwordConfirm=passwordConfirmInput.value;
  const username=usernameInput.value.trim();
  
  document.getElementById('id-error').textContent='';
  document.getElementById('password-error').textContent='';
  document.getElementById('icon-error').textContent='';
  
  if(accountId.length<2||accountId.length>20){
    document.getElementById('id-error').textContent='アカウントIDは2-20文字で入力してください';
    return;
  }
  
  if(password.length<8||password.length>20){
    document.getElementById('password-error').textContent='パスワードは8-20文字で入力してください';
    return;
  }
  
  if(password!==passwordConfirm){
    document.getElementById('password-error').textContent='パスワードが一致しません';
    return;
  }
  
  if(username.length<1||username.length>100){
    alert('ユーザー名は1-100文字で入力してください');
    return;
  }
  
  try{
    const email=`${accountId}@ajtaste.jp`;
    
    const userCredential=await createUserWithEmailAndPassword(auth,email,password);
    const user=userCredential.user;
    
    // 権限システム追加：新規ユーザーはデフォルトで 'user' 権限
    await set(ref(database,`users/${user.uid}`),{
      accountId:accountId,
      username:username,
      iconUrl:iconBase64||'default',
      role:'user',
      createdAt:Date.now(),
      lastOnline:Date.now(),
      online:false
    });
    
    alert('登録完了！');
    window.location.href='index.html';
  }catch(error){
    console.error(error);
    if(error.code==='auth/email-already-in-use'){
      document.getElementById('id-error').textContent='このIDはすでに使用されています';
    }else{
      alert('登録に失敗しました: '+error.message);
    }
  }
});