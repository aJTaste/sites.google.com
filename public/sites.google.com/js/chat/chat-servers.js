import{database}from'../../common/firebase-config.js';
import{ref,set,get,push,onValue,remove}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import{checkServerPermission}from'../../common/permissions.js';

let currentUser=null;
let currentUserData=null;
let currentServerId=null;
let currentServerData=null;

// 手と指の絵文字リスト
const handEmojis=[
  '👋','🤚','🖐️','✋','🖖',
  '👌','🤌','🤏','✌️','🤞',
  '🤟','🤘','🤙','👈','👉',
  '👆','🖕','👇','☝️','👍',
  '👎','✊','👊','🤛','🤜',
  '👏','🙌','👐','🤲','🤝',
  '🙏','✍️','💅','🤳','💪'
];

export function initServers(user,userData){
  currentUser=user;
  currentUserData=userData;
  
  loadServerList();
  setupServerModal();
  setupChannelModal();
}

// サーバー一覧を読み込み
function loadServerList(){
  const serverListEl=document.getElementById('server-list');
  const serversRef=ref(database,'servers');
  
  onValue(serversRef,(snapshot)=>{
    serverListEl.innerHTML='';
    if(snapshot.exists()){
      const servers=snapshot.val();
      Object.keys(servers).forEach(serverId=>{
        const server=servers[serverId];
        
        // メンバーチェック
        if(server.members&&server.members[currentUser.uid]){
          const serverItem=document.createElement('div');
          serverItem.className='server-item';
          serverItem.innerHTML=`
            <span class="server-emoji">${server.emoji||'👋'}</span>
            <span class="server-name">${server.name}</span>
          `;
          serverItem.onclick=()=>selectServer(serverId,server);
          serverListEl.appendChild(serverItem);
        }
      });
    }
  });
}

// サーバーを選択
function selectServer(serverId,server){
  currentServerId=serverId;
  currentServerData=server;
  
  document.querySelectorAll('.server-item').forEach(item=>{
    item.classList.remove('active');
  });
  event.target.closest('.server-item').classList.add('active');
  
  // サーバーのルーム一覧を表示
  document.getElementById('server-rooms-section').style.display='block';
  document.getElementById('current-server-name').textContent=server.name;
  
  // チャンネル作成ボタンの表示制御
  const createRoomBtn=document.getElementById('create-room-btn');
  const userRole=server.members[currentUser.uid]?.role||'member';
  if(checkServerPermission(userRole,'create_channel')){
    createRoomBtn.style.display='flex';
  }else{
    createRoomBtn.style.display='none';
  }
  
  loadServerRooms(serverId);
}

// サーバー内のルームを読み込み
function loadServerRooms(serverId){
  const roomListEl=document.getElementById('server-room-list');
  const roomsRef=ref(database,`serverRooms/${serverId}`);
  
  onValue(roomsRef,(snapshot)=>{
    roomListEl.innerHTML='';
    if(snapshot.exists()){
      const rooms=snapshot.val();
      Object.keys(rooms).forEach(roomId=>{
        const room=rooms[roomId];
        const roomItem=document.createElement('div');
        roomItem.className='room-item';
        roomItem.dataset.roomId=roomId;
        roomItem.innerHTML=`
          <span class="material-icons">tag</span>
          <span>${room.name}</span>
        `;
        roomItem.onclick=()=>window.selectServerChannel(serverId,roomId,room.name);
        roomListEl.appendChild(roomItem);
      });
    }
  });
}

// サーバー作成モーダルのセットアップ
function setupServerModal(){
  const modal=document.getElementById('create-server-modal');
  const createBtn=document.getElementById('create-server-btn');
  const closeBtn=document.getElementById('close-server-modal');
  const cancelBtn=document.getElementById('cancel-server-btn');
  const submitBtn=document.getElementById('submit-server-btn');
  const emojiGrid=document.getElementById('emoji-grid');
  
  // 権限チェック
  if(createBtn){
    createBtn.addEventListener('click',()=>{
      const role=currentUserData.role;
      if(role==='owner'||role==='moderator'||role==='verified'){
        modal.classList.add('show');
        renderEmojis();
      }else{
        alert('サーバーを作成する権限がありません。\n承認済みユーザーになる必要があります。');
      }
    });
  }
  
  closeBtn.addEventListener('click',()=>{
    modal.classList.remove('show');
  });
  
  cancelBtn.addEventListener('click',()=>{
    modal.classList.remove('show');
  });
  
  submitBtn.addEventListener('click',createServer);
  
  // モーダル外クリックで閉じる
  modal.addEventListener('click',(e)=>{
    if(e.target===modal){
      modal.classList.remove('show');
    }
  });
}

