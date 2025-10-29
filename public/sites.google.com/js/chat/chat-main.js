import{auth,database}from'../../common/firebase-config.js';
import{onAuthStateChanged,signOut}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import{ref,get,set,push,onValue,remove}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import{checkPermission,getRoleBadge}from'../../common/permissions.js';
import{initServers}from'./chat-servers.js';

let currentUser=null;
let currentUserData=null;
let currentRoom='room_1';

// ログイン状態チェック
onAuthStateChanged(auth,async(user)=>{
  if(!user){
    window.location.href='login.html';
    return;
  }
  
  currentUser=user;
  
  const userRef=ref(database,`users/${user.uid}`);
  const snapshot=await get(userRef);
  
  if(snapshot.exists()){
    currentUserData=snapshot.val();
    const userAvatar=document.getElementById('user-avatar');
    if(currentUserData.iconUrl&&currentUserData.iconUrl!=='default'){
      userAvatar.src=currentUserData.iconUrl;
    }
    
    // サーバー機能を初期化
    initServers(currentUser,currentUserData);
  }
  
  // 初期化
  await initializeRooms();
  loadRoomList();
  loadMessages(currentRoom);
});

// Room1〜Room10を初期化
async function initializeRooms(){
  const roomsRef=ref(database,'rooms');
  const snapshot=await get(roomsRef);
  
  if(!snapshot.exists()){
    for(let i=1;i<=10;i++){
      await set(ref(database,`rooms/room_${i}`),{
        name:`Room${i}`,
        type:'public',
        createdAt:Date.now()
      });
    }
  }
}

// ルーム一覧を表示
function loadRoomList(){
  const roomListEl=document.getElementById('room-list');
  roomListEl.innerHTML='';
  
  const roomsRef=ref(database,'rooms');
  onValue(roomsRef,(snapshot)=>{
    roomListEl.innerHTML='';
    if(snapshot.exists()){
      const rooms=snapshot.val();
      Object.keys(rooms).sort().forEach(roomId=>{
        const room=rooms[roomId];
        const roomItem=document.createElement('div');
        roomItem.className='room-item'+(roomId===currentRoom?' active':'');
        roomItem.innerHTML=`
          <span class="material-icons">tag</span>
          <span>${room.name}</span>
        `;
        roomItem.onclick=()=>switchRoom(roomId,room.name);
        roomListEl.appendChild(roomItem);
      });
    }
  });
}

// ルームを切り替え
function switchRoom(roomId,roomName){
  currentRoom=roomId;
  document.getElementById('current-room-name').textContent=roomName;
  
  document.querySelectorAll('.room-item').forEach(item=>{
    item.classList.remove('active');
  });
  event.target.closest('.room-item').classList.add('active');
  
  loadMessages(roomId);
}

// メッセージを読み込み
function loadMessages(roomId){
  const messagesEl=document.getElementById('chat-messages');
  const messagesRef=ref(database,`messages/${roomId}`);
  
  onValue(messagesRef,(snapshot)=>{
    messagesEl.innerHTML='';
    if(snapshot.exists()){
      const messages=snapshot.val();
      Object.keys(messages).forEach(msgId=>{
        const msg=messages[msgId];
        displayMessage(msgId,msg);
      });
      messagesEl.scrollTop=messagesEl.scrollHeight;
    }
  });
}

// メッセージを表示
async function displayMessage(msgId,msg){
  const messagesEl=document.getElementById('chat-messages');
  const messageDiv=document.createElement('div');
  messageDiv.className='message';
  messageDiv.dataset.msgId=msgId;
  
  const time=new Date(msg.timestamp).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});
  const iconUrl=msg.iconUrl&&msg.iconUrl!=='default'?msg.iconUrl:'assets/school.png';
  
  const isOwn=currentUser&&msg.userId===currentUser.uid;
  
  // メッセージ送信者の権限を取得してバッジを表示
  let userRole='user';
  try{
    const userRef=ref(database,`users/${msg.userId}`);
    const userSnapshot=await get(userRef);
    if(userSnapshot.exists()){
      userRole=userSnapshot.val().role||'user';
    }
  }catch(error){
    console.error('Failed to get user role:',error);
  }
  
  const roleBadge=getRoleBadge(userRole);
  
  // 削除ボタンの表示条件
  const canDelete=isOwn||checkPermission(currentUserData?.role,'delete_any_message');
  
  messageDiv.innerHTML=`
    <div class="message-avatar">
      <img src="${iconUrl}" alt="${msg.username}">
    </div>
    <div class="message-content">
      <div class="message-header">
        <span class="message-username">${escapeHtml(msg.username)}${roleBadge}</span>
        <span class="message-time">${time}</span>
      </div>
      <div class="message-text">${escapeHtml(msg.text)}</div>
      ${canDelete?`
        <div class="message-actions">
          <button class="message-action-btn" onclick="deleteMessage('${msgId}')">削除</button>
        </div>
      `:''}
    </div>
  `;
  
  messagesEl.appendChild(messageDiv);
}

// メッセージ送信
document.getElementById('send-btn').addEventListener('click',sendMessage);
document.getElementById('message-input').addEventListener('keypress',(e)=>{
  if(e.key==='Enter'){
    sendMessage();
  }
});

async function sendMessage(){
  const input=document.getElementById('message-input');
  const text=input.value.trim();
  
  if(!text||!currentUser||!currentUserData)return;
  
  const messagesRef=ref(database,`messages/${currentRoom}`);
  await push(messagesRef,{
    userId:currentUser.uid,
    username:currentUserData.username,
    iconUrl:currentUserData.iconUrl||'default',
    text:text,
    timestamp:Date.now()
  });
  
  input.value='';
}

// メッセージ削除
window.deleteMessage=async function(msgId){
  if(!confirm('このメッセージを削除しますか？'))return;
  
  const msgRef=ref(database,`messages/${currentRoom}/${msgId}`);
  await remove(msgRef);
}

// HTMLエスケープ
function escapeHtml(text){
  const div=document.createElement('div');
  div.textContent=text;
  return div.innerHTML;
}

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