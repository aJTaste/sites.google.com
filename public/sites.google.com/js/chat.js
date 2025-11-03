import{auth,database}from'../common/firebase-config.js';
import{onAuthStateChanged,signOut}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import{ref,get,set,update,push,onValue,off}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

let currentUser=null;
let currentUserData=null;
let allUsers=[];
let selectedUserId=null;
let messageListener=null;

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
    
    // アイコン表示
    const userAvatar=document.getElementById('user-avatar');
    if(currentUserData.iconUrl&&currentUserData.iconUrl!=='default'){
      userAvatar.src=currentUserData.iconUrl;
    }
    
    // online, lastOnline フィールドがない場合は追加
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
    
    // オンライン状態を true に設定
    await update(userRef,{
      online:true,
      lastOnline:Date.now()
    });
    
    // ページを閉じる時にオフラインに
    window.addEventListener('beforeunload',async()=>{
      await update(userRef,{
        online:false,
        lastOnline:Date.now()
      });
    });
    
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
      allUsers=Object.keys(users)
        .filter(uid=>uid!==currentUser.uid)
        .map(uid=>({
          uid:uid,
          ...users[uid]
        }));
      
      displayUsers();
    }
  });
}

// ユーザー一覧を表示
function displayUsers(){
  const dmList=document.getElementById('dm-list');
  dmList.innerHTML='';
  
  // オンライン状態でソート
  allUsers.sort((a,b)=>{
    const aOnline=a.online||false;
    const bOnline=b.online||false;
    if(aOnline&&!bOnline)return -1;
    if(!aOnline&&bOnline)return 1;
    return a.username.localeCompare(b.username);
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
    const statusText=isOnline?'オンライン':`最終ログイン: ${formatLastOnline(user.lastOnline||user.createdAt)}`;
    
    dmItem.innerHTML=`
      <div class="dm-item-avatar">
        <img src="${iconUrl}" alt="${user.username}">
        ${onlineIndicator}
      </div>
      <div class="dm-item-info">
        <div class="dm-item-name">${user.username}</div>
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
function selectUser(userId){
  selectedUserId=userId;
  displayUsers();
  loadChat(userId);
}

// チャットを読み込み
function loadChat(userId){
  const chatMain=document.getElementById('chat-main');
  const selectedUser=allUsers.find(u=>u.uid===userId);
  
  if(!selectedUser)return;
  
  const iconUrl=selectedUser.iconUrl&&selectedUser.iconUrl!=='default'?selectedUser.iconUrl:'assets/school.png';
  const isOnline=selectedUser.online||false;
  const statusText=isOnline?'オンライン':`最終ログイン: ${formatLastOnline(selectedUser.lastOnline||selectedUser.createdAt)}`;
  
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
    <div class="chat-messages" id="chat-messages"></div>
    <div class="chat-input-container">
      <div class="chat-input-wrapper">
        <textarea class="chat-input" id="chat-input" placeholder="${selectedUser.username} にメッセージを送信" rows="1"></textarea>
        <button class="send-btn" id="send-btn">
          <span class="material-icons">send</span>
        </button>
      </div>
    </div>
  `;
  
  // テキストエリアの自動リサイズ
  const chatInput=document.getElementById('chat-input');
  chatInput.addEventListener('input',()=>{
    chatInput.style.height='auto';
    chatInput.style.height=chatInput.scrollHeight+'px';
  });
  
  // Enter キーで送信（Shift+Enter で改行）
  chatInput.addEventListener('keydown',(e)=>{
    if(e.key==='Enter'&&!e.shiftKey){
      e.preventDefault();
      sendMessage();
    }
  });
  
  // 送信ボタン
  document.getElementById('send-btn').addEventListener('click',sendMessage);
  
  // メッセージを読み込み
  loadMessages(userId);
}

// DM IDを生成（2人のユーザーIDをアルファベット順にソート）
function getDmId(uid1,uid2){
  return[uid1,uid2].sort().join('_');
}

// メッセージを読み込み
function loadMessages(userId){
  // 既存のリスナーを削除
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
      
      // タイムスタンプでソート
      messageArray.sort((a,b)=>a.timestamp-b.timestamp);
      
      messageArray.forEach(msg=>{
        displayMessage(msg);
      });
      
      // 最下部にスクロール
      chatMessages.scrollTop=chatMessages.scrollHeight;
    }
  });
}

