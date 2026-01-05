import{initPage,supabase}from'../common/core.js';

// ページ初期化（モデレーター以上のみ）
await initPage('db','Database',{
  onUserLoaded:async(profile)=>{
    if(!['moderator','admin'].includes(profile.role)){
      alert('このページへのアクセス権限がありません');
      window.location.href='index.html';
      return;
    }
    
    // ユーザー一覧を読み込み
    await loadUsers();
  }
});

// ユーザー一覧を読み込み
async function loadUsers(){
  try{
    const{data:users,error}=await supabase
      .from('profiles')
      .select('*')
      .order('created_at',{ascending:false});
    
    if(error)throw error;
    
    // 統計情報を更新
    updateStats(users);
    
    // テーブルを表示
    displayUsers(users);
  }catch(error){
    console.error('ユーザー読み込みエラー:',error);
    document.getElementById('users-tbody').innerHTML=`
      <tr>
        <td colspan="6" style="text-align:center;padding:40px;color:#cf222e;">
          読み込みに失敗しました
        </td>
      </tr>
    `;
  }
}

// 統計情報を更新
function updateStats(users){
  const total=users.length;
  const online=users.filter(u=>u.is_online).length;
  const admins=users.filter(u=>u.role==='admin').length;
  
  document.getElementById('stat-total').textContent=total;
  document.getElementById('stat-online').textContent=online;
  document.getElementById('stat-admins').textContent=admins;
}

// ユーザー一覧を表示
function displayUsers(users){
  const tbody=document.getElementById('users-tbody');
  
  if(users.length===0){
    tbody.innerHTML=`
      <tr>
        <td colspan="6" style="text-align:center;padding:40px;color:var(--text-tertiary);">
          ユーザーがいません
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML='';
  
  users.forEach(user=>{
    const tr=document.createElement('tr');
    
    // アイコン表示
    let iconHtml;
    if(user.avatar_url){
      iconHtml=`<img src="${user.avatar_url}" alt="${user.display_name}">`;
    }else{
      const initial=user.display_name.charAt(0).toUpperCase();
      const bgColor=user.avatar_color||'#FF6B35';
      iconHtml=`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${bgColor};color:#fff;font-weight:600;font-size:16px;border-radius:50%;">${initial}</div>`;
    }
    
    // 権限バッジ
    const roleNames={user:'一般',moderator:'モデレーター',admin:'管理者'};
    const roleColors={user:'#6e7781',moderator:'#8c52ff',admin:'#ff6b35'};
    const roleName=roleNames[user.role]||user.role;
    const roleColor=roleColors[user.role]||'#6e7781';
    
    // ステータスバッジ
    const statusHtml=user.is_online
      ?'<span class="status-badge online"><span class="material-symbols-outlined">circle</span>オンライン</span>'
      :'<span class="status-badge offline"><span class="material-symbols-outlined">circle</span>オフライン</span>';
    
    // 姓名
    const fullName=[user.last_name,user.first_name].filter(Boolean).join(' ')||'-';
    
    // 作成日
    const createdDate=new Date(user.created_at).toLocaleDateString('ja-JP');
    
    tr.innerHTML=`
      <td>
        <div class="user-info">
          <div class="user-avatar-small">
            ${iconHtml}
          </div>
          <div>
            <div class="user-name">${user.display_name}</div>
          </div>
        </div>
      </td>
      <td><code>${user.user_id}</code></td>
      <td>${fullName}</td>
      <td><span style="color:${roleColor};font-weight:600;">${roleName}</span></td>
      <td>${statusHtml}</td>
      <td>${createdDate}</td>
    `;
    
    tbody.appendChild(tr);
  });
}

// 更新ボタン
document.getElementById('refresh-btn').addEventListener('click',()=>{
  loadUsers();
});