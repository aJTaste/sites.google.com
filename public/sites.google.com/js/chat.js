import{auth,database}from'../common/firebase-config.js';
import{onAuthStateChanged,signOut}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import{ref,get,set,update,push,onValue,off}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

let currentUser=null;
let currentUserData=null;
let allUsers=[];
let selectedUserId=null;
let selectedChannelId=null;
let messageListener=null;
let isSending=false;
let unreadCounts={};
let lastOnlineUpdateInterval=null;
let notificationPermissionGranted=false;
let selectedImage=null; // 添付予定の画像

// 共有チャンネル定義
const CHANNELS=[
  {id:'general',name:'全体連絡',desc:'重要なお知らせ',icon:'campaign'},
  {id:'random',name:'雑談',desc:'自由に話そう',icon:'chat_bubble'},
  {id:'tech',name:'技術相談',desc:'開発の質問など',icon:'code'}
];

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
    
    const updates={};
    if(currentUserData.online===undefined){
      updates.online=true;
    }
    if(currentUserData.lastOnline===undefined){
      updates.lastOnline=Date.now();
    }
    
    if(Object.keys(updates).length>0){
      await update(userRef,updates);
      currentUserData={...currentUserData,...updates};
    }
    
    await update(userRef,{
      online:true,
      lastOnline:Date.now()
    });
    
    window.addEventListener('beforeunload',async()=>{
      await update(userRef,{
        online:false,
        lastOnline:Date.now()
      });
    });
    
    // 通知権限をリクエスト
    requestNotificationPermission();
    
    loadUsers();
    startLastOnlineUpdateTimer();
  }
});

// 通知権限をリクエスト
async function requestNotificationPermission(){
  if('Notification'in window){
    if(Notification.permission==='default'){
      const permission=await Notification.requestPermission();
      notificationPermissionGranted=(permission==='granted');
    }else if(Notification.permission==='granted'){
      notificationPermissionGranted=true;
    }
  }
}

// 通知を表示
function showNotification(title,body,icon){
  // タブを開いているが、別のタブを見ている時のみ通知
  if(notificationPermissionGranted&&document.hidden){
    new Notification(title,{
      body:body,
      icon:icon||'assets/favicon-main.png',
      tag:'chat-message'
    });
  }
}

// タブタイトルに未読件数を表示
function updatePageTitle(){
  const totalUnread=Object.values(unreadCounts).reduce((sum,count)=>sum+count,0);
  if(totalUnread>0){
    document.title=`(${totalUnread}) チャット | AppHub`;
  }else{
    document.title='チャット | AppHub';
  }
}

// 最終ログイン時刻の定期更新
function startLastOnlineUpdateTimer(){
  if(lastOnlineUpdateInterval){
    clearInterval(lastOnlineUpdateInterval);
  }
  lastOnlineUpdateInterval=setInterval(()=>{
    displayUsers();
  },1000);
}

// ユーザー一覧を読み込み
function loadUsers(){
  const usersRef=ref(database,'users');
  onValue(usersRef,(snapshot)=>{
    if(snapshot.exists()){
      const users=snapshot.val();
      allUsers=Object.keys(users)
        .filter(uid=>uid!==currentUser.uid)
        .map(uid=>({
          uid:uid,
          ...users[uid]
        }));
      
      calculateUnreadCounts().then(()=>{
        displayUsers();
        updatePageTitle();
      });
    }
  });
}

// 未読件数を計算
async function calculateUnreadCounts(){
  unreadCounts={};
  
  const lastReadRef=ref(database,`users/${currentUser.uid}/lastRead`);
  const lastReadSnapshot=await get(lastReadRef);
  const lastReadData=lastReadSnapshot.exists()?lastReadSnapshot.val():{};
  
  // DM の未読
  for(const user of allUsers){
    const dmId=getDmId(currentUser.uid,user.uid);
    const messagesRef=ref(database,`dms/${dmId}/messages`);
    const messagesSnapshot=await get(messagesRef);
    
    if(messagesSnapshot.exists()){
      const messages=messagesSnapshot.val();
      const lastReadTime=lastReadData[user.uid]||0;
      
      const unreadCount=Object.values(messages).filter(msg=>
        msg.senderId===user.uid&&msg.timestamp>lastReadTime
      ).length;
      
      unreadCounts[user.uid]=unreadCount;
    }else{
      unreadCounts[user.uid]=0;
    }
  }
  
  // チャンネルの未読
  for(const channel of CHANNELS){
    const messagesRef=ref(database,`channels/${channel.id}/messages`);
    const messagesSnapshot=await get(messagesRef);
    
    if(messagesSnapshot.exists()){
      const messages=messagesSnapshot.val();
      const lastReadTime=lastReadData[channel.id]||0;
      
      const unreadCount=Object.values(messages).filter(msg=>
        msg.senderId!==currentUser.uid&&msg.timestamp>lastReadTime
      ).length;
      
      unreadCounts[channel.id]=unreadCount;
    }else{
      unreadCounts[channel.id]=0;
    }
  }
}

