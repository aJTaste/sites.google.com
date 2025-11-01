import{auth,database}from'../../common/firebase-config.js';
import{onAuthStateChanged,signOut}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import{ref,get,set,push,onValue,off,query,orderByChild,limitToLast,endBefore}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import{checkPermission,getRoleBadge}from'../../common/permissions.js';
import{initServers}from'./chat-servers.js';
import{initUI}from'./chat-ui.js';
import{initServerSettings}from'./chat-server-settings.js';

let currentUser=null;
let currentUserData=null;
let currentRoom='room_1';
let currentContext='public';
let currentServerId=null;
let currentChannelId=null;

// 無限スクロール用の変数
const INITIAL_LOAD=30;
const LOAD_MORE=30;
const MAX_DISPLAYED=150;
let displayedMessages=[];
let oldestMessageKey=null;
let hasMoreOld=true;
let isLoadingOld=false;
let messagesListener=null;

// ページ読み込み完了処理
document.addEventListener('DOMContentLoaded',function(){
  if(document.fonts&&document.fonts.ready){
    document.fonts.ready.then(function(){
      document.body.classList.add('loaded');
    });
  }else{
    setTimeout(function(){
      document.body.classList.add('loaded');
    },100);
  }
});

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
    
    initServers(currentUser,currentUserData);
  }
  
  await initializeRooms();
  loadRoomList();
  loadMessages();
  initUI();
  initServerSettings(currentUser);
  setupScrollHandler();
});

// サーバーチャンネルを選択
window.selectServerChannel=function(serverId,channelId,channelName){
  currentContext='server';
  currentServerId=serverId;
  currentChannelId=channelId;
  
  document.getElementById('current-room-name').textContent=channelName;
  
  document.querySelectorAll('#server-room-list .room-item').forEach(item=>{
    item.classList.remove('active');
  });
  document.querySelectorAll('#room-list .room-item').forEach(item=>{
    item.classList.remove('active');
  });
  event.target.closest('.room-item').classList.add('active');
  
  loadMessages();
}

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
  currentContext='public';
  currentServerId=null;
  currentChannelId=null;
  
  document.getElementById('current-room-name').textContent=roomName;
  
  document.querySelectorAll('.room-item').forEach(item=>{
    item.classList.remove('active');
  });
  event.target.closest('.room-item').classList.add('active');
  
  loadMessages();
}

// メッセージを読み込み（無限スクロール対応）
function loadMessages(){
  const messagesEl=document.getElementById('chat-messages');
  
  // 既存のリスナーを解除
  if(messagesListener){
    off(messagesListener);
    messagesListener=null;
  }
  
  // 状態をリセット
  displayedMessages=[];
  oldestMessageKey=null;
  hasMoreOld=true;
  isLoadingOld=false;
  messagesEl.innerHTML='<div class="loading-initial">メッセージを読み込み中...</div>';
  
  let messagesRef;
  if(currentContext==='server'){
    messagesRef=ref(database,`serverMessages/${currentServerId}/${currentChannelId}`);
  }else{
    messagesRef=ref(database,`messages/${currentRoom}`);
  }
  
  // 初回：最新30件を取得
  const initialQuery=query(
    messagesRef,
    orderByChild('timestamp'),
    limitToLast(INITIAL_LOAD)
  );
  
  get(initialQuery).then(snapshot=>{
    messagesEl.innerHTML='';
    
    if(snapshot.exists()){
      const messages=[];
      snapshot.forEach(child=>{
        messages.push({
          key:child.key,
          ...child.val()
        });
      });
      
      displayedMessages=messages;
      
      if(messages.length>0){
        oldestMessageKey=messages[0].key;
        
        // 30件未満なら、これ以上古いメッセージはない
        if(messages.length<INITIAL_LOAD){
          hasMoreOld=false;
        }
      }
      
      renderMessages().then(()=>{
        scrollToBottom();
      });
      
      // リアルタイム更新のリスナーを設定
      setupRealtimeListener(messagesRef);
    }else{
      messagesEl.innerHTML='<div class="no-messages">まだメッセージがありません</div>';
      setupRealtimeListener(messagesRef);
    }
  }).catch(error=>{
    console.error('Failed to load messages:',error);
    messagesEl.innerHTML='<div class="error-message">メッセージの読み込みに失敗しました</div>';
  });
}

