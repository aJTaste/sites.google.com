import{initPage,supabase}from'../common/core.js';

let currentProfile=null;
let currentIconFile=null;

// ページ初期化
await initPage('settings','設定',{
  onUserLoaded:async(profile)=>{
    currentProfile=profile;
    
    // 情報を表示
    document.getElementById('user-id-display').textContent=profile.user_id;
    document.getElementById('created-date').textContent=new Date(profile.created_at).toLocaleDateString('ja-JP');
    
    // 権限表示
    const roleNames={user:'一般ユーザー',moderator:'モデレーター',admin:'管理者'};
    document.getElementById('user-role').textContent=roleNames[profile.role]||profile.role;
    
    // 表示名
    document.getElementById('display-name-input').value=profile.display_name;
    
    // 姓名
    document.getElementById('last-name-input').value=profile.last_name||'';
    document.getElementById('first-name-input').value=profile.first_name||'';
    
    // アイコン表示
    const iconPreview=document.getElementById('icon-preview');
    if(profile.avatar_url){
      iconPreview.innerHTML=`<img src="${profile.avatar_url}" style="width:100%;height:100%;object-fit:cover;">`;
    }else{
      const initial=profile.display_name.charAt(0).toUpperCase();
      iconPreview.style.background=profile.avatar_color||'#FF6B35';
      iconPreview.innerHTML=`<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:48px;font-weight:600;color:#fff;">${initial}</div>`;
    }
  }
});

// 表示名保存
document.getElementById('display-name-save-btn').addEventListener('click',async()=>{
  const displayNameInput=document.getElementById('display-name-input');
  const displayName=displayNameInput.value.trim();
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
      .from('profiles')
      .update({display_name:displayName})
      .eq('id',currentProfile.id);
    
    if(error)throw error;
    
    displayNameSuccess.textContent='✓ 保存しました';
    currentProfile.display_name=displayName;
    
    // ヘッダーのアバターも更新
    updateHeaderAvatar();
  }catch(error){
    console.error(error);
    displayNameError.textContent='保存に失敗しました';
  }
});

// 姓名保存
document.getElementById('name-save-btn').addEventListener('click',async()=>{
  const lastName=document.getElementById('last-name-input').value.trim();
  const firstName=document.getElementById('first-name-input').value.trim();
  const nameError=document.getElementById('name-error');
  const nameSuccess=document.getElementById('name-success');
  
  nameError.textContent='';
  nameSuccess.textContent='';
  
  try{
    const{error}=await supabase
      .from('profiles')
      .update({
        last_name:lastName,
        first_name:firstName
      })
      .eq('id',currentProfile.id);
    
    if(error)throw error;
    
    nameSuccess.textContent='✓ 保存しました';
    currentProfile.last_name=lastName;
    currentProfile.first_name=firstName;
  }catch(error){
    console.error(error);
    nameError.textContent='保存に失敗しました';
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
  
  currentIconFile=file;
  
  const reader=new FileReader();
  reader.onload=(e)=>{
    document.getElementById('icon-preview').innerHTML=`<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;">`;
  };
  reader.readAsDataURL(file);
});

// デフォルトアイコン
document.getElementById('default-icon-btn').addEventListener('click',()=>{
  currentIconFile='default';
  const initial=currentProfile.display_name.charAt(0).toUpperCase();
  const iconPreview=document.getElementById('icon-preview');
  iconPreview.style.background=currentProfile.avatar_color||'#FF6B35';
  iconPreview.innerHTML=`<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:48px;font-weight:600;color:#fff;">${initial}</div>`;
});

// アイコン保存
document.getElementById('icon-save-btn').addEventListener('click',async()=>{
  const iconError=document.getElementById('icon-error');
  const iconSuccess=document.getElementById('icon-success');
  
  iconError.textContent='';
  iconSuccess.textContent='';
  
  try{
    let avatarUrl=currentProfile.avatar_url;
    
    if(currentIconFile==='default'){
      // デフォルトに戻す
      avatarUrl=null;
    }else if(currentIconFile){
      // 新しい画像をアップロード
      const fileExt=currentIconFile.name.split('.').pop();
      const fileName=`${currentProfile.id}.${fileExt}`;
      
      // 既存の画像を削除
      if(currentProfile.avatar_url){
        const oldPath=currentProfile.avatar_url.split('/').pop();
        await supabase.storage.from('avatars').remove([oldPath]);
      }
      
      // 新しい画像をアップロード
      const{error:uploadError}=await supabase.storage
        .from('avatars')
        .upload(fileName,currentIconFile,{upsert:true});
      
      if(uploadError)throw uploadError;
      
      const{data:urlData}=supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);
      
      avatarUrl=urlData.publicUrl;
    }
    
    // プロフィール更新
    const{error}=await supabase
      .from('profiles')
      .update({avatar_url:avatarUrl})
      .eq('id',currentProfile.id);
    
    if(error)throw error;
    
    currentProfile.avatar_url=avatarUrl;
    iconSuccess.textContent='✓ 保存しました';
    
    // ヘッダーのアバターも更新
    updateHeaderAvatar();
  }catch(error){
    console.error(error);
    iconError.textContent='保存に失敗しました';
  }
});

// ヘッダーのアバター更新
function updateHeaderAvatar(){
  const userAvatar=document.getElementById('user-avatar');
  if(!userAvatar)return;
  
  if(currentProfile.avatar_url){
    userAvatar.innerHTML=`<img src="${currentProfile.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  }else{
    const initial=currentProfile.display_name.charAt(0).toUpperCase();
    userAvatar.style.background=currentProfile.avatar_color||'#FF6B35';
    userAvatar.textContent=initial;
  }
}