// ユーザー一覧を表示
function displayUsers(){
  const dmList=document.getElementById('dm-list');
  dmList.innerHTML='';
  
  // チャンネルを追加
  CHANNELS.forEach(channel=>{
    const channelItem=document.createElement('div');
    channelItem.className='channel-item';
    if(selectedChannelId===channel.id){
      channelItem.classList.add('active');
    }
    
    const unreadCount=unreadCounts[channel.id]||0;
    const unreadBadge=unreadCount>0?`<span class="unread-badge">${unreadCount}</span>`:'';
    
    channelItem.innerHTML=`
      <div class="channel-icon">
        <span class="material-icons">${channel.icon}</span>
      </div>
      <div class="channel-info">
        <div class="channel-name">
          ${channel.name}
          ${unreadBadge}
        </div>
        <div class="channel-desc">${channel.desc}</div>
      </div>
    `;
    
    channelItem.addEventListener('click',()=>{
      selectChannel(channel.id);
    });
    
    dmList.appendChild(channelItem);
  });
  
  // 区切り線
  const divider=document.createElement('div');
  divider.style.cssText='height:1px;background:var(--border);margin:8px 0;';
  dmList.appendChild(divider);
  
  // 最終ログイン時刻でソート（新しい順）
  allUsers.sort((a,b)=>{
    const aTime=a.lastOnline||a.createdAt||0;
    const bTime=b.lastOnline||b.createdAt||0;
    return bTime-aTime;
  });
  
  allUsers.forEach(user=>{
    const dmItem=document.createElement('div');
    dmItem.className='dm-item';
    if(selectedUserId===user.uid){
      dmItem.classList.add('active');
    }
    
    const iconUrl=user.iconUrl&&user.iconUrl!=='default'?user.iconUrl:'assets/school.png';
    const isOnline=user.online||false;
    const onlineIndicator=isOnline?'<div class="online-indicator"></div>':'';
    const statusText=isOnline?'オンライン':`最終: ${formatLastOnline(user.lastOnline||user.createdAt)}`;
    
    const unreadCount=unreadCounts[user.uid]||0;
    const unreadBadge=unreadCount>0?`<span class="unread-badge">${unreadCount}</span>`:'';
    
    dmItem.innerHTML=`
      <div class="dm-item-avatar">
        <img src="${iconUrl}" alt="${user.username}">
        ${onlineIndicator}
      </div>
      <div class="dm-item-info">
        <div class="dm-item-name">
          ${user.username}
          ${unreadBadge}
        </div>
        <div class="dm-item-status">${statusText}</div>
      </div>
    `;
    
    dmItem.addEventListener('click',()=>{
      selectUser(user.uid);
    });
    
    dmList.appendChild(dmItem);
  });
}

// ユーザーを選択
async function selectUser(userId){
  selectedUserId=userId;
  selectedChannelId=null;
  
  await update(ref(database,`users/${currentUser.uid}/lastRead`),{
    [userId]:Date.now()
  });
  
  unreadCounts[userId]=0;
  updatePageTitle();
  
  displayUsers();
  loadChat(userId);
}

// チャンネルを選択
async function selectChannel(channelId){
  selectedChannelId=channelId;
  selectedUserId=null;
  
  await update(ref(database,`users/${currentUser.uid}/lastRead`),{
    [channelId]:Date.now()
  });
  
  unreadCounts[channelId]=0;
  updatePageTitle();
  
  displayUsers();
  loadChannelChat(channelId);
}

