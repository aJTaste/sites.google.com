import{initPage,supabase}from'../common/core.js';
import{generateGeoAvatar,canvasToBlob,geoAvatarDataUrl,seedFromId}from'../common/geo-avatar.js';

let currentProfile=null;
let currentIconFile=null;
let geoAvatarBlob=null;

await initPage('settings','設定',{
  onUserLoaded:async(profile)=>{
    currentProfile=profile;

    document.getElementById('user-id-display').textContent=profile.user_id;
    document.getElementById('created-date').textContent=new Date(profile.created_at).toLocaleDateString('ja-JP');

    const roleNames={user:'一般ユーザー',moderator:'モデレーター',admin:'管理者'};
    document.getElementById('user-role').textContent=roleNames[profile.role]||profile.role;

    document.getElementById('display-name-input').value=profile.display_name;
    document.getElementById('last-name-input').value=profile.last_name||'';
    document.getElementById('first-name-input').value=profile.first_name||'';

    renderIconPreview();
  }
});

function renderIconPreview(){
  const iconPreview=document.getElementById('icon-preview');
  const url=currentProfile.avatar_url
    ?currentProfile.avatar_url.split('?')[0]+'?t='+Date.now()
    :geoAvatarDataUrl(currentProfile.id,120);
  iconPreview.style.background='';
  iconPreview.innerHTML=`<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`;
}

document.getElementById('display-name-save-btn').addEventListener('click',async()=>{
  const displayName=document.getElementById('display-name-input').value.trim();
  const displayNameError=document.getElementById('display-name-error');
  const displayNameSuccess=document.getElementById('display-name-success');
  displayNameError.textContent='';
  displayNameSuccess.textContent='';
  if(displayName.length<1||displayName.length>100){
    displayNameError.textContent='表示名は1-100文字で入力してください';
    return;
  }
  try{
    const{error}=await supabase
      .from('profiles').update({display_name:displayName}).eq('id',currentProfile.id);
    if(error)throw error;
    displayNameSuccess.textContent='✓ 保存しました';
    currentProfile.display_name=displayName;
    updateHeaderAvatar();
  }catch(error){
    console.error(error);
    displayNameError.textContent='保存に失敗しました';
  }
});

document.getElementById('name-save-btn').addEventListener('click',async()=>{
  const lastName=document.getElementById('last-name-input').value.trim();
  const firstName=document.getElementById('first-name-input').value.trim();
  const nameError=document.getElementById('name-error');
  const nameSuccess=document.getElementById('name-success');
  nameError.textContent='';
  nameSuccess.textContent='';
  try{
    const{error}=await supabase
      .from('profiles').update({last_name:lastName,first_name:firstName}).eq('id',currentProfile.id);
    if(error)throw error;
    nameSuccess.textContent='✓ 保存しました';
    currentProfile.last_name=lastName;
    currentProfile.first_name=firstName;
  }catch(error){
    console.error(error);
    nameError.textContent='保存に失敗しました';
  }
});

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
  currentIconFile=file;
  geoAvatarBlob=null;
  const reader=new FileReader();
  reader.onload=(ev)=>{
    const p=document.getElementById('icon-preview');
    p.style.background='';
    p.innerHTML=`<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`;
  };
  reader.readAsDataURL(file);
});

const geoBtn=document.getElementById('geo-icon-btn');
if(geoBtn){
  geoBtn.addEventListener('click',async()=>{
    const canvas=generateGeoAvatar(256);
    geoAvatarBlob=await canvasToBlob(canvas);
    currentIconFile='geo';
    const p=document.getElementById('icon-preview');
    p.style.background='';
    p.innerHTML=`<img src="${canvas.toDataURL('image/png')}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`;
  });
}

document.getElementById('default-icon-btn').addEventListener('click',async()=>{
  const canvas=generateGeoAvatar(256,seedFromId(currentProfile.id));
  geoAvatarBlob=await canvasToBlob(canvas);
  currentIconFile='geo';
  const p=document.getElementById('icon-preview');
  p.style.background='';
  p.innerHTML=`<img src="${canvas.toDataURL('image/png')}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`;
});

document.getElementById('icon-save-btn').addEventListener('click',async()=>{
  const iconError=document.getElementById('icon-error');
  const iconSuccess=document.getElementById('icon-success');
  iconError.textContent='';
  iconSuccess.textContent='';

  try{
    let avatarUrl=currentProfile.avatar_url;

    if(currentIconFile==='geo'&&geoAvatarBlob){
      avatarUrl=await uploadBlob(geoAvatarBlob,'png');
    }else if(currentIconFile instanceof File){
      const ext=currentIconFile.name.split('.').pop().toLowerCase()||'jpg';
      avatarUrl=await uploadFile(currentIconFile,ext);
    }

    const{error}=await supabase
      .from('profiles').update({avatar_url:avatarUrl}).eq('id',currentProfile.id);
    if(error)throw error;

    // 古いファイルを削除（ベストエフォート）
    if(currentProfile.avatar_url){
      const oldPath=extractStoragePath(currentProfile.avatar_url);
      if(oldPath)supabase.storage.from('avatars').remove([oldPath]).catch(()=>{});
    }

    currentProfile.avatar_url=avatarUrl;
    currentIconFile=null;
    geoAvatarBlob=null;
    iconSuccess.textContent='✓ 保存しました';
    updateHeaderAvatar();
  }catch(err){
    console.error('アイコン保存エラー:',err);
    iconError.textContent='保存に失敗しました: '+(err.message||JSON.stringify(err));
  }
});

// ========================================
// ストレージヘルパー
// ========================================

// 毎回タイムスタンプ付きの新規パスを使う → "already exists"を根本回避
function newStoragePath(ext){
  return`${currentProfile.id}_${Date.now()}.${ext}`;
}

function extractStoragePath(url){
  if(!url)return null;
  try{
    const clean=url.split('?')[0];
    const marker='/public/avatars/';
    const idx=clean.indexOf(marker);
    if(idx!==-1)return clean.slice(idx+marker.length);
    return clean.split('/').pop()||null;
  }catch{return null;}
}

async function uploadFile(file,ext){
  const path=newStoragePath(ext);
  const{error}=await supabase.storage
    .from('avatars')
    .upload(path,file,{contentType:file.type});
  if(error)throw error;
  const{data}=supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl+'?t='+Date.now();
}

async function uploadBlob(blob,ext){
  const path=newStoragePath(ext);
  const{error}=await supabase.storage
    .from('avatars')
    .upload(path,blob,{contentType:'image/png'});
  if(error)throw error;
  const{data}=supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl+'?t='+Date.now();
}

function updateHeaderAvatar(){
  const userAvatar=document.getElementById('user-avatar');
  if(!userAvatar)return;
  const url=currentProfile.avatar_url
    ?currentProfile.avatar_url.split('?')[0]+'?t='+Date.now()
    :geoAvatarDataUrl(currentProfile.id,40);
  userAvatar.innerHTML=`<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
}