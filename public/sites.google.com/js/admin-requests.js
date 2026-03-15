import{initPage}from'../common/core.js';
import{supabase}from'../common/supabase-config.js';
import{geoAvatarDataUrl}from'../common/geo-avatar.js';

let adminId=null;
let currentTab='pending';
let rejectTargetId=null;
let rejectTargetName='';

await initPage('admin-requests','界隈申請管理',true,async(profile)=>{
  if(profile.role!=='admin'){
    window.location.href='hub.html';
    return;
  }
  adminId=profile.id;
  setupTabs();
  setupRejectModal();
  await loadTabCounts();
  await loadRequests();
});

// ========================================
// タブ
// ========================================
function setupTabs(){
  document.getElementById('ar-tabs').addEventListener('click',async(e)=>{
    const tab=e.target.closest('.ar-tab');
    if(!tab)return;
    const status=tab.dataset.status;
    if(status===currentTab)return;

    document.querySelectorAll('.ar-tab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    currentTab=status;
    await loadRequests();
  });
}

// ========================================
// タブカウント取得
// ========================================
async function loadTabCounts(){
  const statuses=['pending','approved','rejected'];
  await Promise.all(statuses.map(async s=>{
    const{count}=await supabase
      .from('community_requests')
      .select('*',{count:'exact',head:true})
      .eq('status',s);
    const el=document.getElementById(`count-${s}`);
    if(!el)return;
    if(count>0){
      el.textContent=count;
      el.classList.add('visible');
    }else{
      el.classList.remove('visible');
    }
  }));
}

// ========================================
// 申請一覧取得・描画
// ========================================
async function loadRequests(){
  const list=document.getElementById('ar-list');
  list.innerHTML='<div class="ar-loading"><span class="loading"></span></div>';

  const{data:requests,error}=await supabase
    .from('community_requests')
    .select('*')
    .eq('status',currentTab)
    .order('created_at',{ascending:false});

  if(error){
    list.innerHTML=`<div class="ar-empty"><p>取得に失敗しました: ${error.message}</p></div>`;
    return;
  }

  if(!requests||requests.length===0){
    list.innerHTML=`
      <div class="ar-empty">
        <span class="material-symbols-outlined">inbox</span>
        <p>申請はありません</p>
      </div>
    `;
    return;
  }

  // 申請者プロフィールを一括取得
  const ids=[...new Set(requests.map(r=>r.requester_id))];
  const{data:profiles}=await supabase
    .from('profiles')
    .select('id,display_name,avatar_url')
    .in('id',ids);

  const pMap={};
  (profiles||[]).forEach(p=>{pMap[p.id]=p;});

  list.innerHTML='';
  requests.forEach(req=>{
    const profile=pMap[req.requester_id];
    list.appendChild(createCard(req,profile));
  });
}

// ========================================
// カード生成
// ========================================
function createCard(req,profile){
  const card=document.createElement('div');
  card.className='ar-card';

  const name=profile?.display_name||'不明なユーザー';
  const avatarUrl=profile?.avatar_url||(profile?geoAvatarDataUrl(profile.id,36):'');
  const date=new Date(req.created_at).toLocaleString('ja-JP',{
    month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'
  });

  const inviteHtml=req.invite_code
    ?`<span class="ar-meta-item">
        <span class="material-symbols-outlined">key</span>
        ${esc(req.invite_code)}
      </span>`
    :'';

  const descHtml=req.description
    ?`<p class="ar-desc">${esc(req.description)}</p>`
    :'';

  // pending: 承認・却下ボタン
  // approved/rejected: バッジ + レビューメモ
  let bottomHtml='';
  if(req.status==='pending'){
    bottomHtml=`
      <div class="ar-actions">
        <button class="btn-approve" data-id="${req.id}">
          <span class="material-symbols-outlined" style="font-size:16px;">check</span>
          承認
        </button>
        <button class="btn-reject-open" data-id="${req.id}" data-name="${esc(req.name)}">
          <span class="material-symbols-outlined" style="font-size:16px;">close</span>
          却下
        </button>
      </div>
    `;
  }else if(req.status==='approved'){
    bottomHtml=`
      <div style="margin-top:12px;">
        <span class="ar-status-badge badge-approved">
          <span class="material-symbols-outlined" style="font-size:14px;">check_circle</span>
          承認済み
        </span>
      </div>
    `;
  }else if(req.status==='rejected'){
    const noteHtml=req.review_note
      ?`<p class="ar-review-note">却下理由: ${esc(req.review_note)}</p>`
      :'';
    bottomHtml=`
      <div style="margin-top:12px;">
        <span class="ar-status-badge badge-rejected">
          <span class="material-symbols-outlined" style="font-size:14px;">cancel</span>
          却下済み
        </span>
        ${noteHtml}
      </div>
    `;
  }

  card.innerHTML=`
    <div class="ar-card-top">
      <div class="ar-card-left">
        <div class="ar-requester-avatar">
          <img src="${avatarUrl}" alt="${esc(name)}">
        </div>
        <div>
          <div class="ar-requester-name">${esc(name)}</div>
          <div class="ar-date">${date}</div>
        </div>
      </div>
    </div>
    <div class="ar-community-name">${esc(req.name)}</div>
    <div class="ar-meta">
      ${inviteHtml}
    </div>
    ${descHtml}
    ${bottomHtml}
  `;

  // イベント設定（pendingのみ）
  if(req.status==='pending'){
    card.querySelector('.btn-approve').addEventListener('click',()=>approveRequest(req));
    card.querySelector('.btn-reject-open').addEventListener('click',()=>openRejectModal(req.id,req.name));
  }

  return card;
}

function esc(t){
  const d=document.createElement('div');
  d.textContent=t||'';
  return d.innerHTML;
}

// ========================================
// 承認処理
// ========================================
async function approveRequest(req){
  const btn=document.querySelector(`.btn-approve[data-id="${req.id}"]`);
  if(btn){btn.disabled=true;btn.textContent='処理中...';}

  // Step1: communities INSERT
  const{data:community,error:e1}=await supabase
    .from('communities')
    .insert({
      name:req.name,
      description:req.description||null,
      created_by:req.requester_id
    })
    .select('id')
    .single();

  if(e1){
    alert('承認失敗 (communities INSERT): '+e1.message);
    if(btn){btn.disabled=false;btn.textContent='承認';}
    return;
  }

  // Step2: community_members INSERT (owner)
  const{error:e2}=await supabase
    .from('community_members')
    .insert({
      community_id:community.id,
      user_id:req.requester_id,
      role:'owner'
    });

  if(e2){
    alert('承認失敗 (community_members INSERT): '+e2.message+'\n\nコミュニティID: '+community.id+' は作成済みです。手動でメンバーを追加してください。');
    if(btn){btn.disabled=false;btn.textContent='承認';}
    return;
  }

  // Step3: community_requests UPDATE
  const{error:e3}=await supabase
    .from('community_requests')
    .update({
      status:'approved',
      reviewer_id:adminId,
      reviewed_at:new Date().toISOString()
    })
    .eq('id',req.id);

  if(e3){
    console.error('[approveRequest] status update failed',e3);
  }

  await loadTabCounts();
  await loadRequests();
}

// ========================================
// 却下モーダル
// ========================================
function setupRejectModal(){
  const modal=document.getElementById('reject-modal');
  const closeModal=()=>{
    modal.hidden=true;
    rejectTargetId=null;
    rejectTargetName='';
    document.getElementById('reject-note').value='';
  };

  document.getElementById('reject-cancel-btn').addEventListener('click',closeModal);
  document.getElementById('reject-cancel-btn2').addEventListener('click',closeModal);

  // オーバーレイクリックで閉じる
  modal.addEventListener('click',(e)=>{
    if(e.target===modal)closeModal();
  });

  document.getElementById('reject-confirm-btn').addEventListener('click',async()=>{
    if(!rejectTargetId)return;
    const note=document.getElementById('reject-note').value.trim();
    const confirmBtn=document.getElementById('reject-confirm-btn');
    confirmBtn.disabled=true;
    confirmBtn.textContent='処理中...';
    await rejectRequest(rejectTargetId,note);
    confirmBtn.disabled=false;
    confirmBtn.textContent='却下する';
    closeModal();
  });
}

function openRejectModal(id,name){
  rejectTargetId=id;
  rejectTargetName=name;
  document.getElementById('reject-target-name').textContent=`「${name}」`;
  document.getElementById('reject-modal').hidden=false;
}

async function rejectRequest(id,note){
  const{error}=await supabase
    .from('community_requests')
    .update({
      status:'rejected',
      reviewer_id:adminId,
      review_note:note||null,
      reviewed_at:new Date().toISOString()
    })
    .eq('id',id);

  if(error){
    alert('却下処理に失敗しました: '+error.message);
    return;
  }

  await loadTabCounts();
  await loadRequests();
}