// チャットを読み込み（DM）
function loadChat(userId){
  const chatMain=document.getElementById('chat-main');
  const selectedUser=allUsers.find(u=>u.uid===userId);
  
  if(!selectedUser)return;
  
  const iconUrl=selectedUser.iconUrl&&selectedUser.iconUrl!=='default'?selectedUser.iconUrl:'assets/school.png';
  const isOnline=selectedUser.online||false;
  const statusText=isOnline?'オンライン':`最終: ${formatLastOnline(selectedUser.lastOnline||selectedUser.createdAt)}`;
  
  chatMain.innerHTML=`
    <div class="chat-header">
      <div class="chat-header-user">
        <div class="chat-header-avatar">
          <img src="${iconUrl}" alt="${selectedUser.username}">
        </div>
        <div class="chat-header-info">
          <div class="chat-header-name">${selectedUser.username}</div>
          <div class="chat-header-status">${statusText}</div>
        </div>
      </div>
    </div>
    <div class="chat-messages" id="chat-messages">
      <div class="loading">
        <div class="loading-spinner"></div>
        <div class="loading-text">メッセージを読み込み中...</div>
      </div>
    </div>
    <div class="chat-input-container">
      <div class="image-preview-container" id="image-preview-container">
        <button class="image-preview-close" id="image-preview-close">
          <span class="material-icons">close</span>
        </button>
        <img class="image-preview" id="image-preview" src="" alt="画像プレビュー">
      </div>
      <div class="chat-input-actions">
        <input type="file" id="image-file-input" accept="image/*" hidden>
        <button class="action-btn" id="attach-image-btn" title="画像を添付">
          <span class="material-icons">image</span>
        </button>
        <button class="action-btn" id="attach-file-btn" title="ファイルを添付（準備中）" disabled>
          <span class="material-icons">attach_file</span>
        </button>
      </div>
      <div class="chat-input-wrapper">
        <textarea class="chat-input" id="chat-input" placeholder="${selectedUser.username} にメッセージを送信" rows="1"></textarea>
        <button class="send-btn" id="send-btn">
          <span class="material-icons">send</span>
        </button>
      </div>
    </div>
  `;
  
  setupChatInput();
  loadMessages(userId);
}

// チャットを読み込み（チャンネル）
function loadChannelChat(channelId){
  const chatMain=document.getElementById('chat-main');
  const channel=CHANNELS.find(c=>c.id===channelId);
  
  if(!channel)return;
  
  chatMain.innerHTML=`
    <div class="chat-header">
      <div class="chat-header-user">
        <div class="channel-icon" style="width:36px;height:36px;">
          <span class="material-icons">${channel.icon}</span>
        </div>
        <div class="chat-header-info">
          <div class="chat-header-name">${channel.name}</div>
          <div class="chat-header-status">${channel.desc}</div>
        </div>
      </div>
    </div>
    <div class="chat-messages" id="chat-messages">
      <div class="loading">
        <div class="loading-spinner"></div>
        <div class="loading-text">メッセージを読み込み中...</div>
      </div>
    </div>
    <div class="chat-input-container">
      <div class="image-preview-container" id="image-preview-container">
        <button class="image-preview-close" id="image-preview-close">
          <span class="material-icons">close</span>
        </button>
        <img class="image-preview" id="image-preview" src="" alt="画像プレビュー">
      </div>
      <div class="chat-input-actions">
        <input type="file" id="image-file-input" accept="image/*" hidden>
        <button class="action-btn" id="attach-image-btn" title="画像を添付">
          <span class="material-icons">image</span>
        </button>
        <button class="action-btn" id="attach-file-btn" title="ファイルを添付（準備中）" disabled>
          <span class="material-icons">attach_file</span>
        </button>
      </div>
      <div class="chat-input-wrapper">
        <textarea class="chat-input" id="chat-input" placeholder="${channel.name} にメッセージを送信" rows="1"></textarea>
        <button class="send-btn" id="send-btn">
          <span class="material-icons">send</span>
        </button>
      </div>
    </div>
  `;
  
  setupChatInput();
  loadChannelMessages(channelId);
}

