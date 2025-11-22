// チャットアプリのメインファイル

import{auth,database}from'../common/firebase-config.js';
import{onAuthStateChanged,signOut}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import{ref,get,update,onValue}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import{state,updateState,CHANNELS}from'./chat-state.js';
import{displayUsers}from'./chat-ui.js';
import'./chat-handlers.js';
import'./chat-modals.js';

// ログイン状態チェック
onAuthStateChanged(auth,async(user)=>{
  if(!user){
    window.location.href='login.html';
    return;
  }
  
  updateState('currentUser',user);
  
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
  let currentAccountId=null;
  let currentUserData=null;
  
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
  
  updateState('currentAccountId',currentAccountId);
  updateState('currentUserData',currentUserData);
  
  const userAvatar=document.getElementById('user-avatar');
  if(currentUserData.iconUrl&&currentUserData.iconUrl!=='default'){
    userAvatar.src=currentUserData.iconUrl;
  }
  
  const userRef=ref(database,`users/${currentAccountId}`);
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
  
  if('Notification'in window&&Notification.permission==='default'){
    await Notification.requestPermission();
  }
  
  loadUsers();
  startLastOnlineUpdateTimer();
});

// ユーザー一覧を読み込み
function loadUsers(){
  const usersRef=ref(database,'users');
  onValue(usersRef,(snapshot)=>{
    if(snapshot.exists()){
      const users=snapshot.val();
      
      const allUsers=Object.keys(users)
        .filter(accountId=>accountId!==state.currentAccountId)
        .map(accountId=>({
          accountId:accountId,
          ...users[accountId]
        }));
      
      updateState('allUsers',allUsers);
      
      calculateUnreadCounts().then(()=>{
        displayUsers();
      });
    }
  },(error)=>{
    console.error('ERROR:ユーザー読み込み',error);
  });
}

// 未読件数を計算
async function calculateUnreadCounts(){
  const unreadCounts={};
  
  const lastReadRef=ref(database,`users/${state.currentAccountId}/lastRead`);
  const lastReadSnapshot=await get(lastReadRef);
  const lastReadData=lastReadSnapshot.exists()?lastReadSnapshot.val():{};
  
  // DM の未読
  for(const user of state.allUsers){
    const dmId=[state.currentAccountId,user.accountId].sort().join('_');
    const messagesRef=ref(database,`dms/${dmId}/messages`);
    const messagesSnapshot=await get(messagesRef);
    
    if(messagesSnapshot.exists()){
      const messages=messagesSnapshot.val();
      const lastReadTime=lastReadData[user.accountId]||0;
      
      const unreadCount=Object.values(messages).filter(msg=>
        msg.senderId===user.accountId&&msg.timestamp>lastReadTime
      ).length;
      
      unreadCounts[user.accountId]=unreadCount;
    }else{
      unreadCounts[user.accountId]=0;
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
        msg.senderId!==state.currentAccountId&&msg.timestamp>lastReadTime
      ).length;
      
      unreadCounts[channel.id]=unreadCount;
    }else{
      unreadCounts[channel.id]=0;
    }
  }
  
  state.unreadCounts=unreadCounts;
}

// 最終ログイン時刻の定期更新
function startLastOnlineUpdateTimer(){
  if(state.lastOnlineUpdateInterval){
    clearInterval(state.lastOnlineUpdateInterval);
  }
  const interval=setInterval(()=>{
    displayUsers();
  },1000);
  updateState('lastOnlineUpdateInterval',interval);
}

// ユーザーメニュー
const userBtn=document.getElementById('user-btn');
const userDropdown=document.getElementById('user-dropdown');

if(userBtn&&userDropdown){
  userBtn.addEventListener('click',(e)=>{
    e.stopPropagation();
    userDropdown.classList.toggle('show');
  });
  
  document.addEventListener('click',()=>{
    userDropdown.classList.remove('show');
  });
}

const profileBtn=document.getElementById('profile-btn');
const settingsBtn=document.getElementById('settings-btn');
const logoutBtn=document.getElementById('logout-btn');

if(profileBtn){
  profileBtn.addEventListener('click',()=>{
    window.location.href='profile.html';
  });
}

if(settingsBtn){
  settingsBtn.addEventListener('click',()=>{
    window.location.href='settings.html';
  });
}

if(logoutBtn){
  logoutBtn.addEventListener('click',async()=>{
    try{
      if(state.currentAccountId){
        await update(ref(database,`users/${state.currentAccountId}`),{
          online:false,
          lastOnline:Date.now()
        });
      }
      if(state.lastOnlineUpdateInterval){
        clearInterval(state.lastOnlineUpdateInterval);
      }
      await signOut(auth);
      window.location.href='login.html';
    }catch(error){
      console.error('ERROR:ログアウト失敗',error);
      alert('ログアウトに失敗しました');
    }
  });
}