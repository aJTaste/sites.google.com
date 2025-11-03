import{auth,database}from'../common/firebase-config.js';
import{onAuthStateChanged,signOut}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import{ref,get,set,update,push,onValue,off}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

let currentUser=null;
let currentUserData=null;
let allUsers=[];
let selectedUserId=null;
let messageListener=null;

// デバッグ用メッセージ表示
function showDebug(message){
  const dmList=document.getElementById('dm-list');
  const debugEl=document.createElement('div');
  debugEl.style.cssText='padding:12px;background:#ff6b35;color:#fff;font-size:12px;margin:8px;border-radius:6px;';
  debugEl.textContent=message;
  dmList.appendChild(debugEl);
  console.log('DEBUG:',message);
}

// ログイン状態チェック
onAuthStateChanged(auth,async(user)=>{
  showDebug('認証状態チェック開始');
  
  if(!user){
    showDebug('未ログイン - ログインページへ');
    window.location.href='login.html';
    return;
  }
  
  showDebug('ログイン済み: '+user.uid);
  currentUser=user;
  
  try{
    const userRef=ref(database,`users/${user.uid}`);
    showDebug('ユーザーデータ取得中...');
    const snapshot=await get(userRef);
    
    if(snapshot.exists()){
      currentUserData=snapshot.val();
      showDebug('ユーザーデータ取得成功: '+currentUserData.username);
      
      // アイコン表示
      const userAvatar=document.getElementById('user-avatar');
      if(currentUserData.iconUrl&&currentUserData.iconUrl!=='default'){
        userAvatar.src=currentUserData.iconUrl;
      }
      
      // online, lastOnline フィールドがない場合は追加
      const updates={};
      if(currentUserData.online===undefined){
        updates.online=true;
        showDebug('onlineフィールドを追加');
      }
      if(currentUserData.lastOnline===undefined){
        updates.lastOnline=Date.now();
        showDebug('lastOnlineフィールドを追加');
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
      showDebug('オンライン状態を更新');
      
      // ページを閉じる時にオフラインに
      window.addEventListener('beforeunload',async()=>{
        await update(userRef,{
          online:false,
          lastOnline:Date.now()
        });
      });
      
      // ユーザー一覧を読み込み
      showDebug('ユーザー一覧読み込み開始');
      loadUsers();
    }else{
      showDebug('エラー: ユーザーデータが存在しません');
    }
  }catch(error){
    showDebug('エラー発生: '+error.message);
    console.error(error);
  }
});

// ユーザー一覧を読み込み
function loadUsers(){
  try{
    const usersRef=ref(database,'users');
    showDebug('/users からデータ取得中...');
    
    onValue(usersRef,(snapshot)=>{
      showDebug('データ取得コールバック実行');
      
      if(snapshot.exists()){
        const users=snapshot.val();
        const userCount=Object.keys(users).length;
        showDebug(`全ユーザー数: ${userCount}`);
        
        allUsers=Object.keys(users)
          .filter(uid=>uid!==currentUser.uid)
          .map(uid=>({
            uid:uid,
            ...users[uid]
          }));
        
        showDebug(`自分以外のユーザー数: ${allUsers.length}`);
        
        if(allUsers.length>0){
          showDebug('ユーザー一覧:');
          allUsers.forEach(u=>{
            showDebug(`- ${u.username} (${u.accountId})`);
          });
        }
        
        displayUsers();
      }else{
        showDebug('エラー: /users にデータが存在しません');
      }
    },(error)=>{
      showDebug('データ取得エラー: '+error.message);
      console.error(error);
    });
  }catch(error){
    showDebug('loadUsers エラー: '+error.message);
    console.error(error);
  }
}

// ユーザー一覧を表示
function displayUsers(){
  const dmList=document.getElementById('dm-list');
  
  // デバッグメッセージ以外をクリア
  const debugMessages=Array.from(dmList.children).filter(el=>el.style.background==='rgb(255, 107, 53)');
  dmList.innerHTML='';
  debugMessages.forEach(msg=>dmList.appendChild(msg));
  
  showDebug(`displayUsers: ${allUsers.length}人を表示`);
  
  if(allUsers.length===0){
    showDebug('表示するユーザーがいません');
    return;
  }
  
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
  
  showDebug('ユーザー表示完了');
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