// チャット入力のセットアップ
function setupChatInput(){
  const chatInput=document.getElementById('chat-input');
  chatInput.addEventListener('input',()=>{
    chatInput.style.height='auto';
    chatInput.style.height=chatInput.scrollHeight+'px';
  });
  
  chatInput.addEventListener('keydown',(e)=>{
    if(e.key==='Enter'&&!e.shiftKey){
      e.preventDefault();
      if(!isSending){
        sendMessage();
      }
    }
  });
  
  // クリップボードから画像を貼り付け
  chatInput.addEventListener('paste',(e)=>{
    const items=e.clipboardData.items;
    for(let i=0;i<items.length;i++){
      if(items[i].type.indexOf('image')!==-1){
        const file=items[i].getAsFile();
        handleImageFile(file);
        e.preventDefault();
        break;
      }
    }
  });
  
  document.getElementById('send-btn').addEventListener('click',()=>{
    if(!isSending){
      sendMessage();
    }
  });
  
  // 画像添付ボタン
  const attachImageBtn=document.getElementById('attach-image-btn');
  const imageFileInput=document.getElementById('image-file-input');
  
  attachImageBtn.addEventListener('click',()=>{
    imageFileInput.click();
  });
  
  imageFileInput.addEventListener('change',(e)=>{
    const file=e.target.files[0];
    if(file){
      handleImageFile(file);
    }
  });
  
  // 画像プレビュー削除
  document.getElementById('image-preview-close').addEventListener('click',()=>{
    selectedImage=null;
    document.getElementById('image-preview-container').classList.remove('show');
  });
}

// 画像ファイルを処理
function handleImageFile(file){
  if(!file.type.startsWith('image/')){
    alert('画像ファイルを選択してください');
    return;
  }
  
  if(file.size>2*1024*1024){
    alert('画像サイズは2MB以下にしてください');
    return;
  }
  
  const reader=new FileReader();
  reader.onload=(e)=>{
    selectedImage=e.target.result;
    document.getElementById('image-preview').src=selectedImage;
    document.getElementById('image-preview-container').classList.add('show');
  };
  reader.readAsDataURL(file);
}

// DM IDを生成
function getDmId(uid1,uid2){
  return[uid1,uid2].sort().join('_');
}

// メッセージを読み込み（DM）
function loadMessages(userId){
  if(messageListener){
    off(messageListener);
  }
  
  const dmId=getDmId(currentUser.uid,userId);
  const messagesRef=ref(database,`dms/${dmId}/messages`);
  
  messageListener=messagesRef;
  
  onValue(messagesRef,(snapshot)=>{
    const chatMessages=document.getElementById('chat-messages');
    if(!chatMessages)return;
    
    chatMessages.innerHTML='';
    
    if(snapshot.exists()){
      const messages=snapshot.val();
      const messageArray=Object.keys(messages).map(key=>({
        id:key,
        ...messages[key]
      }));
      
      messageArray.sort((a,b)=>a.timestamp-b.timestamp);
      
      messageArray.forEach(msg=>{
        displayMessage(msg,userId);
      });
      
      chatMessages.scrollTop=chatMessages.scrollHeight;
    }
    
    if(selectedUserId===userId){
      update(ref(database,`users/${currentUser.uid}/lastRead`),{
        [userId]:Date.now()
      });
    }
  });
}

// メッセージを読み込み（チャンネル）
function loadChannelMessages(channelId){
  if(messageListener){
    off(messageListener);
  }
  
  const messagesRef=ref(database,`channels/${channelId}/messages`);
  
  messageListener=messagesRef;
  
  let lastMessageCount=0;
  
  onValue(messagesRef,(snapshot)=>{
    const chatMessages=document.getElementById('chat-messages');
    if(!chatMessages)return;
    
    chatMessages.innerHTML='';
    
    if(snapshot.exists()){
      const messages=snapshot.val();
      const messageArray=Object.keys(messages).map(key=>({
        id:key,
        ...messages[key]
      }));
      
      messageArray.sort((a,b)=>a.timestamp-b.timestamp);
      
      // 新しいメッセージがあれば通知
      if(messageArray.length>lastMessageCount&&lastMessageCount>0){
        const newMsg=messageArray[messageArray.length-1];
        if(newMsg.senderId!==currentUser.uid){
          const sender=allUsers.find(u=>u.uid===newMsg.senderId);
          const senderName=sender?sender.username:'誰か';
          const channel=CHANNELS.find(c=>c.id===channelId);
          showNotification(`${channel.name}: ${senderName}`,newMsg.text);
        }
      }
      lastMessageCount=messageArray.length;
      
      messageArray.forEach(msg=>{
        displayChannelMessage(msg);
      });
      
      chatMessages.scrollTop=chatMessages.scrollHeight;
    }
    
    if(selectedChannelId===channelId){
      update(ref(database,`users/${currentUser.uid}/lastRead`),{
        [channelId]:Date.now()
      });
    }
  });
}

