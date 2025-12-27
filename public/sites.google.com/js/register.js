import{supabase,generateRandomColor}from'../common/supabase-config.js';

const form=document.getElementById('register-form');
const userIdInput=document.getElementById('user-id');
const passwordInput=document.getElementById('password');
const passwordConfirmInput=document.getElementById('password-confirm');
const displayNameInput=document.getElementById('display-name');
const lastNameInput=document.getElementById('last-name');
const firstNameInput=document.getElementById('first-name');
const iconFileInput=document.getElementById('icon-file');
const iconPreview=document.getElementById('icon-preview');
const uploadBtn=document.getElementById('upload-btn');
const defaultBtn=document.getElementById('default-btn');
const submitBtn=document.getElementById('submit-btn');

let selectedFile=null;
let avatarColor=generateRandomColor();

// アイコンプレビュー初期化
iconPreview.style.background=avatarColor;

// 画像アップロード
uploadBtn.addEventListener('click',()=>{
  iconFileInput.click();
});

iconFileInput.addEventListener('change',(e)=>{
  const file=e.target.files[0];
  if(!file)return;
  
  const iconError=document.getElementById('icon-error');
  iconError.textContent='';
  
  if(file.size>500*1024){
    iconError.textContent='画像サイズは500KB以下にしてください';
    return;
  }
  
  selectedFile=file;
  const reader=new FileReader();
  reader.onload=(e)=>{
    iconPreview.innerHTML=`<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;">`;
  };
  reader.readAsDataURL(file);
});

// デフォルトアイコン
defaultBtn.addEventListener('click',()=>{
  selectedFile=null;
  avatarColor=generateRandomColor();
  iconPreview.style.background=avatarColor;
  iconPreview.innerHTML='?';
});

// 表示名入力でプレビュー更新
displayNameInput.addEventListener('input',()=>{
  if(!selectedFile){
    const initial=displayNameInput.value.charAt(0).toUpperCase()||'?';
    iconPreview.textContent=initial;
  }
});

// ID重複チェック
userIdInput.addEventListener('input',async()=>{
  const userId=userIdInput.value.trim();
  const idError=document.getElementById('id-error');
  
  if(userId.length<10){
    idError.textContent='';
    return;
  }
  
  // フォーマットチェック
  if(!/^207d23\d{4}$/.test(userId)){
    idError.textContent='207d23 + 4桁の数字で入力してください';
    return;
  }
  
  try{
    const{data,error}=await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id',userId)
      .single();
    
    if(data){
      idError.textContent='このIDはすでに使用されています';
    }else{
      idError.textContent='';
      idError.classList.add('success-message');
      idError.textContent='✓ 使用可能なIDです';
      setTimeout(()=>{
        idError.classList.remove('success-message');
      },2000);
    }
  }catch(error){
    // データが見つからない場合はOK
    if(error.code==='PGRST116'){
      idError.textContent='';
    }
  }
});

// フォーム送信
form.addEventListener('submit',async(e)=>{
  e.preventDefault();
  
  const userId=userIdInput.value.trim();
  const password=passwordInput.value;
  const passwordConfirm=passwordConfirmInput.value;
  const displayName=displayNameInput.value.trim();
  const lastName=lastNameInput.value.trim();
  const firstName=firstNameInput.value.trim();
  
  const idError=document.getElementById('id-error');
  const passwordError=document.getElementById('password-error');
  
  idError.textContent='';
  passwordError.textContent='';
  
  // バリデーション
  if(!/^207d23\d{4}$/.test(userId)){
    idError.textContent='207d23 + 4桁の数字で入力してください';
    return;
  }
  
  if(password.length<8){
    passwordError.textContent='パスワードは8文字以上で入力してください';
    return;
  }
  
  if(password!==passwordConfirm){
    passwordError.textContent='パスワードが一致しません';
    return;
  }
  
  if(!displayName){
    alert('表示名を入力してください');
    return;
  }
  
  submitBtn.disabled=true;
  submitBtn.textContent='登録中...';
  
  try{
    // 重複チェック
    const{data:existing}=await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id',userId)
      .single();
    
    if(existing){
      idError.textContent='このIDはすでに使用されています';
      submitBtn.disabled=false;
      submitBtn.textContent='登録';
      return;
    }
    
    // ユーザー作成（メタデータにuser_idを含める）
    const{data:authData,error:authError}=await supabase.auth.signUp({
      email:`${userId}@ajtaste.jp`,
      password:password,
      options:{
        data:{
          user_id:userId,
          display_name:displayName
        }
      }
    });
    
    if(authError)throw authError;
    
    // プロフィール更新（トリガーで自動作成されるが、追加情報を更新）
    let avatarUrl=null;
    
    // 画像をアップロード
    if(selectedFile){
      const fileExt=selectedFile.name.split('.').pop();
      const fileName=`${authData.user.id}.${fileExt}`;
      
      const{error:uploadError}=await supabase.storage
        .from('avatars')
        .upload(fileName,selectedFile);
      
      if(uploadError)throw uploadError;
      
      const{data:urlData}=supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);
      
      avatarUrl=urlData.publicUrl;
    }
    
    // プロフィール更新
    const{error:profileError}=await supabase
      .from('profiles')
      .update({
        last_name:lastName,
        first_name:firstName,
        avatar_url:avatarUrl,
        avatar_color:avatarColor
      })
      .eq('id',authData.user.id);
    
    if(profileError)throw profileError;
    
    alert('登録完了！');
    window.location.href='index.html';
    
  }catch(error){
    console.error('登録エラー:',error);
    
    if(error.message.includes('User already registered')){
      idError.textContent='このIDはすでに使用されています';
    }else{
      alert('登録に失敗しました: '+error.message);
    }
    
    submitBtn.disabled=false;
    submitBtn.textContent='登録';
  }
});

// ページ表示
document.body.classList.remove('page-loading');
document.body.classList.add('page-loaded');