// メッセージを表示
function displayMessage(msg){
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
    </div>
  `;
  
  chatMessages.appendChild(messageEl);
}

// メッセージを送信
async function sendMessage(){
  const chatInput=document.getElementById('chat-input');
  const text=chatInput.value.trim();
  
  if(!text||!selectedUserId)return;
  
  const dmId=getDmId(currentUser.uid,selectedUserId);
  const messagesRef=ref(database,`dms/${dmId}/messages`);
  const newMessageRef=push(messagesRef);
  
  try{
    await set(newMessageRef,{
      senderId:currentUser.uid,
      text:text,
      timestamp:Date.now()
    });
    
    // DMの参加者情報を更新（初回のみ）
    const participantsRef=ref(database,`dms/${dmId}/participants`);
    const participantsSnapshot=await get(participantsRef);
    
    if(!participantsSnapshot.exists()){
      await set(participantsRef,{
        [currentUser.uid]:true,
        [selectedUserId]:true
      });
    }
    
    chatInput.value='';
    chatInput.style.height='auto';
  }catch(error){
    console.error('メッセージ送信エラー:',error);
    alert('メッセージの送信に失敗しました');
  }
}

// 時刻フォーマット（メッセージ用）
function formatMessageTime(timestamp){
  const date=new Date(timestamp);
  const now=new Date();
  const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const messageDate=new Date(date.getFullYear(),date.getMonth(),date.getDate());
  
  if(messageDate.getTime()===today.getTime()){
    // 今日
    return date.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});
  }else if(messageDate.getTime()===today.getTime()-86400000){
    // 昨日
    return '昨日 '+date.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});
  }else{
    // それ以前
    return date.toLocaleDateString('ja-JP',{month:'short',day:'numeric'})+' '+date.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});
  }
}

// 最終ログイン時刻フォーマット
function formatLastOnline(timestamp){
  if(!timestamp)return '不明';
  
  const date=new Date(timestamp);
  const now=new Date();
  const diff=now-date;
  const minutes=Math.floor(diff/60000);
  const hours=Math.floor(diff/3600000);
  const days=Math.floor(diff/86400000);
  
  if(minutes<1)return 'たった今';
  if(minutes<60)return `${minutes}分前`;
  if(hours<24)return `${hours}時間前`;
  if(days<7)return `${days}日前`;
  
  return date.toLocaleDateString('ja-JP',{month:'short',day:'numeric'});
}

// HTMLエスケープ
function escapeHtml(text){
  const div=document.createElement('div');
  div.textContent=text;
  return div.innerHTML;
}

// ユーザーメニューの開閉
const userBtn=document.getElementById('user-btn');
const userDropdown=document.getElementById('user-dropdown');

userBtn.addEventListener('click',(e)=>{
  e.stopPropagation();
  userDropdown.classList.toggle('show');
});

document.addEventListener('click',()=>{
  userDropdown.classList.remove('show');
});

// プロフィール・設定・ログアウト
document.getElementById('profile-btn').addEventListener('click',()=>{
  window.location.href='profile.html';
});

document.getElementById('settings-btn').addEventListener('click',()=>{
  window.location.href='settings.html';
});

document.getElementById('logout-btn').addEventListener('click',async()=>{
  try{
    // オフライン状態にしてからログアウト
    if(currentUser){
      await update(ref(database,`users/${currentUser.uid}`),{
        online:false,
        lastOnline:Date.now()
      });
    }
    await signOut(auth);
    window.location.href='login.html';
  }catch(error){
    console.error(error);
    alert('ログアウトに失敗しました');
  }
});