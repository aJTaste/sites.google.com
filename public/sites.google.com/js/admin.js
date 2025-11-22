import{auth,database}from'../common/firebase-config.js';
import{onAuthStateChanged,signOut}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import{ref,get,update,onValue}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import{checkPermission,getRoleDisplayName,getRoleBadge}from'../common/permissions.js';

let currentAccountId=null;
let currentUserData=null;
let allUsers=[];
let selectedAccountId=null;

// ログイン状態チェック
onAuthStateChanged(auth,async(user)=>{
  if(!user){
    window.location.href='login.html';
    return;
  }
  
  // Firebase AuthのUIDからアカウントIDを取得
  const usersRef=ref(database,'users');
  const usersSnapshot=await get(usersRef);
  
  if(!usersSnapshot.exists()){
    alert('ユーザーデータが見つかりません');
    await signOut(auth);
    window.location.href='login.html';
    return;
  }
  
  const users=usersSnapshot.val();
  
  // UIDからアカウントIDを検索
  for(const accountId in users){
    if(users[accountId].uid===user.uid){
      currentAccountId=accountId;
      currentUserData=users[accountId];
      break;
    }
  }
  
  if(!currentAccountId||!currentUserData){
    alert('アカウント情報が見つかりません');
    await signOut(auth);
    window.location.href='login.html';
    return;
  }
  
  // 管理者権限チェック
  if(!checkPermission(currentUserData.role,'view_admin_panel')){
    alert('このページへのアクセス権限がありません');
    window.location.href='index.html';
    return;
  }
  
  // アイコン表示
  const userAvatar=document.getElementById('user-avatar');
  if(currentUserData.iconUrl&&currentUserData.iconUrl!=='default'){
    userAvatar.src=currentUserData.iconUrl;
  }
  
  // ユーザー一覧を読み込み
  loadUsers();
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
  
  // 権限順にソート（owner > moderator > verified > user）
  const roleOrder={owner:4,moderator:3,verified:2,user:1};
  users.sort((a,b)=>roleOrder[b.role||'user']-roleOrder[a.role||'user']);
  
  users.forEach(user=>{
    const userItem=document.createElement('div');
    userItem.className='user-item';
    
    const iconUrl=user.iconUrl&&user.iconUrl!=='default'?user.iconUrl:'assets/github-mark.svg';
    const createdDate=new Date(user.createdAt).toLocaleDateString('ja-JP');
    
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
      <div class="user-item-actions">
        <button class="btn-secondary btn-small" onclick="openRoleModal('${user.accountId}')">
          権限変更
        </button>
      </div>
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

// ユーザーメニュー
const userBtn=document.getElementById('user-btn');
const userDropdown=document.getElementById('user-dropdown');

userBtn.addEventListener('click',(e)=>{
  e.stopPropagation();
  userDropdown.classList.toggle('show');
});

document.addEventListener('click',()=>{
  userDropdown.classList.remove('show');
});

document.getElementById('profile-btn').addEventListener('click',()=>{
  window.location.href='profile.html';
});

document.getElementById('settings-btn').addEventListener('click',()=>{
  window.location.href='settings.html';
});

document.getElementById('logout-btn').addEventListener('click',async()=>{
  try{
    await signOut(auth);
    window.location.href='login.html';
  }catch(error){
    console.error(error);
    alert('ログアウトに失敗しました');
  }
});