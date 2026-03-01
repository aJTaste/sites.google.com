// チャットアプリのメインファイル（Supabase版）

import{initPage,supabase}from'../common/core.js';
import{state,updateState,CHANNELS}from'./chat-state.js';
import{displayUsers}from'./chat-ui.js';
import{requestNotificationPermission,showNotification,playCallSound,playNotificationSound}from'./chat-utils.js';
import'./chat-handlers.js';
import'./chat-modals.js';

function isStealthModeActive(){
  const saved=localStorage.getItem('stealthModeState');
  if(saved){try{return JSON.parse(saved).stealthMode;}catch(e){return false;}}
  return false;
}

// ページ初期化
await initPage('chat','ChatHub',{
  onUserLoaded:async(profile)=>{
    updateState('currentProfile',profile);
    await updateOnlineStatus(true);
    await requestNotificationPermission();
    await loadUsers();
    autoRestoreLastChat();
    subscribeToProfiles();
    subscribeToGlobalDmNotifications();
    subscribeToCallChannel();
    startLastOnlineUpdateTimer();
    startOnlineHeartbeat();
    setupVisibilityHandlers();
    setupMobileTouchActions();

    if(isMobile()){
      setTimeout(()=>{
        if(!state.selectedUserId&&!state.selectedChannelId){
          document.querySelector('.dm-sidebar')?.classList.add('show');
        }
      },200);
    }
  }
});

function isMobile(){
  return window.innerWidth<=768;
}

// ========================================
// オンライン状態・現在ページを更新
// ========================================

async function updateOnlineStatus(isOnline,currentPage=''){
  try{
    await supabase
      .from('profiles')
      .update({
        is_online:isOnline,
        last_online:new Date().toISOString(),
        current_page:isOnline?currentPage:''
      })
      .eq('id',state.currentProfile.id);
  }catch(error){
    console.error('オンライン状態更新エラー:',error);
  }
}

// ハートビート（30秒ごと）
function startOnlineHeartbeat(){
  if(state.onlineHeartbeatInterval){
    clearInterval(state.onlineHeartbeatInterval);
  }
  const interval=setInterval(async()=>{
    if(!document.hidden){
      await updateOnlineStatus(true,'ChatHub');
    }
  },30000);
  updateState('onlineHeartbeatInterval',interval);
}

// ページ可視性・クローズ時の処理
function setupVisibilityHandlers(){
  document.addEventListener('visibilitychange',async()=>{
    if(document.hidden){
      await updateOnlineStatus(false,'');
    }else{
      await updateOnlineStatus(true,'ChatHub');
    }
  });

  window.addEventListener('beforeunload',()=>{
    // sendBeaconでオフライン設定
    const headers={'Content-Type':'application/json','apikey':supabase.supabaseKey,'Authorization':'Bearer '+supabase.supabaseKey};
    const data=JSON.stringify({is_online:false,last_online:new Date().toISOString(),current_page:''});
    navigator.sendBeacon(
      `${supabase.supabaseUrl}/rest/v1/profiles?id=eq.${state.currentProfile.id}`,
      new Blob([data],{type:'application/json'})
    );
  });
}

// ========================================
// グローバルDM通知購読（全DMを監視）
// ========================================

function subscribeToGlobalDmNotifications(){
  // RLSにより自分が参加するDMのみ受信される
  const ch=supabase
    .channel('global-dm-notifications')
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'dm_messages'},
      async(payload)=>{
        const msg=payload.new;
        if(!msg||msg.sender_id===state.currentProfile.id)return;
        if(isStealthModeActive())return;

        // 現在開いているDMは除外（chat-messages.jsで処理済み）
        const currentDmId=getCurrentOpenDmId();
        if(msg.dm_id===currentDmId)return;

        const sender=state.allUsers.find(u=>u.id===msg.sender_id);
        const name=sender?.display_name||'不明';
        const icon=sender?.avatar_url||null;
        showNotification(name,msg.text||'画像を送信しました',icon);

        // 未読カウント更新
        const senderId=sender?.user_id||msg.sender_id;
        state.unreadCounts[senderId]=(state.unreadCounts[senderId]||0)+1;
        displayUsers();
      })
    .subscribe((status)=>{
      if(status==='CHANNEL_ERROR'){
        console.warn('グローバルDM購読エラー。再接続します...');
        setTimeout(subscribeToGlobalDmNotifications,3000);
      }
    });

  updateState('globalDmSubscription',ch);
}

