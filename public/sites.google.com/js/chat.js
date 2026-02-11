// チャットアプリのメインファイル（Supabase版）

import{initPage,supabase}from'../common/core.js';
import{state,updateState,CHANNELS}from'./chat-state.js';
import{displayUsers}from'./chat-ui.js';
import{requestNotificationPermission}from'./chat-utils.js';
import'./chat-handlers.js';
import'./chat-modals.js';

// ページ初期化
await initPage('chat','ChatHub',{
  onUserLoaded:async(profile)=>{
    updateState('currentProfile',profile);
    await updateOnlineStatus(true);
    await requestNotificationPermission();
    await loadUsers();
    autoRestoreLastChat();
    subscribeToProfiles();
    startLastOnlineUpdateTimer();
    startOnlineHeartbeat();
    setupVisibilityHandlers();
  }
});

// オンライン状態を更新
async function updateOnlineStatus(isOnline){
  try{
    await supabase
      .from('profiles')
      .update({
        is_online:isOnline,
        last_online:new Date().toISOString()
      })
      .eq('id',state.currentProfile.id);
  }catch(error){
    console.error('オンライン状態更新エラー:',error);
  }
}

// オンライン状態のハートビート（15秒ごと）
function startOnlineHeartbeat(){
  if(state.onlineHeartbeatInterval){
    clearInterval(state.onlineHeartbeatInterval);
  }
  const interval=setInterval(async()=>{
    if(!document.hidden){
      await updateOnlineStatus(true);
    }
  },15000);
  updateState('onlineHeartbeatInterval',interval);
}

// ページ非表示時・クローズ時の処理
function setupVisibilityHandlers(){
  document.addEventListener('visibilitychange',async()=>{
    if(document.hidden){
      await updateOnlineStatus(false);
    }else{
      await updateOnlineStatus(true);
    }
  });

  window.addEventListener('beforeunload',async()=>{
    const data=JSON.stringify({
      id:state.currentProfile.id,
      is_online:false,
      last_online:new Date().toISOString()
    });
    navigator.sendBeacon(
      `${supabase.supabaseUrl}/rest/v1/profiles?id=eq.${state.currentProfile.id}`,
      new Blob([data],{type:'application/json'})
    );
  });

  window.addEventListener('pagehide',async()=>{
    await updateOnlineStatus(false);
  });
}

// ユーザー一覧を読み込み
async function loadUsers(){
  try{
    const{data:users,error}=await supabase
      .from('profiles')
      .select('*')
      .neq('id',state.currentProfile.id)
      .order('last_online',{ascending:false});

    if(error)throw error;

    updateState('allUsers',users||[]);
    await calculateUnreadCounts();
    displayUsers();
  }catch(error){
    console.error('ユーザー読み込みエラー:',error);
  }
}

// プロフィール変更のリアルタイム監視
function subscribeToProfiles(){
  if(state.profilesSubscription){
    supabase.removeChannel(state.profilesSubscription);
  }
  const subscription=supabase
    .channel('profiles-changes')
    .on('postgres_changes',{
      event:'*',
      schema:'public',
      table:'profiles'
    },async()=>{
      await loadUsers();
    })
    .subscribe();
  updateState('profilesSubscription',subscription);
}

// 未読件数を計算
async function calculateUnreadCounts(){
  const unreadCounts={};
  try{
    const{data:readStatuses,error:readError}=await supabase
      .from('read_status')
      .select('*')
      .eq('user_id',state.currentProfile.id);

    if(readError)throw readError;

    const readMap={};
    if(readStatuses){
      readStatuses.forEach(status=>{
        readMap[status.target_id]=new Date(status.last_read_at).getTime();
      });
    }

    for(const user of state.allUsers){
      const dmId=[state.currentProfile.user_id,user.user_id].sort().join('_');
      const{data:messages,error:msgError}=await supabase
        .from('dm_messages')
        .select('id,sender_id,created_at')
        .eq('dm_id',dmId)
        .order('created_at',{ascending:false});

      if(msgError)throw msgError;

      const lastReadTime=readMap[user.user_id]||0;
      const unreadCount=(messages||[]).filter(msg=>
        msg.sender_id===user.id&&new Date(msg.created_at).getTime()>lastReadTime
      ).length;
      unreadCounts[user.user_id]=unreadCount;
    }

    for(const channel of CHANNELS){
      const{data:messages,error:msgError}=await supabase
        .from('channel_messages')
        .select('id,sender_id,created_at')
        .eq('channel_id',channel.id)
        .order('created_at',{ascending:false});

      if(msgError)throw msgError;

      const lastReadTime=readMap[channel.id]||0;
      const unreadCount=(messages||[]).filter(msg=>
        msg.sender_id!==state.currentProfile.id&&new Date(msg.created_at).getTime()>lastReadTime
      ).length;
      unreadCounts[channel.id]=unreadCount;
    }

    state.unreadCounts=unreadCounts;
  }catch(error){
    console.error('未読計算エラー:',error);
  }
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

// 最後に開いていた会話を復元（なければgeneralをデフォルト）
function autoRestoreLastChat(){
  try{
    const saved=localStorage.getItem('chathub_last');
    if(saved){
      const{type,id}=JSON.parse(saved);
      if(type==='channel'&&window.selectChannel){
        window.selectChannel(id);
        return;
      }
      if(type==='user'&&window.selectUser){
        const exists=state.allUsers.find(u=>u.user_id===id);
        if(exists){
          window.selectUser(id);
          return;
        }
      }
    }
  }catch(e){
    console.warn('チャット復元エラー:',e);
  }
  // デフォルト：連絡チャンネルを開く
  if(window.selectChannel){
    window.selectChannel('general');
  }
}