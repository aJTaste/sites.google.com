import{supabase}from'../common/supabase-config.js';
import{generateGeoAvatar,canvasToBlob,geoAvatarDataUrl,seedFromId}from'../common/geo-avatar.js';

const form=document.getElementById('register-form');
const passwordInput=document.getElementById('password');
const passwordConfirmInput=document.getElementById('password-confirm');
const displayNameInput=document.getElementById('display-name');
const bioInput=document.getElementById('bio');
const iconFileInput=document.getElementById('icon-file');
const iconPreview=document.getElementById('icon-preview');
const uploadBtn=document.getElementById('upload-btn');
const defaultBtn=document.getElementById('default-btn');
const submitBtn=document.getElementById('submit-btn');

let selectedFile=null;
let previewSeed=Math.floor(Math.random()*2147483647);

function showGeoPreview(seed){
  const canvas=generateGeoAvatar(128,seed);
  iconPreview.style.background='';
  iconPreview.innerHTML=`<img src="${canvas.toDataURL('image/png')}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`;
}

showGeoPreview(previewSeed);

bioInput.addEventListener('input',()=>{
  document.getElementById('bio-count').textContent=bioInput.value.length;
});

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

defaultBtn.addEventListener('click',()=>{
  selectedFile=null;
  previewSeed=Math.floor(Math.random()*2147483647);
  showGeoPreview(previewSeed);
});

form.addEventListener('submit',async(e)=>{
  e.preventDefault();

  const password=passwordInput.value;
  const passwordConfirm=passwordConfirmInput.value;
  const displayName=displayNameInput.value.trim();
  const bio=bioInput.value.trim();

  const passwordError=document.getElementById('password-error');
  passwordError.textContent='';

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
    const{data:seqData,error:seqError}=await supabase.rpc('next_user_id');
    if(seqError)throw seqError;
    const userId=seqData;

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
      const fileExt=selectedFile.name.split('.').pop().toLowerCase()||'jpg';
      const storagePath=`${uid}.${fileExt}`;
      const{error:uploadError}=await supabase.storage
        .from('avatars')
        .upload(storagePath,selectedFile,{contentType:selectedFile.type});
      if(uploadError)throw uploadError;
      const{data:urlData}=supabase.storage.from('avatars').getPublicUrl(storagePath);
      avatarUrl=urlData.publicUrl;
    }else{
      const canvas=generateGeoAvatar(256,seedFromId(uid));
      const blob=await canvasToBlob(canvas);
      const storagePath=`${uid}.png`;
      const{error:uploadError}=await supabase.storage
        .from('avatars')
        .upload(storagePath,blob,{contentType:'image/png'});
      if(uploadError)throw uploadError;
      const{data:urlData}=supabase.storage.from('avatars').getPublicUrl(storagePath);
      avatarUrl=urlData.publicUrl;
    }

    const{error:profileError}=await supabase
      .from('profiles')
      .update({
        avatar_url:avatarUrl,
        bio:bio
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

    alert(`登録完了！\nあなたのIDは「${userId}」です。\nログイン時に必要なのでメモしてください。`);
    window.location.href='hub.html';

  }catch(error){
    console.error('登録エラー:',error);
    alert('登録に失敗しました: '+error.message);
    submitBtn.disabled=false;
    submitBtn.textContent='登録';
  }
});

document.body.classList.remove('page-loading');
document.body.classList.add('page-loaded');