function getCurrentOpenDmId(){
  if(!state.selectedUserId)return null;
  const other=state.allUsers.find(u=>u.user_id===state.selectedUserId||u.id===state.selectedUserId);
  if(!other)return null;
  return[state.currentProfile.user_id,other.user_id].sort().join('_');
}

// ========================================
// 呼び出し機能（Broadcastチャンネル）
// ========================================

let callChannel=null;

function subscribeToCallChannel(){
  callChannel=supabase
    .channel('apphub-calls')
    .on('broadcast',{event:'call'},(data)=>{
      const payload=data.payload;
      if(!payload||payload.target_id!==state.currentProfile.id)return;
      if(isStealthModeActive())return;

      // 呼び出し受信！
      const callerName=payload.caller_name||'不明';
      const callerIcon=payload.caller_icon||null;
      showNotification(callerName,'あなたを呼び出しています！',callerIcon,true);
    })
    .subscribe();

  updateState('callChannel',callChannel);
}

// 呼び出しを送信（chat-ui.jsから呼ぶ）
export async function sendCall(targetId,targetName){
  if(!callChannel)return;
  await callChannel.send({
    type:'broadcast',
    event:'call',
    payload:{
      caller_id:state.currentProfile.id,
      caller_name:state.currentProfile.display_name,
      caller_icon:state.currentProfile.avatar_url||null,
      target_id:targetId
    }
  });
  showNotification(`${targetName}を呼び出しました`,'','',false);
}

// window経由で公開
window.sendCall=sendCall;

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
    readStatuses?.forEach(rs=>{readMap[rs.target_id]=rs.last_read_at;});

    for(const user of state.allUsers){
      const dmId=[state.currentProfile.user_id,user.user_id].sort().join('_');
      const lastRead=readMap[user.user_id]||readMap[dmId];
      let query=supabase
        .from('dm_messages')
        .select('id',{count:'exact',head:true})
        .eq('dm_id',dmId)
        .neq('sender_id',state.currentProfile.id);
      if(lastRead)query=query.gt('created_at',lastRead);
      const{count}=await query;
      state.unreadCounts[user.user_id]=count||0;
    }

    for(const channel of CHANNELS){
      const lastRead=readMap[channel.id];
      let query=supabase
        .from('channel_messages')
        .select('id',{count:'exact',head:true})
        .eq('channel_id',channel.id)
        .neq('sender_id',state.currentProfile.id);
      if(lastRead)query=query.gt('created_at',lastRead);
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
    if(type==='user'&&id){window.selectUser?.(id);}
    else if(type==='channel'&&id){window.selectChannel?.(id);}
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
      })
    .subscribe();
}

// last_onlineを定期更新（表示用）
function startLastOnlineUpdateTimer(){
  setInterval(()=>{displayUsers();},60000);
}

// ========================================
// モバイル：タッチ長押し
// ========================================

function setupMobileTouchActions(){
  if(!isMobile())return;

  let touchTimer=null;
  let activeMsgEl=null;

  document.addEventListener('touchstart',(e)=>{
    const msg=e.target.closest('.message');
    if(!msg)return;
    touchTimer=setTimeout(()=>{
      activeMsgEl?.classList.remove('touch-active');
      msg.classList.add('touch-active');
      activeMsgEl=msg;
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

  document.addEventListener('touchstart',(e)=>{
    if(!e.target.closest('.message')&&!e.target.closest('.message-actions')){
      activeMsgEl?.classList.remove('touch-active');
      activeMsgEl=null;
    }
  },{passive:true});
}