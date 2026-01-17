import{initPage,supabase}from'../common/core.js';

let allProfiles=[];

// ページ初期化（モデレーター以上のみ）
await initPage('db','Database',{
  onUserLoaded:async(profile)=>{
    if(!['moderator','admin'].includes(profile.role)){
      alert('このページへのアクセス権限がありません');
      window.location.href='hub.html';
      return;
    }
    
    // データを読み込み
    await loadProfiles();
    
    // リアルタイム購読
    subscribeToProfiles();
  }
});

// プロフィールデータを読み込み
async function loadProfiles(){
  try{
    const{data:profiles,error}=await supabase
      .from('profiles')
      .select('*')
      .order('created_at',{ascending:false});
    
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
    `;
    
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