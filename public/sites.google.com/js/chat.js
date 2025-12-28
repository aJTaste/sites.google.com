// チャットアプリメイン（Supabase版）

import{initPage,supabase}from'../common/core.js';
import{state,setState}from'./chat-state.js';
import{displayUserList}from'./chat-ui.js';
import{subscribeProfiles}from'./chat-realtime.js';

// ページ初期化
await initPage('chat','チャット',{
  onUserLoaded:async(profile)=>{
    setState('currentProfile',profile);
    
    // 全プロフィールを取得
    await loadAllProfiles();
    
    // プロフィールのリアルタイム購読
    subscribeProfiles(async()=>{
      await loadAllProfiles();
      displayUserList();
    });
    
    // 未読件数を計算
    await calculateUnreadCounts();
    
    // ユーザーリスト表示
    displayUserList();
    
    // 定期的に最終ログイン時刻を更新（表示用）
    setState('lastOnlineUpdateTimer',setInterval(()=>{
      displayUserList();
    },10000));
    
    // 通知権限をリクエスト
    if('Notification'in window&&Notification.permission==='default'){
      await Notification.requestPermission();
    }
  }
});

// 全プロフィールを取得
async function loadAllProfiles(){
  const{data:profiles,error}=await supabase
    .from('profiles')
    .select('*')
    .neq('id',state.currentProfile.id)
    .order('created_at',{ascending:true});
  
  if(error){
    console.error('プロフィール読み込みエラー:',error);
    return;
  }
  
  setState('allProfiles',profiles);
}

// 未読件数を計算
async function calculateUnreadCounts(){
  const unreadCounts={};
  
  // 自分の既読状態を取得
  const{data:readStatuses,error}=await supabase
    .from('read_status')
    .select('*')
    .eq('user_id',state.currentProfile.id);
  
  if(error){
    console.error('既読状態取得エラー:',error);
    return;
  }
  
  const readMap={};
  (readStatuses||[]).forEach(rs=>{
    readMap[rs.target_id]=new Date(rs.last_read_at).getTime();
  });
  
  // 各ユーザーの未読DM数を計算
  for(const profile of state.allProfiles){
    const dmId=[state.currentProfile.id,profile.id].sort().join('_');
    const lastRead=readMap[profile.id]||0;
    
    const{data:messages,error}=await supabase
      .from('dm_messages')
      .select('id,sender_id,created_at')
      .eq('dm_id',dmId)
      .eq('sender_id',profile.id)
      .gt('created_at',new Date(lastRead).toISOString());
    
    if(!error){
      unreadCounts[profile.id]=messages?.length||0;
    }
  }
  
  // 各チャンネルの未読数を計算
  const CHANNELS=[
    {id:'general'},{id:'random'},{id:'tech'},{id:'moderators'}
  ];
  
  for(const channel of CHANNELS){
    const lastRead=readMap[channel.id]||0;
    
    const{data:messages,error}=await supabase
      .from('channel_messages')
      .select('id,sender_id,created_at')
      .eq('channel_id',channel.id)
      .neq('sender_id',state.currentProfile.id)
      .gt('created_at',new Date(lastRead).toISOString());
    
    if(!error){
      unreadCounts[channel.id]=messages?.length||0;
    }
  }
  
  state.unreadCounts=unreadCounts;
}

// 画像モーダルを閉じる
document.getElementById('image-modal-close').addEventListener('click',()=>{
  document.getElementById('image-modal').classList.remove('show');
});

document.getElementById('image-modal').addEventListener('click',(e)=>{
  if(e.target.id==='image-modal'){
    document.getElementById('image-modal').classList.remove('show');
  }
});