// メッセージを表示（DM）
async function displayMessage(msg,otherUserId){
  const chatMessages=document.getElementById('chat-messages');
  const isCurrentUser=msg.senderId===currentUser.uid;
  
  let senderData;
  if(isCurrentUser){
    senderData=currentUserData;
  }else{
    senderData=allUsers.find(u=>u.uid===msg.senderId);
  }
  
  if(!senderData)return;
  
  const iconUrl=senderData.iconUrl&&senderData.iconUrl!=='default'?senderData.iconUrl:'assets/school.png';
  
  // 既読状態を取得
  let readStatus='';
  if(isCurrentUser){
    const otherUserRef=ref(database,`users/${otherUserId}/lastRead/${currentUser.uid}`);
    const readSnapshot=await get(otherUserRef);
    if(readSnapshot.exists()){
      const lastReadTime=readSnapshot.val();
      if(msg.timestamp<=lastReadTime){
        readStatus='<span class="message-read">✓ 既読</span>';
      }
    }
  }
  
  const messageEl=document.createElement('div');
  messageEl.className='message';
  messageEl.innerHTML=`
    <div class="message-avatar">
      <img src="${iconUrl}" alt="${senderData.username}">
    </div>
    <div class="message-content">
      <div class="message-header">
        <span class="message-author">${senderData.username}</span>
        <span class="message-time">${formatMessageTime(msg.timestamp)}</span>
        ${readStatus}
      </div>
      <div class="message-text">${escapeHtml(msg.text)}</div>
      ${msg.imageUrl?`<img class="message-image" src="${msg.imageUrl}" alt="画像" onclick="openImageModal('${msg.imageUrl}')">`:''}
    </div>
  `;
  
  chatMessages.appendChild(messageEl);
}

// メッセージを表示（チャンネル）
function displayChannelMessage(msg){
  const chatMessages=document.getElementById('chat-messages');
  
  let senderData;
  if(msg.senderId===currentUser.uid){
    senderData=currentUserData;
  }else{
    senderData=allUsers.find(u=>u.uid===msg.senderId);
  }
  
  if(!senderData)return;
  
  const iconUrl=senderData.iconUrl&&senderData.iconUrl!=='default'?senderData.iconUrl:'assets/school.png';
  
  const messageEl=document.createElement('div');
  messageEl.className='message';
  messageEl.innerHTML=`
    <div class="message-avatar">
      <img src="${iconUrl}" alt="${senderData.username}">
    </div>
    <div class="message-content">
      <div class="message-header">
        <span class="message-author">${senderData.username}</span>
        <span class="message-time">${formatMessageTime(msg.timestamp)}</span>
      </div>
      <div class="message-text">${escapeHtml(msg.text)}</div>
      ${msg.imageUrl?`<img class="message-image" src="${msg.imageUrl}" alt="画像" onclick="openImageModal('${msg.imageUrl}')">`:''}
    </div>
  `;
  
  chatMessages.appendChild(messageEl);
}

