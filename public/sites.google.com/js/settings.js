import{initPage,supabase}from'../common/core.js';

let currentProfile=null;
let currentIconFile=null;
// 'default' | null | File | 'geo'
let geoAvatarBlob=null;

// ========================================
// 幾何学アイコン生成
// ========================================
function generateGeoAvatar(size=256){
  const canvas=document.createElement('canvas');
  canvas.width=size;
  canvas.height=size;
  const ctx=canvas.getContext('2d');

  const rand=()=>Math.random();
  const randInt=(min,max)=>Math.floor(rand()*(max-min+1))+min;
  const randColor=()=>`hsl(${randInt(0,360)},${randInt(55,90)}%,${randInt(40,65)}%)`;

  // 背景
  const bg1=randColor();
  const bg2=randColor();
  const grad=ctx.createLinearGradient(0,0,size,size);
  grad.addColorStop(0,bg1);
  grad.addColorStop(1,bg2);
  ctx.fillStyle=grad;
  ctx.fillRect(0,0,size,size);

  const shapes=randInt(6,14);
  for(let i=0;i<shapes;i++){
    ctx.save();
    ctx.globalAlpha=rand()*0.55+0.25;
    ctx.fillStyle=randColor();
    ctx.strokeStyle=randColor();
    ctx.lineWidth=randInt(1,4);

    const type=randInt(0,4);
    const cx=rand()*size;
    const cy=rand()*size;
    const r=rand()*(size*0.28)+size*0.06;

    ctx.beginPath();
    if(type===0){
      // 円
      ctx.arc(cx,cy,r,0,Math.PI*2);
    }else if(type===1){
      // 三角形
      ctx.translate(cx,cy);
      ctx.rotate(rand()*Math.PI*2);
      ctx.moveTo(0,-r);
      ctx.lineTo(r*0.87,r*0.5);
      ctx.lineTo(-r*0.87,r*0.5);
      ctx.closePath();
    }else if(type===2){
      // 四角形（回転あり）
      ctx.translate(cx,cy);
      ctx.rotate(rand()*Math.PI*2);
      ctx.rect(-r/2,-r/2,r,r);
    }else if(type===3){
      // 六角形
      ctx.translate(cx,cy);
      ctx.rotate(rand()*Math.PI*2);
      for(let j=0;j<6;j++){
        const a=j*Math.PI/3;
        j===0?ctx.moveTo(r*Math.cos(a),r*Math.sin(a)):ctx.lineTo(r*Math.cos(a),r*Math.sin(a));
      }
      ctx.closePath();
    }else{
      // 楕円
      ctx.translate(cx,cy);
      ctx.rotate(rand()*Math.PI*2);
      ctx.ellipse(0,0,r,r*0.45,0,0,Math.PI*2);
    }

    if(rand()>0.4)ctx.fill();
    if(rand()>0.5)ctx.stroke();
    ctx.restore();
  }

  // 円形クリップ（オプション：コメントアウトで四角に）
  // ctx.globalCompositeOperation='destination-in';
  // ctx.beginPath();ctx.arc(size/2,size/2,size/2,0,Math.PI*2);ctx.fill();

  return canvas;
}

function canvasToBlob(canvas){
  return new Promise(resolve=>{
    canvas.toBlob(blob=>resolve(blob),'image/png');
  });
}

// ========================================
// ページ初期化
// ========================================
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

    renderIconPreview(profile.avatar_url,profile.display_name,profile.avatar_color);
  }
});

// ========================================
// アイコンプレビュー描画
// ========================================
function renderIconPreview(avatarUrl,displayName,avatarColor){
  const iconPreview=document.getElementById('icon-preview');
  if(avatarUrl){
    // キャッシュバスター付きで表示
    const url=avatarUrl.split('?')[0]+'?t='+Date.now();
    iconPreview.innerHTML=`<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`;
  }else{
    const initial=(displayName||'?').charAt(0).toUpperCase();
    iconPreview.style.background=avatarColor||'#FF6B35';
    iconPreview.innerHTML=`<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:48px;font-weight:600;color:#fff;">${initial}</div>`;
  }
}

// ========================================
// 表示名保存
// ========================================
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
    updateHeaderAvatar();
  }catch(error){
    console.error(error);
    displayNameError.textContent='保存に失敗しました';
  }
});

// ========================================
// 姓名保存
// ========================================
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
      .update({last_name:lastName,first_name:firstName})
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

// ========================================
// アイコン画像選択
// ========================================
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
    const iconPreview=document.getElementById('icon-preview');
    iconPreview.style.background='';
    iconPreview.innerHTML=`<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`;
  };
  reader.readAsDataURL(file);
});

// ========================================
// デフォルトアイコン
// ========================================
document.getElementById('default-icon-btn').addEventListener('click',()=>{
  currentIconFile='default';
  geoAvatarBlob=null;
  const initial=currentProfile.display_name.charAt(0).toUpperCase();
  const iconPreview=document.getElementById('icon-preview');
  iconPreview.style.background=currentProfile.avatar_color||'#FF6B35';
  iconPreview.innerHTML=`<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:48px;font-weight:600;color:#fff;">${initial}</div>`;
});

