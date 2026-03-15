import{initPage,supabase}from'../common/core.js';

let allProfiles=[];
let currentCommunityId=null;

// ページ初期化（モデレーター以上のみ）
await initPage('db','Database',{
  onUserLoaded:async(profile)=>{
    if(!['moderator','admin'].includes(profile.role)){
      alert('このページへのアクセス権限がありません');
      window.location.href='hub.html';
      return;
    }
    window.currentUserId=profile.id;
    
    // 界隈セレクター生成
    await buildCommunitySelector(profile.id);
    
    // データを読み込み
    await loadProfiles();
    
    // リアルタイム購読
    subscribeToProfiles();
  }
});

// 界隈セレクター
async function buildCommunitySelector(userId){
  const{data:members}=await supabase
    .from('community_members')
    .select('community_id,communities(id,name)')
    .eq('user_id',userId);
  
  const communities=(members||[]).map(m=>({id:m.community_id,name:m.communities?.name||'不明'}));
  if(communities.length===0)return;
  
  currentCommunityId=communities[0].id;
  
  const header=document.querySelector('.db-header');
  if(!header)return;
  
  const sel=document.createElement('select');
  sel.style.cssText='padding:8px 12px;border:1px solid var(--border);border-radius:6px;background:var(--bg-primary);color:var(--text-primary);font-size:14px;cursor:pointer;';
  communities.forEach(c=>{
    const opt=document.createElement('option');
    opt.value=c.id;
    opt.textContent=c.name;
    sel.appendChild(opt);
  });
  sel.addEventListener('change',async()=>{
    currentCommunityId=sel.value;
    await loadProfiles();
  });
  
  const controls=header.querySelector('.db-controls');
  if(controls)header.insertBefore(sel,controls);
}

// プロフィールデータを読み込み
async function loadProfiles(){
  try{
    // 界隈メンバーのIDを取得
    let memberIds=null;
    if(currentCommunityId){
      const{data:members}=await supabase
        .from('community_members')
        .select('user_id')
        .eq('community_id',currentCommunityId);
      memberIds=(members||[]).map(m=>m.user_id);
    }
    
    let query=supabase.from('profiles').select('*').order('created_at',{ascending:false});
    if(memberIds&&memberIds.length>0){
      query=query.in('id',memberIds);
    }
    
    const{data:profiles,error}=await query;
    
    if(error)throw error;
    
    allProfiles=profiles||[];
    displayProfiles();
  }catch(error){
    console.error('データ読み込みエラー:',error);
    document.getElementById('data-tbody').innerHTML=`
      <tr>
        <td colspan="20" style="text-align:center;padding:40px;color:#cf222e;">
          読み込みに失敗しました: ${error.message}
        </td>
      </tr>
    `;
  }
}

// リアルタイム購読
function subscribeToProfiles(){
  supabase
    .channel('profiles-db-changes')
    .on('postgres_changes',{
      event:'*',
      schema:'public',
      table:'profiles'
    },async()=>{
      await loadProfiles();
    })
    .subscribe();
}

// プロフィールデータを表示
function displayProfiles(){
  const tbody=document.getElementById('data-tbody');
  
  if(allProfiles.length===0){
    tbody.innerHTML=`
      <tr>
        <td colspan="20" style="text-align:center;padding:40px;color:var(--text-tertiary);">
          データがありません
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML='';
  
  allProfiles.forEach(profile=>{
    const tr=document.createElement('tr');
    
    // 各カラムの値を表示
    tr.innerHTML=`
      <td><code>${profile.id}</code></td>
      <td><strong>${profile.user_id}</strong></td>
      <td>${profile.display_name}</td>
      <td>${profile.last_name||'-'}</td>
      <td>${profile.first_name||'-'}</td>
      <td>${profile.role}</td>
      <td>${profile.is_online?'<span style="color:#2da44e;">●</span>':'<span style="color:#8b949e;">○</span>'}</td>
      <td>${formatDate(profile.last_online)}</td>
      <td>${profile.avatar_url?'<a href="'+profile.avatar_url+'" target="_blank">URL</a>':'-'}</td>
      <td>${profile.avatar_color||'-'}</td>
      <td>${formatDate(profile.created_at)}</td>
      <td>${formatDate(profile.updated_at)}</td>
      <td>
        ${profile.id!=='${currentUserId}'?`<button onclick="deleteUser('${profile.id}','${profile.display_name}')" style="padding:4px 10px;background:#ef4444;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;">削除</button>`:''}
      </td>
    \`;
    
    tbody.appendChild(tr);
  });
  
  // 件数を更新
  document.getElementById('total-count').textContent=allProfiles.length;
}

// 日時フォーマット
function formatDate(dateStr){
  if(!dateStr)return'-';
  const date=new Date(dateStr);
  return date.toLocaleString('ja-JP',{
    year:'numeric',
    month:'2-digit',
    day:'2-digit',
    hour:'2-digit',
    minute:'2-digit',
    second:'2-digit'
  });
}

// 更新ボタン
document.getElementById('refresh-btn').addEventListener('click',()=>{
  loadProfiles();
});

// ユーザー削除
async function deleteUser(userId,displayName){
  if(!confirm(`「${displayName}」を削除しますか？\nこの操作は取り消せません。`))return;

  try{
    const{data:{session}}=await supabase.auth.getSession();
    const res=await fetch('https://hkdwcsosegaymdknpwon.supabase.co/functions/v1/delete-user',{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'authorization':`Bearer ${session.access_token}`
      },
      body:JSON.stringify({target_id:userId})
    });
    const json=await res.json();
    if(!res.ok)throw new Error(json.error||'削除失敗');
    await loadProfiles();
  }catch(e){
    alert('削除に失敗しました: '+e.message);
  }
}
window.deleteUser=deleteUser;