// リアルタイム更新のリスナー
function setupRealtimeListener(messagesRef){
  const latestTimestamp=displayedMessages.length>0?displayedMessages[displayedMessages.length-1].timestamp:0;
  
  messagesListener=onValue(messagesRef,(snapshot)=>{
    if(!snapshot.exists())return;
    
    const allMessages=[];
    snapshot.forEach(child=>{
      allMessages.push({
        key:child.key,
        ...child.val()
      });
    });
    
    // 既存メッセージより新しいものだけ追加
    const newMessages=allMessages.filter(msg=>
      msg.timestamp>latestTimestamp&&!displayedMessages.find(m=>m.key===msg.key)
    );
    
    if(newMessages.length>0){
      displayedMessages.push(...newMessages);
      
      // 最大表示数を超えたら古いものを削除
      if(displayedMessages.length>MAX_DISPLAYED){
        const removeCount=displayedMessages.length-MAX_DISPLAYED;
        displayedMessages.splice(0,removeCount);
        oldestMessageKey=displayedMessages[0].key;
      }
      
      const messagesEl=document.getElementById('chat-messages');
      const wasAtBottom=messagesEl.scrollHeight-messagesEl.scrollTop-messagesEl.clientHeight<100;
      
      renderMessages().then(()=>{
        if(wasAtBottom){
          scrollToBottom();
        }
      });
    }
  });
}

// メッセージを描画
async function renderMessages(){
  const messagesEl=document.getElementById('chat-messages');
  const currentScrollTop=messagesEl.scrollTop;
  const currentScrollHeight=messagesEl.scrollHeight;
  
  messagesEl.innerHTML='';
  
  // 「もっと読み込む」ボタン
  if(hasMoreOld&&displayedMessages.length>=INITIAL_LOAD){
    const loadMoreBtn=document.createElement('div');
    loadMoreBtn.className='load-more-btn';
    loadMoreBtn.textContent=isLoadingOld?'読み込み中...':'古いメッセージを読み込む';
    if(!isLoadingOld){
      loadMoreBtn.onclick=loadOlderMessages;
    }
    messagesEl.appendChild(loadMoreBtn);
  }else if(!hasMoreOld&&displayedMessages.length>0){
    const noMoreMsg=document.createElement('div');
    noMoreMsg.className='no-more-messages';
    noMoreMsg.textContent='これより古いメッセージはありません';
    messagesEl.appendChild(noMoreMsg);
  }
  
  // メッセージを表示
  for(const msg of displayedMessages){
    await displayMessage(msg);
  }
  
  // スクロール位置を維持（古いメッセージを追加した場合）
  if(currentScrollTop>0&&isLoadingOld){
    messagesEl.scrollTop=currentScrollTop+(messagesEl.scrollHeight-currentScrollHeight);
  }
}

// 古いメッセージを読み込む
async function loadOlderMessages(){
  if(isLoadingOld||!hasMoreOld||!oldestMessageKey)return;
  
  isLoadingOld=true;
  
  let messagesRef;
  if(currentContext==='server'){
    messagesRef=ref(database,`serverMessages/${currentServerId}/${currentChannelId}`);
  }else{
    messagesRef=ref(database,`messages/${currentRoom}`);
  }
  
  try{
    // 最も古いメッセージのtimestampを取得
    const oldestMsg=displayedMessages[0];
    
    const olderQuery=query(
      messagesRef,
      orderByChild('timestamp'),
      endBefore(oldestMsg.timestamp),
      limitToLast(LOAD_MORE)
    );
    
    const snapshot=await get(olderQuery);
    
    if(snapshot.exists()){
      const olderMessages=[];
      snapshot.forEach(child=>{
        olderMessages.push({
          key:child.key,
          ...child.val()
        });
      });
      
      if(olderMessages.length>0){
        displayedMessages=olderMessages.concat(displayedMessages);
        oldestMessageKey=olderMessages[0].key;
        
        // 読み込んだ件数が要求より少ない場合、これ以上ない
        if(olderMessages.length<LOAD_MORE){
          hasMoreOld=false;
        }
        
        // 最大表示数を超えたら新しいものから削除
        if(displayedMessages.length>MAX_DISPLAYED){
          displayedMessages=displayedMessages.slice(0,MAX_DISPLAYED);
        }
      }else{
        hasMoreOld=false;
      }
    }else{
      hasMoreOld=false;
    }
  }catch(error){
    console.error('Failed to load older messages:',error);
  }
  
  isLoadingOld=false;
  await renderMessages();
}

