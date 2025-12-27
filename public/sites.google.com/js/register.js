import{supabase,generateRandomColor}from'../common/supabase-config.js';

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
const iconPreviewCanvas=document.getElementById('icon-preview');
const uploadBtn=document.getElementById('upload-btn');
const defaultBtn=document.getElementById('default-btn');

console.log('DOM要素取得完了');

let iconFile=null;
const defaultColor=generateRandomColor();

// デフォルトアイコン表示（ランダムカラー円）
function setDefaultIcon(){
  const ctx=iconPreviewCanvas.getContext('2d');
  ctx.clearRect(0,0,120,120);
  ctx.fillStyle=defaultColor;
  ctx.beginPath();
  ctx.arc(60,60,60,0,Math.PI*2);
  ctx.fill();
}

// 初期表示
setDefaultIcon();

uploadBtn.addEventListener('click',()=>{
  console.log('アップロードボタンクリック');
  iconFileInput.click();
});

defaultBtn.addEventListener('click',()=>{
  console.log('デフォルトボタンクリック');
  iconFile=null;
  setDefaultIcon();
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
    const img=new Image();
    img.onload=()=>{
      const ctx=iconPreviewCanvas.getContext('2d');
      ctx.clearRect(0,0,120,120);
      ctx.drawImage(img,0,0,120,120);
      iconFile=file;
      console.log('画像読み込み完了');
    };
    img.src=e.target.result;
  };
  reader.readAsDataURL(file);
});

// アカウントID重複チェック
accountIdInput.addEventListener('input',async()=>{
  const accountId=accountIdInput.value.trim();
  const idError=document.getElementById('id-error');
  const idHelp=document.getElementById('id-help');
  
  if(accountId.length<10){
    idError.textContent='';
    idHelp.textContent='例: 207d231234';
    return;
  }
  
  // 207d23 + 4桁数字の形式チェック
  if(!/^207d23\d{4}$/.test(accountId)){
    idError.textContent='207d23 + 4桁の数字で入力してください';
    idHelp.textContent='';
    return;
  }
  
  try{
    // 重複チェック
    const{data,error}=await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id',accountId)
      .single();
    
    if(data){
      idError.textContent='このIDはすでに使用されています';
      idHelp.textContent='';
    }else{
      idError.textContent='';
      idHelp.textContent='✓ 使用可能なIDです';
    }
  }catch(error){
    if(error.code!=='PGRST116'){
      console.error('重複チェックエラー:',error);
    }
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
  
  if(!/^207d23\d{4}$/.test(accountId)){
    document.getElementById('id-error').textContent='207d23 + 4桁の数字で入力してください';
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
  
  try{
    // メールアドレス形式に変換（Supabase Auth用）
    const email=`${accountId}@apphub.local`;
    
    console.log('Supabase認証開始:',email);
    
    // Supabase Authでユーザー作成
    const{data:authData,error:authError}=await supabase.auth.signUp({
      email:email,
      password:password,
      options:{
        data:{
          user_id:accountId,
          display_name:username,
          full_name:fullname,
          gmail_user:gmailUser,
          avatar_color:defaultColor
        }
      }
    });
    
    if(authError)throw authError;
    
    console.log('Supabase認証成功');
    
    // アイコン画像をアップロード
    let avatarUrl=null;
    if(iconFile){
      const fileExt=iconFile.name.split('.').pop();
      const fileName=`${accountId}_${Date.now()}.${fileExt}`;
      
      const{data:uploadData,error:uploadError}=await supabase.storage
        .from('avatars')
        .upload(fileName,iconFile);
      
      if(uploadError)throw uploadError;
      
      const{data:{publicUrl}}=supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);
      
      avatarUrl=publicUrl;
    }
    
    // プロフィール情報を更新
    const{error:profileError}=await supabase
      .from('profiles')
      .update({
        last_name:fullname.split(' ')[0]||fullname,
        first_name:fullname.split(' ')[1]||'',
        avatar_color:avatarUrl||defaultColor
      })
      .eq('id',authData.user.id);
    
    if(profileError)throw profileError;
    
    console.log('登録完了');
    alert('登録完了！');
    window.location.href='index.html';
  }catch(error){
    console.error('登録エラー:',error);
    
    if(error.message.includes('duplicate')||error.message.includes('already')){
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