// ========================================
// 幾何学アイコン生成ボタン
// ========================================
const geoBtn=document.getElementById('geo-icon-btn');
if(geoBtn){
  geoBtn.addEventListener('click',async()=>{
    const canvas=generateGeoAvatar(256);
    geoAvatarBlob=await canvasToBlob(canvas);
    currentIconFile='geo';

    const iconPreview=document.getElementById('icon-preview');
    iconPreview.style.background='';
    iconPreview.innerHTML=`<img src="${canvas.toDataURL('image/png')}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`;
  });
}

// ========================================
// アイコン保存
// ========================================
document.getElementById('icon-save-btn').addEventListener('click',async()=>{
  const iconError=document.getElementById('icon-error');
  const iconSuccess=document.getElementById('icon-success');

  iconError.textContent='';
  iconSuccess.textContent='';

  try{
    let avatarUrl=currentProfile.avatar_url;

    if(currentIconFile==='default'){
      // デフォルトに戻す：既存ファイルを削除してnullに
      if(currentProfile.avatar_url){
        const oldStoragePath=extractStoragePath(currentProfile.avatar_url);
        if(oldStoragePath){
          await supabase.storage.from('avatars').remove([oldStoragePath]);
        }
      }
      avatarUrl=null;

    }else if(currentIconFile==='geo'&&geoAvatarBlob){
      // 幾何学アイコンをアップロード
      avatarUrl=await uploadAvatarBlob(geoAvatarBlob,'png');

    }else if(currentIconFile instanceof File){
      // 通常ファイルをアップロード
      const fileExt=currentIconFile.name.split('.').pop().toLowerCase()||'jpg';
      avatarUrl=await uploadAvatarFile(currentIconFile,fileExt);
    }

    // プロフィール更新
    const{error}=await supabase
      .from('profiles')
      .update({avatar_url:avatarUrl})
      .eq('id',currentProfile.id);

    if(error)throw error;

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

// Supabase公開URLからストレージパス部分だけを取り出す
// 例: https://xxx.supabase.co/storage/v1/object/public/avatars/uuid.jpg?t=123
//   → "uuid.jpg"
function extractStoragePath(url){
  if(!url)return null;
  try{
    // クエリを除去してパス部分だけにする
    const clean=url.split('?')[0];
    // /public/avatars/ 以降を取得
    const marker='/public/avatars/';
    const idx=clean.indexOf(marker);
    if(idx!==-1)return clean.slice(idx+marker.length);
    // フォールバック: 最後のセグメント
    return clean.split('/').pop()||null;
  }catch{
    return null;
  }
}

// 既存ファイルを安全に削除してから新規アップロード（upsertより確実）
async function uploadAvatarFile(file,ext){
  const storagePath=`${currentProfile.id}.${ext}`;

  // 既存削除（失敗しても続行）
  if(currentProfile.avatar_url){
    const oldPath=extractStoragePath(currentProfile.avatar_url);
    if(oldPath&&oldPath!==storagePath){
      await supabase.storage.from('avatars').remove([oldPath]).catch(()=>{});
    }
  }

  // まずupsert試行、失敗したらremove→upload
  const{error:e1}=await supabase.storage
    .from('avatars')
    .upload(storagePath,file,{upsert:true,contentType:file.type});

  if(e1){
    // upsertが使えない場合：既存削除→新規upload
    await supabase.storage.from('avatars').remove([storagePath]).catch(()=>{});
    const{error:e2}=await supabase.storage
      .from('avatars')
      .upload(storagePath,file,{contentType:file.type});
    if(e2)throw e2;
  }

  const{data:urlData}=supabase.storage.from('avatars').getPublicUrl(storagePath);
  // キャッシュバスター付きで返す
  return urlData.publicUrl+'?t='+Date.now();
}

async function uploadAvatarBlob(blob,ext){
  const storagePath=`${currentProfile.id}.${ext}`;

  if(currentProfile.avatar_url){
    const oldPath=extractStoragePath(currentProfile.avatar_url);
    if(oldPath&&oldPath!==storagePath){
      await supabase.storage.from('avatars').remove([oldPath]).catch(()=>{});
    }
  }

  const{error:e1}=await supabase.storage
    .from('avatars')
    .upload(storagePath,blob,{upsert:true,contentType:'image/png'});

  if(e1){
    await supabase.storage.from('avatars').remove([storagePath]).catch(()=>{});
    const{error:e2}=await supabase.storage
      .from('avatars')
      .upload(storagePath,blob,{contentType:'image/png'});
    if(e2)throw e2;
  }

  const{data:urlData}=supabase.storage.from('avatars').getPublicUrl(storagePath);
  return urlData.publicUrl+'?t='+Date.now();
}

// ========================================
// ヘッダーのアバター更新
// ========================================
function updateHeaderAvatar(){
  const userAvatar=document.getElementById('user-avatar');
  if(!userAvatar)return;

  if(currentProfile.avatar_url){
    const url=currentProfile.avatar_url.split('?')[0]+'?t='+Date.now();
    userAvatar.innerHTML=`<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  }else{
    const initial=currentProfile.display_name.charAt(0).toUpperCase();
    userAvatar.style.background=currentProfile.avatar_color||'#FF6B35';
    userAvatar.textContent=initial;
  }
}