// メッセージを送信
async function sendMessage(){
  if(isSending)return;
  
  const chatInput=document.getElementById('chat-input');
  const sendBtn=document.getElementById('send-btn');
  const text=chatInput.value.trim();
  
  if(!text&&!selectedImage)return;
  if(!selectedUserId&&!selectedChannelId)return;
  
  isSending=true;
  chatInput.disabled=true;
  sendBtn.disabled=true;
  
  const messageText=text;
  const messageImage=selectedImage;
  chatInput.value='';
  chatInput.style.height='auto';
  selectedImage=null;
  document.getElementById('image-preview-container').classList.remove('show');
  
  try{
    const messageData={
      senderId:currentUser.uid,
      text:messageText,
      timestamp:Date.now()
    };
    
    if(messageImage){
      messageData.imageUrl=messageImage;
    }
    
    if(selectedUserId){
      const dmId=getDmId(currentUser.uid,selectedUserId);
      const messagesRef=ref(database,`dms/${dmId}/messages`);
      const newMessageRef=push(messagesRef);
      
      await set(newMessageRef,messageData);
      
      const participantsRef=ref(database,`dms/${dmId}/participants`);
      const participantsSnapshot=await get(participantsRef);
      
      if(!participantsSnapshot.exists()){
        await set(participantsRef,{
          [currentUser.uid]:true,
          [selectedUserId]:true
        });
      }
      
      const otherUser=allUsers.find(u=>u.uid===selectedUserId);
      if(otherUser){
        showNotification(`${currentUserData.username}からのメッセージ`,messageText||'画像を送信しました',currentUserData.iconUrl);
      }
    }else if(selectedChannelId){
      const messagesRef=ref(database,`channels/${selectedChannelId}/messages`);
      const newMessageRef=push(messagesRef);
      
      await set(newMessageRef,messageData);
    }
  }catch(error){
    console.error('送信エラー:',error);
    alert('送信に失敗しました');
    chatInput.value=messageText;
  }finally{
    isSending=false;
    chatInput.disabled=false;
    sendBtn.disabled=false;
    chatInput.focus();
  }
}

// 時刻フォーマット（秒単位）
function formatMessageTime(timestamp){
  const date=new Date(timestamp);
  const now=new Date();
  const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const messageDate=new Date(date.getFullYear(),date.getMonth(),date.getDate());
  
  if(messageDate.getTime()===today.getTime()){
    return date.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }else if(messageDate.getTime()===today.getTime()-86400000){
    return '昨日 '+date.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }else{
    return date.toLocaleDateString('ja-JP',{month:'short',day:'numeric'})+' '+date.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }
}

// 最終ログイン時刻フォーマット（リアルタイム更新対応）
function formatLastOnline(timestamp){
  if(!timestamp)return '不明';
  
  const date=new Date(timestamp);
  const now=new Date();
  const diff=now-date;
  const seconds=Math.floor(diff/1000);
  const minutes=Math.floor(diff/60000);
  const hours=Math.floor(diff/3600000);
  const days=Math.floor(diff/86400000);
  
  if(seconds<10)return 'たった今';
  if(seconds<60)return `${seconds}秒前`;
  if(minutes<60)return `${minutes}分前`;
  if(hours<24)return `${hours}時間前`;
  if(days<7)return `${days}日前`;
  
  return date.toLocaleDateString('ja-JP',{month:'short',day:'numeric'});
}

// HTMLエスケープ + URLリンク化
function escapeHtml(text){
  const div=document.createElement('div');
  div.textContent=text;
  let escaped=div.innerHTML;
  
  // URLをリンク化
  const urlRegex=/(https?:\/\/[^\s]+)/g;
  escaped=escaped.replace(urlRegex,'<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  
  return escaped;
}

// 画像拡大モーダルを開く
window.openImageModal=function(imageUrl){
  document.getElementById('image-modal-img').src=imageUrl;
  document.getElementById('image-modal').classList.add('show');
}

// 画像拡大モーダルを閉じる
document.addEventListener('DOMContentLoaded',()=>{
  const imageModal=document.getElementById('image-modal');
  const imageModalClose=document.getElementById('image-modal-close');
  
  imageModalClose.addEventListener('click',()=>{
    imageModal.classList.remove('show');
  });
  
  imageModal.addEventListener('click',(e)=>{
    if(e.target===imageModal){
      imageModal.classList.remove('show');
    }
  });
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
    if(currentUser){
      await update(ref(database,`users/${currentUser.uid}`),{
        online:false,
        lastOnline:Date.now()
      });
    }
    if(lastOnlineUpdateInterval){
      clearInterval(lastOnlineUpdateInterval);
    }
    await signOut(auth);
    window.location.href='login.html';
  }catch(error){
    console.error(error);
    alert('ログアウトに失敗しました');
  }
});
