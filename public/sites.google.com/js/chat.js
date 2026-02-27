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
    setupMobileTouchActions();

    // モバイルで何も選択されていなければDMサイドバーを開く
    if(isMobile()){
      setTimeout(()=>{
        if(!state.selectedUserId&&!state.selectedChannelId){
          document.querySelector('.dm-sidebar')?.classList.add('show');
        }
      },200);
    }
  }
});

// モバイル判定
function isMobile(){
  return window.innerWidth<=768;
}

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
}

// ========================================
// モバイル：タッチ長押しでアクションボタン表示
// ========================================
function setupMobileTouchActions(){
  if(!isMobile())return;

  let touchTimer=null;
  let activeMsgEl=null;

  document.addEventListener('touchstart',(e)=>{
    const msg=e.target.closest('.message');
    if(!msg)return;

    touchTimer=setTimeout(()=>{
      // 前のアクティブを解除
      activeMsgEl?.classList.remove('touch-active');
      msg.classList.add('touch-active');
      activeMsgEl=msg;
      // バイブレーション（対応端末のみ）
      navigator.vibrate?.(30);
    },400);
  },{passive:true});

  document.addEventListener('touchend',()=>{
    clearTimeout(touchTimer);
    touchTimer=null;
  },{passive:true});

  document.addEventListener('touchmove',()=>{
    clearTimeout(touchTimer);
    touchTimer=null;
  },{passive:true});

  // メッセージ外タップでアクション非表示
  document.addEventListener('touchstart',(e)=>{
    if(!e.target.closest('.message')&&!e.target.closest('.message-actions')){
      activeMsgEl?.classList.remove('touch-active');
      activeMsgEl=null;
    }
  },{passive:true});
}

// ========================================
// ユーザー一覧を読み込む
// ========================================
async function loadUsers(){
  try{
    const{data:profiles,error}=await supabase
      .from('profiles')
      .select('*')
      .neq('id',state.currentProfile.id)
      .order('last_online',{ascending:false,nullsFirst:false});

    if(error)throw error;

    updateState('allUsers',profiles||[]);

    // 未読数を取得
    await loadUnreadCounts();
    displayUsers();
  }catch(error){
    console.error('ユーザー一覧読み込みエラー:',error);
  }
}

// 未読数を取得
async function loadUnreadCounts(){
  try{
    const{data:readStatuses}=await supabase
      .from('read_status')
      .select('target_id,last_read_at')
      .eq('user_id',state.currentProfile.id);

    const readMap={};
    readStatuses?.forEach(rs=>{
      readMap[rs.target_id]=rs.last_read_at;
    });

    // DM未読数
    for(const user of state.allUsers){
      const lastRead=readMap[user.user_id];
      let query=supabase
        .from('messages')
        .select('id',{count:'exact',head:true})
        .eq('receiver_id',state.currentProfile.id)
        .eq('sender_id',user.user_id);

      if(lastRead){
        query=query.gt('created_at',lastRead);
      }

      const{count}=await query;
      state.unreadCounts[user.user_id]=count||0;
    }

    // チャンネル未読数
    for(const channel of CHANNELS){
      const lastRead=readMap[channel.id];
      let query=supabase
        .from('channel_messages')
        .select('id',{count:'exact',head:true})
        .eq('channel_id',channel.id)
        .neq('sender_id',state.currentProfile.id);

      if(lastRead){
        query=query.gt('created_at',lastRead);
      }

      const{count}=await query;
      state.unreadCounts[channel.id]=count||0;
    }
  }catch(error){
    console.error('未読数取得エラー:',error);
  }
}

// 最後のチャットを自動復元
function autoRestoreLastChat(){
  try{
    const last=localStorage.getItem('chathub_last');
    if(!last)return;
    const{type,id}=JSON.parse(last);
    if(type==='user'&&id){
      window.selectUser?.(id);
    }else if(type==='channel'&&id){
      window.selectChannel?.(id);
    }
  }catch(e){}
}

// プロフィール変更のリアルタイム購読
function subscribeToProfiles(){
  supabase
    .channel('profiles-changes')
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'profiles'},
      (payload)=>{
        const updated=payload.new;
        const idx=state.allUsers.findIndex(u=>u.id===updated.id);
        if(idx!==-1){
          state.allUsers[idx]={...state.allUsers[idx],...updated};
          displayUsers();
        }
      }
    )
    .subscribe();
}

// last_onlineを定期更新（表示用）
function startLastOnlineUpdateTimer(){
  setInterval(()=>{
    displayUsers();
  },60000);
}