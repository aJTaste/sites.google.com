import{initPage}from'../common/core.js';
import{supabase}from'../common/supabase-config.js';

let userId=null;

await initPage('kaiwai-join','界隈に参加する',true,async(profile)=>{
  userId=profile.id;
  setupForm();
});

// ========================================
// フォームセットアップ
// ========================================
function setupForm(){
  document.getElementById('join-btn').addEventListener('click',joinCommunity);
  document.getElementById('inp-code').addEventListener('keydown',(e)=>{
    if(e.key==='Enter')joinCommunity();
  });
}

// ========================================
// 参加処理
// ========================================
async function joinCommunity(){
  const code=document.getElementById('inp-code').value.trim();
  const errCode=document.getElementById('err-code');
  const errSubmit=document.getElementById('err-submit');
  errCode.textContent='';
  errSubmit.textContent='';

  if(!code){
    errCode.textContent='招待コードを入力してください';
    return;
  }

  const btn=document.getElementById('join-btn');
  btn.disabled=true;
  btn.textContent='確認中...';

  // communities テーブルで招待コードを照合
  const{data:community,error:e1}=await supabase
    .from('communities')
    .select('id,name')
    .eq('invite_code',code)
    .limit(1)
    .maybeSingle();

  if(e1||!community){
    errCode.textContent='招待コードが正しくありません';
    btn.disabled=false;
    btn.textContent='参加する';
    return;
  }

  // すでに参加済みか確認
  const{data:existing,error:e2}=await supabase
    .from('community_members')
    .select('community_id')
    .eq('community_id',community.id)
    .eq('user_id',userId)
    .limit(1)
    .maybeSingle();

  if(!e2&&existing){
    document.getElementById('already-name').textContent=`「${community.name}」`;
    showState('already');
    btn.disabled=false;
    btn.textContent='参加する';
    return;
  }

  // community_members に INSERT
  const{error:e3}=await supabase
    .from('community_members')
    .insert({
      community_id:community.id,
      user_id:userId,
      role:'member'
    });

  if(e3){
    errSubmit.textContent='参加に失敗しました: '+e3.message;
    btn.disabled=false;
    btn.textContent='参加する';
    return;
  }

  document.getElementById('success-name').textContent=`「${community.name}」`;
  showState('success');
  setTimeout(()=>{
    window.location.href='chat.html';
  },2000);
}

// ========================================
// 表示切り替え
// ========================================
function showState(id){
  ['form','already','success'].forEach(s=>{
    document.getElementById('state-'+s).hidden=(s!==id);
  });
}