// 絵文字グリッドを表示
function renderEmojis(){
  const emojiGrid=document.getElementById('emoji-grid');
  emojiGrid.innerHTML='';
  
  handEmojis.forEach(emoji=>{
    const emojiItem=document.createElement('div');
    emojiItem.className='emoji-item';
    if(emoji==='👋'){
      emojiItem.classList.add('selected');
      document.getElementById('selected-emoji').value='👋';
    }
    emojiItem.textContent=emoji;
    emojiItem.onclick=()=>{
      document.querySelectorAll('.emoji-item').forEach(item=>{
        item.classList.remove('selected');
      });
      emojiItem.classList.add('selected');
      document.getElementById('selected-emoji').value=emoji;
    };
    emojiGrid.appendChild(emojiItem);
  });
}

// サーバーを作成
async function createServer(){
  const nameInput=document.getElementById('server-name');
  const emojiInput=document.getElementById('selected-emoji');
  const privateCheckbox=document.getElementById('server-private');
  
  const name=nameInput.value.trim();
  const emoji=emojiInput.value||'👋';
  const isPrivate=privateCheckbox.checked;
  
  if(!name){
    alert('サーバー名を入力してください');
    return;
  }
  
  // 招待コード生成（プライベートの場合）
  const inviteCode=isPrivate?generateInviteCode():'';
  
  const serversRef=ref(database,'servers');
  const newServerRef=push(serversRef);
  
  await set(newServerRef,{
    name:name,
    emoji:emoji,
    ownerId:currentUser.uid,
    type:isPrivate?'private':'public',
    inviteCode:inviteCode,
    createdAt:Date.now(),
    members:{
      [currentUser.uid]:{
        role:'server_owner',
        joinedAt:Date.now()
      }
    }
  });
  
  // デフォルトルーム作成
  const serverRoomsRef=ref(database,`serverRooms/${newServerRef.key}`);
  await set(push(serverRoomsRef),{
    name:'一般',
    createdAt:Date.now()
  });
  
  // モーダルを閉じる
  document.getElementById('create-server-modal').classList.remove('show');
  nameInput.value='';
  document.getElementById('selected-emoji').value='👋';
  privateCheckbox.checked=false;
  
  if(isPrivate){
    alert(`サーバーを作成しました！\n招待コード: ${inviteCode}`);
  }
}

// 招待コード生成
function generateInviteCode(){
  const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code='';
  for(let i=0;i<6;i++){
    code+=chars.charAt(Math.floor(Math.random()*chars.length));
  }
  return code;
}

// チャンネル作成モーダルのセットアップ
function setupChannelModal(){
  const modal=document.getElementById('create-channel-modal');
  const createBtn=document.getElementById('create-room-btn');
  const closeBtn=document.getElementById('close-channel-modal');
  const cancelBtn=document.getElementById('cancel-channel-btn');
  const submitBtn=document.getElementById('submit-channel-btn');
  
  if(!createBtn)return;
  
  createBtn.addEventListener('click',()=>{
    modal.classList.add('show');
  });
  
  closeBtn.addEventListener('click',()=>{
    modal.classList.remove('show');
  });
  
  cancelBtn.addEventListener('click',()=>{
    modal.classList.remove('show');
  });
  
  submitBtn.addEventListener('click',createChannel);
  
  modal.addEventListener('click',(e)=>{
    if(e.target===modal){
      modal.classList.remove('show');
    }
  });
}

// チャンネルを作成
async function createChannel(){
  if(!currentServerId)return;
  
  const nameInput=document.getElementById('channel-name');
  const name=nameInput.value.trim();
  
  if(!name){
    alert('チャンネル名を入力してください');
    return;
  }
  
  const serverRoomsRef=ref(database,`serverRooms/${currentServerId}`);
  await set(push(serverRoomsRef),{
    name:name,
    createdAt:Date.now(),
    createdBy:currentUser.uid
  });
  
  document.getElementById('create-channel-modal').classList.remove('show');
  nameInput.value='';
  alert('チャンネルを作成しました');
}