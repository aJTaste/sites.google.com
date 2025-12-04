import{auth,database}from'../common/firebase-config.js';
import{createUserWithEmailAndPassword}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import{ref,set,get}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

console.log('register.js読み込み開始');

// DOM要素取得
const form=document.getElementById('register-form');
const fullnameInput=document.getElementById('fullname');
const gmailUserInput=document.getElementById('gmail-user');
const accountIdInput=document.getElementById('account-id');
const passwordInput=document.getElementById('password');
const passwordConfirmInput=document.getElementById('password-confirm');
const usernameInput=document.getElementById('username');
const iconFileInput=document.getElementById('icon-file');
const iconPreview=document.getElementById('icon-preview');
const uploadBtn=document.getElementById('upload-btn');
const defaultBtn=document.getElementById('default-btn');

console.log('DOM要素取得完了');

let iconBase64='';

uploadBtn.addEventListener('click',()=>{
  console.log('アップロードボタンクリック');
  iconFileInput.click();
});

defaultBtn.addEventListener('click',()=>{
  console.log('デフォルトボタンクリック');
  iconPreview.src='assets/github-mark.svg';
  iconBase64='';
});

iconFileInput.addEventListener('change',(e)=>{
  console.log('ファイル選択');
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
    console.log('画像読み込み完了');
  };
  reader.readAsDataURL(file);
});

// アカウントID重複チェック
accountIdInput.addEventListener('input',async()=>{
  const accountId=accountIdInput.value.trim();
  const idError=document.getElementById('id-error');
  const idHelp=document.getElementById('id-help');
  
  if(accountId.length<2){
    idError.textContent='';
    idHelp.textContent='';
    return;
  }
  
  // 半角英数字チェック
  if(!/^[a-zA-Z0-9]+$/.test(accountId)){
    idError.textContent='半角英数字のみ使用できます';
    idHelp.textContent='';
    return;
  }
  
  try{
    // 重複チェック
    const accountRef=ref(database,`users/${accountId}`);
    const snapshot=await get(accountRef);
    
    if(snapshot.exists()){
      idError.textContent='このIDはすでに使用されています';
      idHelp.textContent='';
    }else{
      idError.textContent='';
      idHelp.textContent='✓ 使用可能なIDです';
    }
  }catch(error){
    console.error('重複チェックエラー:',error);
    idError.textContent='チェック中にエラーが発生しました';
  }
});

form.addEventListener('submit',async(e)=>{
  e.preventDefault();
  console.log('登録フォーム送信開始');
  
  const fullname=fullnameInput.value.trim();
  const gmailUser=gmailUserInput.value.trim();
  const accountId=accountIdInput.value.trim();
  const password=passwordInput.value;
  const passwordConfirm=passwordConfirmInput.value;
  const username=usernameInput.value.trim();
  
  console.log('入力値:',{fullname,gmailUser,accountId,username});
  
  document.getElementById('id-error').textContent='';
  document.getElementById('password-error').textContent='';
  document.getElementById('icon-error').textContent='';
  
  // バリデーション
  if(!fullname){
    alert('氏名を入力してください');
    return;
  }
  
  if(!gmailUser){
    alert('教育委員会Gmailを入力してください');
    return;
  }
  
  if(accountId.length<2||accountId.length>20){
    document.getElementById('id-error').textContent='アカウントIDは2-20文字で入力してください';
    return;
  }
  
  if(!/^[a-zA-Z0-9]+$/.test(accountId)){
    document.getElementById('id-error').textContent='半角英数字のみ使用できます';
    return;
  }
  
  if(password.length<8||password.length>20){
    document.getElementById('password-error').textContent='パスワードは8-20文字で入力してください';
    return;
  }
  
  if(!/^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+$/.test(password)){
    document.getElementById('password-error').textContent='半角英数字記号のみ使用できます';
    return;
  }
  
  if(password!==passwordConfirm){
    document.getElementById('password-error').textContent='パスワードが一致しません';
    return;
  }
  
  if(!username){
    alert('表示名を入力してください');
    return;
  }
  
  console.log('バリデーション通過');
  
  // 重複チェック（最終確認）
  try{
    const accountRef=ref(database,`users/${accountId}`);
    const snapshot=await get(accountRef);
    if(snapshot.exists()){
      document.getElementById('id-error').textContent='このIDはすでに使用されています';
      return;
    }
    
    console.log('重複チェック通過');
  }catch(error){
    console.error('重複チェックエラー:',error);
    alert('重複チェック中にエラーが発生しました');
    return;
  }
  
  try{
    const email=`${accountId}@ajtaste.jp`;
    console.log('Firebase認証開始:',email);
    
    // Firebase Authentication でユーザー作成
    const userCredential=await createUserWithEmailAndPassword(auth,email,password);
    const user=userCredential.user;
    
    console.log('Firebase認証成功:',user.uid);
    console.log('データベース保存開始');
    
    // Realtime Database にアカウントIDをキーとして保存
    await set(ref(database,`users/${accountId}`),{
      uid:user.uid,
      accountId:accountId,
      fullname:fullname,
      gmailUser:gmailUser,
      username:username,
      iconUrl:iconBase64||'default',
      role:'user',
      createdAt:Date.now(),
      lastOnline:Date.now(),
      online:false
    });
    
    console.log('データベース保存成功');
    alert('登録完了！');
    window.location.href='index.html';
  }catch(error){
    console.error('登録エラー:',error);
    console.error('エラーコード:',error.code);
    console.error('エラーメッセージ:',error.message);
    
    if(error.code==='auth/email-already-in-use'){
      document.getElementById('id-error').textContent='このIDはすでに使用されています';
    }else{
      alert('登録に失敗しました: '+error.message);
    }
  }
});

console.log('register.js読み込み完了');

// ローディング完了
document.body.classList.remove('page-loading');
document.body.classList.add('page-loaded');