// チャットアプリのメインファイル

import{auth,database}from'../common/firebase-config.js';
import{onAuthStateChanged,signOut}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import{ref,get,update,onValue}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import{state,updateState,CHANNELS}from'./chat-state.js';
import{displayUsers}from'./chat-ui.js';
import{updatePageTitle}from'./chat-utils.js';
import'./chat-handlers.js';
import'./chat-modals.js';

// ログイン状態チェック
onAuthStateChanged(auth,async(user)=>{
  if(!user){
    window.location.href='login.html';
    return;
  }
  
  updateState('currentUser',user);
  
  const userRef=ref(database,`users/${user.uid}`);
  const snapshot=await get(userRef);
  
  if(snapshot.exists()){
    updateState('currentUserData',snapshot.val());
    
    const userAvatar=document.getElementById('user-avatar');
    if(state.currentUserData.iconUrl&&state.currentUserData.iconUrl!=='default'){
      userAvatar.src=state.currentUserData.iconUrl;
    }
    
    // オンライン状態を初期化
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
    
    // 通知権限をリクエスト
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
        .filter(uid=>uid!==state.currentUser.uid)
        .map(uid=>({
          uid:uid,
          ...users[uid]
        }));
      
      updateState('allUsers',allUsers);
      
      calculateUnreadCounts().then(()=>{
        displayUsers();
        updatePageTitle(state.unreadCounts);
      });
    }
  });
}

// 未読件数を計算
async function calculateUnreadCounts(){
  const unreadCounts={};
  
  const lastReadRef=ref(database,`users/${state.currentUser.uid}/lastRead`);
  const lastReadSnapshot=await get(lastReadRef);
  const lastReadData=lastReadSnapshot.exists()?lastReadSnapshot.val():{};
  
  // DM の未読
  for(const user of state.allUsers){
    const dmId=[state.currentUser.uid,user.uid].sort().join('_');
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
        msg.senderId!==state.currentUser.uid&&msg.timestamp>lastReadTime
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
    if(state.currentUser){
      await update(ref(database,`users/${state.currentUser.uid}`),{
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
    console.error(error);
    alert('ログアウトに失敗しました');
  }
});
