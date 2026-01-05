// チャットアプリのメインファイル（Supabase版）

import{initPage,supabase}from'../common/core.js';
import{state,updateState,CHANNELS}from'./chat-state.js';
import{displayUsers}from'./chat-ui.js';
import{requestNotificationPermission}from'./chat-utils.js';
import'./chat-handlers.js';
import'./chat-modals.js';

// ページ初期化
await initPage('chat','チャット',{
  onUserLoaded:async(profile)=>{
    updateState('currentProfile',profile);
    
    // オンライン状態更新
    await supabase
      .from('profiles')
      .update({
        is_online:true,
        last_online:new Date().toISOString()
      })
      .eq('id',profile.id);
    
    // オフライン時の処理
    window.addEventListener('beforeunload',async()=>{
      await supabase
        .from('profiles')
        .update({
          is_online:false,
          last_online:new Date().toISOString()
        })
        .eq('id',profile.id);
    });
    
    // 通知権限リクエスト
    await requestNotificationPermission();
    
    // ユーザー一覧読み込み
    await loadUsers();
    
    // プロフィール変更のリアルタイム監視
    subscribeToProfiles();
    
    // 最終ログイン時刻の定期更新
    startLastOnlineUpdateTimer();
  }
});

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
    
    // 未読件数を計算
    await calculateUnreadCounts();
    
    // ユーザー一覧を表示
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
    },async(payload)=>{
      // ユーザー一覧を再読み込み
      await loadUsers();
    })
    .subscribe();
  
  updateState('profilesSubscription',subscription);
}

// 未読件数を計算
async function calculateUnreadCounts(){
  const unreadCounts={};
  
  try{
    // 自分の既読状態を取得
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
    
    // DM の未読
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
    
    // チャンネルの未読
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