// スクロールハンドラーのセットアップ
function setupScrollHandler(){
  const messagesEl=document.getElementById('chat-messages');
  
  messagesEl.addEventListener('scroll',()=>{
    // 上端に近づいたら自動的に古いメッセージを読み込む
    if(messagesEl.scrollTop<100&&!isLoadingOld&&hasMoreOld){
      loadOlderMessages();
    }
  });
}

// 下端にスクロール
function scrollToBottom(){
  const messagesEl=document.getElementById('chat-messages');
  requestAnimationFrame(()=>{
    messagesEl.scrollTop=messagesEl.scrollHeight;
  });
}

// メッセージを表示
async function displayMessage(msg){
  const messagesEl=document.getElementById('chat-messages');
  const messageDiv=document.createElement('div');
  messageDiv.className='message';
  messageDiv.dataset.msgKey=msg.key;
  
  const date=new Date(msg.timestamp);
  const timeStr=date.toLocaleString('ja-JP',{
    month:'numeric',
    day:'numeric',
    hour:'2-digit',
    minute:'2-digit',
    second:'2-digit'
  });
  
  const iconUrl=msg.iconUrl&&msg.iconUrl!=='default'?msg.iconUrl:'assets/school.png';
  
  const isOwn=currentUser&&msg.userId===currentUser.uid;
  
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
  const canDelete=isOwn||checkPermission(currentUserData?.role,'delete_any_message');
  
  messageDiv.innerHTML=`
    <div class="message-avatar">
      <img src="${iconUrl}" alt="${msg.username}">
    </div>
    <div class="message-content">
      <div class="message-header">
        <span class="message-username">${escapeHtml(msg.username)}${roleBadge}</span>
        <span class="message-time">${timeStr}</span>
      </div>
      <div class="message-text">${escapeHtml(msg.text)}</div>
      ${canDelete?`
        <div class="message-actions">
          <button class="message-action-btn" onclick="deleteMessage('${msg.key}')">
            <span class="material-icons">delete</span>
          </button>
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
  
  const sendBtn=document.getElementById('send-btn');
  sendBtn.disabled=true;
  
  try{
    let messagesRef;
    if(currentContext==='server'){
      messagesRef=ref(database,`serverMessages/${currentServerId}/${currentChannelId}`);
    }else{
      messagesRef=ref(database,`messages/${currentRoom}`);
    }
    
    await push(messagesRef,{
      userId:currentUser.uid,
      username:currentUserData.username,
      iconUrl:currentUserData.iconUrl||'default',
      text:text,
      timestamp:Date.now()
    });
    
    input.value='';
  }catch(error){
    console.error('Failed to send message:',error);
    alert('メッセージの送信に失敗しました');
  }finally{
    sendBtn.disabled=false;
  }
}

// メッセージ削除
window.deleteMessage=async function(msgKey){
  if(!confirm('このメッセージを削除しますか？'))return;
  
  try{
    const {remove}=await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js');
    
    let msgRef;
    if(currentContext==='server'){
      msgRef=ref(database,`serverMessages/${currentServerId}/${currentChannelId}/${msgKey}`);
    }else{
      msgRef=ref(database,`messages/${currentRoom}/${msgKey}`);
    }
    
    await remove(msgRef);
    
    // 表示中のメッセージからも削除
    displayedMessages=displayedMessages.filter(m=>m.key!==msgKey);
    await renderMessages();
  }catch(error){
    console.error('Failed to delete message:',error);
    alert('メッセージの削除に失敗しました');
  }
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