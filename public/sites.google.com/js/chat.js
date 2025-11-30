// チャットアプリのメインファイル

import{initPage}from'../common/core.js';
import{database}from'../common/core.js';
import{ref,get,update,onValue}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import{state,updateState,CHANNELS}from'./chat-state.js';
import{displayUsers}from'./chat-ui.js';
import'./chat-handlers.js';
import'./chat-modals.js';

// ページ初期化
const userData=await initPage('chat','チャット',{
  onUserLoaded:async(data)=>{
    updateState('currentAccountId',data.accountId);
    updateState('currentUserData',data);
    
    const userRef=ref(database,`users/${data.accountId}`);
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
  }
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