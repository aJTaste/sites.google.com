import{initPage}from'../common/core.js';
import{supabase}from'../common/supabase-config.js';

let userId=null;

await initPage('kaiwai-apply','界隈を作成する',true,async(profile)=>{
  userId=profile.id;
  await checkRequest();
  setupForm();
});

// ========================================
// 既存申請チェック
// ========================================
async function checkRequest(){
  // pending確認
  const{data:pending,error:e1}=await supabase
    .from('community_requests')
    .select('id,name')
    .eq('requester_id',userId)
    .eq('status','pending')
    .limit(1);

  if(!e1&&pending&&pending.length>0){
    document.getElementById('pending-name').textContent=`「${pending[0].name}」`;
    showState('pending');
    return;
  }

  // 直近の却下確認（再申請促進のためメモを表示）
  const{data:rejected,error:e2}=await supabase
    .from('community_requests')
    .select('name,review_note,reviewed_at')
    .eq('requester_id',userId)
    .eq('status','rejected')
    .order('reviewed_at',{ascending:false})
    .limit(1);

  if(!e2&&rejected&&rejected.length>0){
    const notice=document.getElementById('rejection-notice');
    const noteEl=document.getElementById('rejection-note-text');
    notice.hidden=false;
    noteEl.textContent=rejected[0].review_note||'理由の記載なし';
  }

  showState('form');
}

// ========================================
// フォームセットアップ
// ========================================
function setupForm(){
  const desc=document.getElementById('inp-desc');
  const count=document.getElementById('desc-count');

  desc.addEventListener('input',()=>{
    count.textContent=desc.value.length;
  });

  document.getElementById('submit-btn').addEventListener('click',submitApply);
}

// ========================================
// 申請送信
// ========================================
async function submitApply(){
  const name=document.getElementById('inp-name').value.trim();
  const desc=document.getElementById('inp-desc').value.trim();
  const invite=document.getElementById('inp-invite').value.trim();

  const errName=document.getElementById('err-name');
  const errInvite=document.getElementById('err-invite');
  const errSubmit=document.getElementById('err-submit');

  errName.textContent='';
  errInvite.textContent='';
  errSubmit.textContent='';

  let ok=true;

  if(name.length<1||name.length>32){
    errName.textContent='1〜32文字で入力してください';
    ok=false;
  }

  if(invite&&!/^[a-zA-Z0-9]{4,16}$/.test(invite)){
    errInvite.textContent='4〜16文字の半角英数字のみ使用できます';
    ok=false;
  }

  if(!ok)return;

  const btn=document.getElementById('submit-btn');
  btn.disabled=true;
  btn.textContent='送信中...';

  const{error}=await supabase
    .from('community_requests')
    .insert({
      requester_id:userId,
      name,
      description:desc||null,
      invite_code:invite||null
    });

  if(error){
    errSubmit.textContent='送信に失敗しました: '+error.message;
    btn.disabled=false;
    btn.textContent='申請する';
    return;
  }

  showState('done');
}

// ========================================
// 表示状態の切り替え
// ========================================
function showState(s){
  document.getElementById('state-form').hidden=(s!=='form');
  document.getElementById('state-pending').hidden=(s!=='pending');
  document.getElementById('state-done').hidden=(s!=='done');
}
