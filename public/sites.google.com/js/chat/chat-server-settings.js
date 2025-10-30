import{database}from'../../common/firebase-config.js';
import{ref,get,update,remove}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import{getServerRoleDisplayName}from'../../common/permissions.js';

let currentUser=null;
let currentServerId=null;
let currentServerData=null;

export function initServerSettings(user){
  currentUser=user;
  setupServerSettingsModal();
}

// サーバー設定モーダルのセットアップ
function setupServerSettingsModal(){
  const modal=document.getElementById('server-settings-modal');
  const closeBtn=document.getElementById('close-settings-modal');
  const saveBtn=document.getElementById('save-settings-btn');
  const leaveBtn=document.getElementById('leave-server-btn');
  const deleteBtn=document.getElementById('delete-server-btn');
  
  if(!closeBtn)return;
  
  closeBtn.addEventListener('click',()=>{
    modal.classList.remove('show');
  });
  
  saveBtn.addEventListener('click',saveServerSettings);
  leaveBtn.addEventListener('click',leaveServer);
  deleteBtn.addEventListener('click',deleteServer);
  
  modal.addEventListener('click',(e)=>{
    if(e.target===modal){
      modal.classList.remove('show');
    }
  });
}

// サーバー設定を開く
window.openServerSettingsModal=async function(serverId,server){
  currentServerId=serverId;
  currentServerData=server;
  
  const modal=document.getElementById('server-settings-modal');
  const nameInput=document.getElementById('settings-server-name');
  const codeDisplay=document.getElementById('settings-invite-code');
  const membersList=document.getElementById('settings-members-list');
  const leaveBtn=document.getElementById('leave-server-btn');
  const deleteBtn=document.getElementById('delete-server-btn');
  
  // サーバー情報を表示
  nameInput.value=server.name;
  codeDisplay.textContent=server.inviteCode||'なし';
  
  // ユーザーの役割を確認
  const userRole=server.members[currentUser.uid]?.role||'member';
  
  // サーバー主のみ削除ボタン表示
  if(userRole==='server_owner'){
    deleteBtn.style.display='block';
    nameInput.disabled=false;
  }else{
    deleteBtn.style.display='none';
    nameInput.disabled=true;
  }
  
  // メンバー一覧を表示
  membersList.innerHTML='<div style="padding:8px;color:var(--text-secondary);font-size:12px;">読み込み中...</div>';
  
  const members=server.members||{};
  const memberElements=[];
  
  for(const uid of Object.keys(members)){
    try{
      const userRef=ref(database,`users/${uid}`);
      const userSnapshot=await get(userRef);
      if(userSnapshot.exists()){
        const userData=userSnapshot.val();
        const memberRole=members[uid].role||'member';
        const iconUrl=userData.iconUrl&&userData.iconUrl!=='default'?userData.iconUrl:'assets/school.png';
        
        memberElements.push(`
          <div class="member-item">
            <img src="${iconUrl}" alt="${userData.username}">
            <div class="member-info">
              <div class="member-name">${userData.username}</div>
              <div class="member-role">${getServerRoleDisplayName(memberRole)}</div>
            </div>
          </div>
        `);
      }
    }catch(error){
      console.error('Failed to load member:',error);
    }
  }
  
  membersList.innerHTML=memberElements.length>0?memberElements.join(''):'<div style="padding:8px;color:var(--text-secondary);font-size:12px;">メンバーがいません</div>';
  
  modal.classList.add('show');
}

// サーバー設定を保存
async function saveServerSettings(){
  if(!currentServerId)return;
  
  const nameInput=document.getElementById('settings-server-name');
  const name=nameInput.value.trim();
  
  if(!name){
    alert('サーバー名を入力してください');
    return;
  }
  
  try{
    await update(ref(database,`servers/${currentServerId}`),{
      name:name
    });
    
    alert('設定を保存しました');
    document.getElementById('server-settings-modal').classList.remove('show');
  }catch(error){
    console.error(error);
    alert('設定の保存に失敗しました');
  }
}

// サーバーから退出
async function leaveServer(){
  if(!currentServerId)return;
  
  // サーバー主は退出できない
  const userRole=currentServerData.members[currentUser.uid]?.role;
  if(userRole==='server_owner'){
    alert('サーバー主は退出できません。サーバーを削除してください。');
    return;
  }
  
  if(!confirm('このサーバーから退出しますか？')){
    return;
  }
  
  try{
    await remove(ref(database,`servers/${currentServerId}/members/${currentUser.uid}`));
    
    alert('サーバーから退出しました');
    document.getElementById('server-settings-modal').classList.remove('show');
    document.getElementById('server-rooms-section').style.display='none';
  }catch(error){
    console.error(error);
    alert('退出に失敗しました');
  }
}

// サーバーを削除
async function deleteServer(){
  if(!currentServerId)return;
  
  if(!confirm('このサーバーを完全に削除しますか？\nすべてのチャンネルとメッセージが削除されます。')){
    return;
  }
  
  const confirmText=prompt('削除するには「削除」と入力してください');
  if(confirmText!=='削除'){
    return;
  }
  
  try{
    // サーバー、チャンネル、メッセージを削除
    await remove(ref(database,`servers/${currentServerId}`));
    await remove(ref(database,`serverRooms/${currentServerId}`));
    await remove(ref(database,`serverMessages/${currentServerId}`));
    
    alert('サーバーを削除しました');
    document.getElementById('server-settings-modal').classList.remove('show');
    document.getElementById('server-rooms-section').style.display='none';
  }catch(error){
    console.error(error);
    alert('削除に失敗しました');
  }
}