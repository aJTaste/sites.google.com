import{initPage}from'../common/core.js';
import{database}from'../common/core.js';
import{ref,get,update,onValue}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import{checkPermission,getRoleDisplayName,getRoleBadge}from'../common/permissions.js';

let allUsers=[];
let selectedAccountId=null;
let currentUserRole=null;

// ページ初期化（core.jsで権限チェック済み）
const userData=await initPage('admin','管理者パネル',{
  onUserLoaded:(data)=>{
    currentUserRole=data.role;
    
    // ユーザー一覧を読み込み
    loadUsers();
  }
});

// ユーザー一覧を読み込み
function loadUsers(){
  const usersRef=ref(database,'users');
  onValue(usersRef,(snapshot)=>{
    if(snapshot.exists()){
      const users=snapshot.val();
      allUsers=Object.keys(users).map(accountId=>({
        accountId:accountId,
        ...users[accountId]
      }));
      
      displayUsers(allUsers);
    }
  });
}

// ユーザーを表示
function displayUsers(users){
  const userList=document.getElementById('user-list');
  userList.innerHTML='';
  
  // 権限順にソート（admin > moderator > user）
  const roleOrder={admin:3,moderator:2,user:1};
  users.sort((a,b)=>roleOrder[b.role||'user']-roleOrder[a.role||'user']);
  
  users.forEach(user=>{
    const userItem=document.createElement('div');
    userItem.className='user-item';
    
    const iconUrl=user.iconUrl&&user.iconUrl!=='default'?user.iconUrl:'assets/github-mark.svg';
    const createdDate=new Date(user.createdAt).toLocaleDateString('ja-JP');
    
    // 管理者のみ権限変更ボタンを表示
    let actionsHTML='';
    if(checkPermission(currentUserRole,'change_user_role')){
      actionsHTML=`
        <div class="user-item-actions">
          <button class="btn-secondary btn-small" onclick="openRoleModal('${user.accountId}')">
            権限変更
          </button>
        </div>
      `;
    }
    
    userItem.innerHTML=`
      <div class="user-item-icon">
        <img src="${iconUrl}" alt="${user.username}">
      </div>
      <div class="user-item-info">
        <div class="user-item-name">
          ${user.username}
          ${getRoleBadge(user.role||'user')}
        </div>
        <div class="user-item-id">@${user.accountId}</div>
        <div class="user-item-meta">登録日: ${createdDate}</div>
      </div>
      ${actionsHTML}
    `;
    
    userList.appendChild(userItem);
  });
}

// 検索機能
document.getElementById('search-user').addEventListener('input',(e)=>{
  const query=e.target.value.toLowerCase().trim();
  
  if(query===''){
    displayUsers(allUsers);
    return;
  }
  
  const filtered=allUsers.filter(user=>
    user.username.toLowerCase().includes(query)||
    user.accountId.toLowerCase().includes(query)
  );
  
  displayUsers(filtered);
});

// 権限変更モーダルを開く
window.openRoleModal=function(accountId){
  // 管理者のみモーダルを開ける
  if(!checkPermission(currentUserRole,'change_user_role')){
    alert('権限変更の権限がありません');
    return;
  }
  
  const user=allUsers.find(u=>u.accountId===accountId);
  if(!user)return;
  
  selectedAccountId=accountId;
  
  const modal=document.getElementById('role-modal');
  const modalUserIcon=document.getElementById('modal-user-icon');
  const modalUsername=document.getElementById('modal-username');
  const modalAccountId=document.getElementById('modal-account-id');
  const roleSelect=document.getElementById('role-select');
  
  const iconUrl=user.iconUrl&&user.iconUrl!=='default'?user.iconUrl:'assets/github-mark.svg';
  modalUserIcon.src=iconUrl;
  modalUsername.textContent=user.username;
  modalAccountId.textContent='@'+user.accountId;
  roleSelect.value=user.role||'user';
  
  modal.classList.add('show');
}

// モーダルを閉じる
function closeModal(){
  document.getElementById('role-modal').classList.remove('show');
  selectedAccountId=null;
}

document.getElementById('modal-close').addEventListener('click',closeModal);
document.getElementById('modal-cancel').addEventListener('click',closeModal);

// モーダルの外側をクリックで閉じる
document.getElementById('role-modal').addEventListener('click',(e)=>{
  if(e.target.id==='role-modal'){
    closeModal();
  }
});

// 権限を保存
document.getElementById('modal-save').addEventListener('click',async()=>{
  if(!selectedAccountId)return;
  
  const roleSelect=document.getElementById('role-select');
  const newRole=roleSelect.value;
  
  try{
    await update(ref(database,`users/${selectedAccountId}`),{
      role:newRole
    });
    
    alert('権限を変更しました');
    closeModal();
  }catch(error){
    console.error(error);
    alert('権限の変更に失敗しました');
  }
});