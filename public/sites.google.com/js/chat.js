// チャットアプリのメインファイル（Supabase版）

import{initPage,supabase}from'../common/core.js';
import{state,updateState,CHANNELS}from'./chat-state.js';
import{displayUsers}from'./chat-ui.js';
import'./chat-handlers.js';
import'./chat-modals.js';

// ページ初期化
const profile=await initPage('chat','チャット');

if(profile){
  updateState('currentUserId',profile.id);
  updateState('currentProfile',profile);
  
  // 通知権限リクエスト
  if('Notification'in window&&Notification.permission==='default'){
    await Notification.requestPermission();
  }
  
  // ユーザー一覧を読み込み
  await loadUsers();
  
  // リアルタイム更新を開始
  subscribeToUsers();
}

// ユーザー一覧を読み込み
async function loadUsers(){
  try{
    const{data:users,error}=await supabase
      .from('profiles')
      .select('*')
      .neq('id',state.currentUserId)
      .order('last_online',{ascending:false});
    
    if(error)throw error;
    
    updateState('allUsers',users||[]);
    
    // 未読件数を計算
    await calculateUnreadCounts();
    
    // 表示
    displayUsers();
  }catch(error){
    console.error('ユーザー読み込みエラー:',error);
    alert('ユーザー読み込みエラー: '+error.message);
  }
}

// ユーザーのリアルタイム更新を購読
function subscribeToUsers(){
  // 既存の購読を解除
  if(state.userSubscription){
    supabase.removeChannel(state.userSubscription);
  }
  
  // プロフィール更新を購読
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
  
  updateState('userSubscription',subscription);
}

// 未読件数を計算
async function calculateUnreadCounts(){
  const unreadCounts={};
  
  try{
    // 自分の既読状態を取得
    const{data:readStatuses,error:readError}=await supabase
      .from('read_status')
      .select('*')
      .eq('user_id',state.currentUserId);
    
    if(readError)throw readError;
    
    const readMap={};
    (readStatuses||[]).forEach(rs=>{
      readMap[rs.target_id]=new Date(rs.last_read_at).getTime();
    });
    
    // DM の未読
    for(const user of state.allUsers){
      const dmId=[state.currentUserId,user.id].sort().join('_');
      
      const{data:messages,error:msgError}=await supabase
        .from('dm_messages')
        .select('sender_id,created_at')
        .eq('dm_id',dmId)
        .order('created_at',{ascending:false});
      
      if(msgError)throw msgError;
      
      const lastRead=readMap[user.id]||0;
      const unread=(messages||[]).filter(m=>
        m.sender_id===user.id&&new Date(m.created_at).getTime()>lastRead
      ).length;
      
      unreadCounts[user.id]=unread;
    }
    
    // チャンネルの未読
    for(const channel of CHANNELS){
      const{data:messages,error:msgError}=await supabase
        .from('channel_messages')
        .select('sender_id,created_at')
        .eq('channel_id',channel.id)
        .order('created_at',{ascending:false});
      
      if(msgError)throw msgError;
      
      const lastRead=readMap[channel.id]||0;
      const unread=(messages||[]).filter(m=>
        m.sender_id!==state.currentUserId&&new Date(m.created_at).getTime()>lastRead
      ).length;
      
      unreadCounts[channel.id]=unread;
    }
    
    state.unreadCounts=unreadCounts;
  }catch(error){
    console.error('未読計算エラー:',error);
  }
}