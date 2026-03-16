import{initPage}from'../common/core.js';
import{supabase}from'../common/supabase-config.js';
import{geoAvatarDataUrl}from'../common/geo-avatar.js';

let myProfile=null;
let myManagedCommunities=[];  // 管理権限のある界隈一覧
let currentCommunityId=null;

await initPage('kaiwai-manage','界隈メンバー管理',{onUserLoaded:async(profile)=>{
  myProfile=profile;
  await loadManagedCommunities();
}});

// ========================================
// 管理可能な界隈を取得
// ========================================
async function loadManagedCommunities(){
  const{data:memberships,error}=await supabase
    .from('community_members')
    .select('community_id,role,communities(id,name)')
    .eq('user_id',myProfile.id)
    .in('role',['owner','moderator']);

  if(error||!memberships||memberships.length===0){
    document.getElementById('community-label').textContent='管理できる界隈がありません';
    document.getElementById('member-list').innerHTML='<div class="manage-empty">オーナーまたはモデレーターの界隈がありません</div>';
    return;
  }

  myManagedCommunities=memberships.map(m=>({
    id:m.community_id,
    name:m.communities?.name||'界隈',
    myRole:m.role
  }));

  // セレクターを構築
  const sel=document.getElementById('community-select');
  myManagedCommunities.forEach(c=>{
    const opt=document.createElement('option');
    opt.value=c.id;
    opt.textContent=c.name+(c.myRole==='owner'?' (オーナー)':' (モデレーター)');
    sel.appendChild(opt);
  });

  if(myManagedCommunities.length>1){
    sel.hidden=false;
    sel.addEventListener('change',()=>{
      currentCommunityId=sel.value;
      loadMembers();
    });
  }

  currentCommunityId=myManagedCommunities[0].id;
  document.getElementById('community-label').textContent=myManagedCommunities[0].name;
  await loadMembers();
}

// ========================================
// メンバー一覧を読み込む
// ========================================
async function loadMembers(){
  const list=document.getElementById('member-list');
  list.innerHTML='<div class="manage-empty">読み込み中...</div>';

  // 現在の自分のロール
  const myCom=myManagedCommunities.find(c=>c.id===currentCommunityId);
  const myRole=myCom?.myRole||'member';

  const{data:members,error}=await supabase
    .from('community_members')
    .select('user_id,role,profiles(id,display_name,avatar_url,user_id)')
    .eq('community_id',currentCommunityId);

  if(error||!members){
    list.innerHTML='<div class="manage-empty">取得に失敗しました</div>';
    return;
  }

  // ロール順でソート: owner > moderator > member
  const ORDER={owner:0,moderator:1,member:2};
  members.sort((a,b)=>(ORDER[a.role]??9)-(ORDER[b.role]??9));

  list.innerHTML='';
  members.forEach(m=>{
    const p=m.profiles;
    if(!p)return;
    const isSelf=m.user_id===myProfile.id;
    const isOwner=m.role==='owner';

    const item=document.createElement('div');
    item.className='member-item';

    const src=p.avatar_url||geoAvatarDataUrl(p.id,40);

    let badge='';
    if(m.role==='owner') badge='<span class="role-badge role-owner">オーナー</span>';
    else if(m.role==='moderator') badge='<span class="role-badge role-moderator">Mod</span>';

    // ボタン表示条件:
    // - 自分自身 or オーナー相手 → 表示しない
    // - myRole=owner → 誰でもMod昇格/降格可
    // - myRole=moderator → memberのみMod昇格可（降格は不可）
    let btn='';
    if(!isSelf&&!isOwner){
      if(myRole==='owner'){
        if(m.role==='moderator'){
          btn=`<button class="btn-demote mod-btn" data-uid="${m.user_id}" data-action="demote">Modを外す</button>`
            +`<button class="btn-kick mod-btn" data-uid="${m.user_id}" data-name="${esc(p.display_name)}" data-action="kick">キック</button>`;
        }else if(m.role==='member'){
          btn=`<button class="btn-promote mod-btn" data-uid="${m.user_id}" data-action="promote">Modに設定</button>`
            +`<button class="btn-kick mod-btn" data-uid="${m.user_id}" data-name="${esc(p.display_name)}" data-action="kick">キック</button>`;
        }
      }else if(myRole==='moderator'&&m.role==='member'){
        btn=`<button class="btn-promote mod-btn" data-uid="${m.user_id}" data-action="promote">Modに設定</button>`
          +`<button class="btn-kick mod-btn" data-uid="${m.user_id}" data-name="${esc(p.display_name)}" data-action="kick">キック</button>`;
      }
    }

    item.innerHTML=`
      <div class="member-avatar"><img src="${src}" alt=""></div>
      <div class="member-info">
        <div class="member-name">${esc(p.display_name)}${badge}</div>
        <div class="member-id">ID: ${esc(p.user_id||'')}</div>
      </div>
      <div class="member-action">${btn}</div>
    `;
    list.appendChild(item);
  });

  list.querySelectorAll('.mod-btn').forEach(btn=>{
    if(btn.dataset.action==='kick'){
      btn.addEventListener('click',()=>handleKick(btn.dataset.uid,btn.dataset.name,btn));
    }else{
      btn.addEventListener('click',()=>handleRoleChange(btn.dataset.uid,btn.dataset.action,btn));
    }
  });
}

// ========================================
// ロール変更
// ========================================
async function handleRoleChange(userId,action,btn){
  btn.disabled=true;
  btn.textContent='処理中...';
  const newRole=action==='promote'?'moderator':'member';

  const{error}=await supabase
    .from('community_members')
    .update({role:newRole})
    .eq('community_id',currentCommunityId)
    .eq('user_id',userId);

  if(error){
    alert('変更に失敗しました: '+error.message);
    btn.disabled=false;
    btn.textContent=action==='promote'?'Modに設定':'Modを外す';
    return;
  }
  await loadMembers();
}

// ========================================
// キック処理
// ========================================
async function handleKick(userId,displayName,btn){
  if(!confirm(`「${displayName}」をこの界隈からキックしますか？`))return;
  btn.disabled=true;
  btn.textContent='処理中...';
  const{error}=await supabase
    .from('community_members')
    .delete()
    .eq('community_id',currentCommunityId)
    .eq('user_id',userId);
  if(error){
    alert('キックに失敗しました: '+error.message);
    btn.disabled=false;
    btn.textContent='キック';
    return;
  }
  await loadMembers();
}

function esc(t){
  const d=document.createElement('div');
  d.textContent=t||'';
  return d.innerHTML;
}