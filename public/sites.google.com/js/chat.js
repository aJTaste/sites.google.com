// チャットアプリのメインファイル（Supabase版）

import{initPage,supabase}from'../common/core.js';
import{state,updateState,CHANNELS}from'./chat-state.js';
import{displayUsers}from'./chat-ui.js';
import'./chat-handlers.js';
import'./chat-modals.js';

// ページ初期化
const profile=await initPage('chat','チャット',{
  onUserLoaded:async(data)=>{
    updateState('currentProfile',data);
    
    // オンライン状態を更新
    await supabase
      .from('profiles')
      .update({
        is_online:true,
        last_online:new Date().toISOString()
      })
      .eq('id',data.id);
    
    // オフライン時の処理
    window.addEventListener('beforeunload',async()=>{
      await supabase
        .from('profiles')
        .update({
          is_online:false,
          last_online:new Date().toISOString()
        })
        .eq('id',data.id);
    });
    
    // 通知権限リクエスト
    if('Notification'in window&&Notification.permission==='default'){
      await Notification.requestPermission();
    }
    
    // ユーザー一覧を読み込み
    loadUsers();
    
    // 定期的に最終ログイン時刻を更新
    startLastOnlineUpdateTimer();
  }
});

// ユーザー一覧を読み込み
async function loadUsers(){
  try{
    // 全ユーザーを取得
    const{data:users,error}=await supabase
      .from('profiles')
      .select('*')
      .neq('id',state.currentProfile.id)
      .order('last_online',{ascending:false});
    
    if(error)throw error;
    
    updateState('allUsers',users||[]);
    
    // 未読件数を計算
    await calculateUnreadCounts();
    
    // UI表示
    displayUsers();
    
    // リアルタイム購読（プロフィール更新）
    subscribeToProfiles();
    
  }catch(error){
    console.error('ユーザー読み込みエラー:',error);
  }
}

// プロフィールのリアルタイム購読
function subscribeToProfiles(){
  if(state.profilesSubscription){
    state.profilesSubscription.unsubscribe();
  }
  
  const subscription=supabase
    .channel('profiles-changes')
    .on('postgres_changes',{
      event:'*',
      schema:'public',
      table:'profiles'
    },()=>{
      loadUsers();
    })
    .subscribe();
  
  updateState('profilesSubscription',subscription);
}

// 未読件数を計算
async function calculateUnreadCounts(){
  const unreadCounts={};
  
  try{
    // 自分の既読状態を取得
    const{data:readStatuses}=await supabase
      .from('read_status')
      .select('*')
      .eq('user_id',state.currentProfile.id);
    
    const readMap={};
    if(readStatuses){
      readStatuses.forEach(r=>{
        readMap[r.target_id]=new Date(r.last_read_at).getTime();
      });
    }
    
    // DM の未読
    for(const user of state.allUsers){
      const dmId=[state.currentProfile.user_id,user.user_id].sort().join('_');
      const lastReadTime=readMap[user.user_id]||0;
      
      const{data:messages}=await supabase
        .from('dm_messages')
        .select('id,sender_id,created_at')
        .eq('dm_id',dmId)
        .neq('sender_id',state.currentProfile.id)
        .gt('created_at',new Date(lastReadTime).toISOString());
      
      unreadCounts[user.user_id]=(messages||[]).length;
    }
    
    // チャンネルの未読
    for(const channel of CHANNELS){
      const lastReadTime=readMap[channel.id]||0;
      
      const{data:messages}=await supabase
        .from('channel_messages')
        .select('id,sender_id,created_at')
        .eq('channel_id',channel.id)
        .neq('sender_id',state.currentProfile.id)
        .gt('created_at',new Date(lastReadTime).toISOString());
      
      unreadCounts[channel.id]=(messages||[]).length;
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