import{supabase}from'../common/supabase-config.js';
import{generateGeoAvatar,canvasToBlob,geoAvatarDataUrl,seedFromId}from'../common/geo-avatar.js';

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
// 幾何学アイコンをプレビューとして表示（登録前は仮のランダムシードで生成）
let previewSeed=Math.floor(Math.random()*2147483647);

function showGeoPreview(seed){
  const canvas=generateGeoAvatar(128,seed);
  iconPreview.style.background='';
  iconPreview.innerHTML=`<img src="${canvas.toDataURL('image/png')}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`;
}

// 初期プレビュー
showGeoPreview(previewSeed);

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
  reader.onload=(ev)=>{
    iconPreview.style.background='';
    iconPreview.innerHTML=`<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`;
  };
  reader.readAsDataURL(file);
});

// デフォルト（幾何学を新規生成）
defaultBtn.addEventListener('click',()=>{
  selectedFile=null;
  previewSeed=Math.floor(Math.random()*2147483647);
  showGeoPreview(previewSeed);
});

// 表示名入力でも特に変化なし（幾何学はユーザーIDベースのため登録後に確定）
displayNameInput.addEventListener('input',()=>{
  if(!selectedFile){
    // 幾何学プレビューはそのまま維持
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

  if(!/^207d23\d{4}$/.test(userId)){
    idError.textContent='207d23 + 4桁の数字で入力してください';
    return;
  }

  try{
    const{data}=await supabase
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
      setTimeout(()=>{idError.classList.remove('success-message');},2000);
    }
  }catch(error){
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

    // ユーザー作成
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

    const uid=authData.user.id;
    let avatarUrl=null;

    if(selectedFile){
      // ユーザーが画像を選択した場合
      const fileExt=selectedFile.name.split('.').pop().toLowerCase()||'jpg';
      const storagePath=`${uid}.${fileExt}`;

      const{error:uploadError}=await supabase.storage
        .from('avatars')
        .upload(storagePath,selectedFile,{contentType:selectedFile.type});

      if(uploadError)throw uploadError;

      const{data:urlData}=supabase.storage
        .from('avatars')
        .getPublicUrl(storagePath);
      avatarUrl=urlData.publicUrl;

    }else{
      // 画像未選択 → 幾何学アイコンを自動生成
      // ユーザーIDをシードにして決定論的なアイコンを生成
      const canvas=generateGeoAvatar(256,seedFromId(uid));
      const blob=await canvasToBlob(canvas);
      const storagePath=`${uid}.png`;

      const{error:uploadError}=await supabase.storage
        .from('avatars')
        .upload(storagePath,blob,{contentType:'image/png'});

      if(uploadError)throw uploadError;

      const{data:urlData}=supabase.storage
        .from('avatars')
        .getPublicUrl(storagePath);
      avatarUrl=urlData.publicUrl;
    }

    // プロフィール更新（avatar_colorは設定しない）
    const{error:profileError}=await supabase
      .from('profiles')
      .update({
        last_name:lastName,
        first_name:firstName,
        avatar_url:avatarUrl
      })
      .eq('id',uid);

    if(profileError)throw profileError;

    const{error:memberError}=await supabase
      .from('community_members')
      .insert({
        community_id:'00000000-0000-0000-0000-000000000001',
        user_id:uid,
        role:'member'
      });
    if(memberError)console.warn('[register] community_members:',memberError);

    alert('登録完了！');
    window.location.href='hub.html';

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