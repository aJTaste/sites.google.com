import{initPage,supabase}from'../common/core.js';
import{generateGeoAvatar,canvasToBlob,geoAvatarDataUrl,seedFromId,AVATAR_STYLES}from'../common/geo-avatar.js';


let currentProfile=null;
let currentIconFile=null;
let geoAvatarBlob=null;
let selectedStyleIndex=-1;

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
    renderStylePicker();
    document.getElementById('bio-input').value=profile.bio||'';
    updateBioCount();
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
  selectedStyleIndex=-1;
  document.querySelectorAll('.geo-style-card').forEach(c=>c.classList.remove('selected'));
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

// スタイルピッカーを描画
function renderStylePicker(){
  const grid=document.getElementById('geo-style-grid');
  if(!grid)return;
  grid.innerHTML='';
  AVATAR_STYLES.forEach(style=>{
    const card=document.createElement('div');
    card.className='geo-style-card';
    card.dataset.styleId=style.id;
    if(style.id===selectedStyleIndex) card.classList.add('selected');

    // プレビューcanvas（64px、ユーザーIDシード固定で表示）
    const previewSeed=seedFromId(currentProfile.id)+style.id*999983;
    const canvas=generateGeoAvatar(64,previewSeed,style.id);
    canvas.style.pointerEvents='none';

    // ラベル
    const lbl=document.createElement('div');
    lbl.className='geo-style-card-label';
    lbl.innerHTML=`<b>${style.label}</b>${style.sub}`;

    // 🎲再生成ボタン
    const regenBtn=document.createElement('button');
    regenBtn.className='geo-style-regen';
    regenBtn.textContent='🎲 生成';

    card.appendChild(canvas);
    card.appendChild(lbl);
    card.appendChild(regenBtn);
    grid.appendChild(card);

    // カードクリック → 選択してメインプレビュー更新
    card.addEventListener('click',(e)=>{
      if(e.target===regenBtn)return; // 再生成ボタンは別ハンドラ
      selectStyleAndGenerate(style.id);
    });

    // 🎲再生成ボタン → 新しいランダムシードで生成
    regenBtn.addEventListener('click',(e)=>{
      e.stopPropagation();
      selectStyleAndGenerate(style.id,true);
    });
  });
}

// スタイルを選んでメインプレビューに反映
async function selectStyleAndGenerate(styleId,forceNew=false){
  selectedStyleIndex=styleId;

  // 選択状態の見た目更新
  document.querySelectorAll('.geo-style-card').forEach(card=>{
    card.classList.toggle('selected',Number(card.dataset.styleId)===styleId);
  });

  // ランダムシードで新しいアイコンを生成
  const newSeed=forceNew
    ?Math.floor(Math.random()*2147483647)
    :Math.floor(Math.random()*2147483647);

  const canvas=generateGeoAvatar(256,newSeed,styleId);
  geoAvatarBlob=await canvasToBlob(canvas);
  currentIconFile='geo';

  const p=document.getElementById('icon-preview');
  p.style.background='';
  p.innerHTML=`<img src="${canvas.toDataURL('image/png')}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`;
}


// bio文字数カウント
function updateBioCount(){
  const input=document.getElementById('bio-input');
  const count=document.getElementById('bio-char-count');
  if(!input||!count)return;
  count.textContent=`${input.value.length}/100`;
}

document.getElementById('bio-input')?.addEventListener('input',updateBioCount);

document.getElementById('bio-save-btn')?.addEventListener('click',async()=>{
  const bio=(document.getElementById('bio-input')?.value||'').trim();
  const bioError=document.getElementById('bio-error');
  const bioSuccess=document.getElementById('bio-success');
  bioError.textContent='';
  bioSuccess.textContent='';

  if(bio.length>100){
    bioError.textContent='100文字以内で入力してください';
    return;
  }

  try{
    const{error}=await supabase
      .from('profiles')
      .update({bio})
      .eq('id',currentProfile.id);
    if(error)throw error;
    bioSuccess.textContent='✓ 保存しました';
    currentProfile.bio=bio;
    setTimeout(()=>{bioSuccess.textContent='';},3000);
  }catch(error){
    console.error(error);
    bioError.textContent='保存に失敗しました';
  }
});