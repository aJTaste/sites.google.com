// チャットアプリのメインファイル（Supabase版）

import{initPage,supabase}from'../common/core.js';
import{state,updateState,CHANNELS}from'./chat-state.js';
import{displayUsers}from'./chat-ui.js';
import{requestNotificationPermission,showNotification}from'./chat-utils.js';
import'./chat-handlers.js';
import'./chat-modals.js';
import{initCallEngine}from'./call-engine.js';

function isStealthModeActive(){
  const saved=localStorage.getItem('stealthModeState');
  if(saved){try{return JSON.parse(saved).stealthMode;}catch(e){return false;}}
  return false;
}

// ページ初期化
await initPage('chat','ChatHub',{
  onUserLoaded:async(profile)=>{
    updateState('currentProfile',profile);

    // ★ 各初期化を個別try-catchで包む
    // → 一つの失敗がinitPage全体のcatchに伝播してlogin.htmlへリダイレクトするのを防ぐ
    try{await updateOnlineStatus(true);}catch(e){console.error('online:',e);}
    try{await requestNotificationPermission();}catch(e){}
    try{await loadUsers();}catch(e){console.error('loadUsers:',e);}
    try{autoRestoreLastChat();}catch(e){}
    try{subscribeToProfiles();}catch(e){}
    try{subscribeToGlobalDmNotifications();}catch(e){console.error('globalDm:',e);}
    try{subscribeToCallChannel();}catch(e){console.error('callCh:',e);}
    try{startLastOnlineUpdateTimer();}catch(e){}
    try{startOnlineHeartbeat();}catch(e){}
    try{setupVisibilityHandlers();}catch(e){}
    try{setupMobileTouchActions();}catch(e){}
    try{initCallEngine();}catch(e){console.error('callEngine:',e);}
    window._appState=state;
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
// オンライン状態を更新
// ========================================

async function updateOnlineStatus(isOnline){
  if(!state.currentProfile?.id)return;
  const updates={
    is_online:isOnline,
    last_online:new Date().toISOString()
  };
  // current_page カラムも更新（列がない場合はSupabaseがエラーを返すだけで例外は出ない）
  const{error}=await supabase
    .from('profiles')
    .update({...updates,current_page:isOnline?'ChatHub':''})
    .eq('id',state.currentProfile.id);

  // current_page が存在しない場合はフォールバック
  if(error&&error.message?.includes('current_page')){
    await supabase.from('profiles').update(updates).eq('id',state.currentProfile.id);
  }
}

// ハートビート（30秒ごと）
function startOnlineHeartbeat(){
  if(state.onlineHeartbeatInterval)clearInterval(state.onlineHeartbeatInterval);
  const interval=setInterval(async()=>{
    if(!document.hidden){
      try{await updateOnlineStatus(true);}catch(e){}
    }
  },30000);
  updateState('onlineHeartbeatInterval',interval);
}

// ページ可視性・クローズ時の処理
function setupVisibilityHandlers(){
  document.addEventListener('visibilitychange',async()=>{
    try{
      if(document.hidden)await updateOnlineStatus(false);
      else await updateOnlineStatus(true);
    }catch(e){}
  });

  window.addEventListener('beforeunload',()=>{
    if(!state.currentProfile?.id)return;
    try{
      const data=JSON.stringify({
        is_online:false,
        last_online:new Date().toISOString(),
        current_page:''
      });
      navigator.sendBeacon(
        `${supabase.supabaseUrl}/rest/v1/profiles?id=eq.${state.currentProfile.id}`,
        new Blob([data],{type:'application/json'})
      );
    }catch(e){}
  });
}

// ========================================
// グローバルDM通知購読
// ========================================

function subscribeToGlobalDmNotifications(){
  supabase
    .channel('global-dm-notif-'+state.currentProfile.id)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'dm_messages'},
      (payload)=>{
        try{
          const msg=payload.new;
          if(!msg||msg.sender_id===state.currentProfile.id)return;
          if(isStealthModeActive())return;

          // 現在開いているDMは通知しない（chat-messages.jsで既に処理）
          const currentDmId=getCurrentOpenDmId();
          if(currentDmId&&msg.dm_id===currentDmId)return;

          const sender=state.allUsers.find(u=>u.id===msg.sender_id);
          if(!sender)return;

          showNotification(sender.display_name,msg.text||'画像を送信しました',sender.avatar_url||null);

          // 未読カウント更新
          state.unreadCounts[sender.user_id]=(state.unreadCounts[sender.user_id]||0)+1;
          displayUsers();
        }catch(e){console.error('dm通知エラー:',e);}
      })
    .subscribe((status)=>{
      if(status==='CHANNEL_ERROR'){
        console.warn('グローバルDM購読エラー。3秒後に再接続...');
        setTimeout(()=>{try{subscribeToGlobalDmNotifications();}catch(e){}},3000);
      }
    });
}

function getCurrentOpenDmId(){
  if(!state.selectedUserId)return null;
  const other=state.allUsers.find(u=>u.user_id===state.selectedUserId||u.id===state.selectedUserId);
  if(!other)return null;
  return[state.currentProfile.user_id,other.user_id].sort().join('_');
}

// ========================================
// 呼び出し機能（Supabase Broadcast）
// ========================================

let _callChannel=null;
function subscribeToCallChannel(){
  _callChannel=supabase
    .channel('apphub-calls-v1')
    .on('broadcast',{event:'call'},(data)=>{
      try{
        const payload=data.payload;
        if(!payload||payload.target_id!==state.currentProfile.id)return;
        if(isStealthModeActive())return;
        import('./call-ui.js').then(m=>m.showIncomingCallToast(payload));
      }catch(e){console.error('call受信エラー:',e);}
    })
    .on('broadcast',{event:'call-answer'},(data)=>{window.callEngine?.onCallAnswer(data.payload);})
    .on('broadcast',{event:'call-end'},(data)=>{window.callEngine?.onCallEnd(data.payload);})
    .on('broadcast',{event:'vc-join'},(data)=>{window.callEngine?.onVcJoin(data.payload);})
    .on('broadcast',{event:'vc-leave'},(data)=>{window.callEngine?.onVcLeave(data.payload);})
    .subscribe();
}

// sendCall関数の直下に追加
window.sendCallBroadcast=async function(event,payload){
  if(!_callChannel)return;
  try{await _callChannel.send({type:'broadcast',event,payload});}
  catch(e){console.error('broadcast送信エラー:',e);}
};

// window経由で公開（chat-ui.jsから呼ぶ）
async function sendCall(targetProfileId,targetName){
  if(!_callChannel)return false;
  try{
    await _callChannel.send({
      type:'broadcast',
      event:'call',
      payload:{
        caller_id:state.currentProfile.id,
        caller_name:state.currentProfile.display_name,
        caller_icon:state.currentProfile.avatar_url||null,
        target_id:targetProfileId
      }
    });
    return true;
  }catch(e){
    console.error('呼び出し送信エラー:',e);
    return false;
  }
}
window.sendCall=sendCall;

// ========================================
// ユーザー一覧を読み込む
// ========================================

async function loadUsers(){
  const{data:profiles,error}=await supabase
    .from('profiles')
    .select('*')
    .neq('id',state.currentProfile.id)
    .order('last_online',{ascending:false,nullsFirst:false});

  if(error)throw error;

  updateState('allUsers',profiles||[]);
  await loadUnreadCounts();
  displayUsers();
}

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
      const lastRead=readMap[user.user_id];
      let q=supabase
        .from('dm_messages')
        .select('id',{count:'exact',head:true})
        .eq('dm_id',dmId)
        .neq('sender_id',state.currentProfile.id);
      if(lastRead)q=q.gt('created_at',lastRead);
      const{count}=await q;
      state.unreadCounts[user.user_id]=count||0;
    }

    for(const channel of CHANNELS){
      const lastRead=readMap[channel.id];
      let q=supabase
        .from('channel_messages')
        .select('id',{count:'exact',head:true})
        .eq('channel_id',channel.id)
        .neq('sender_id',state.currentProfile.id);
      if(lastRead)q=q.gt('created_at',lastRead);
      const{count}=await q;
      state.unreadCounts[channel.id]=count||0;
    }
  }catch(e){
    console.error('未読数取得エラー:',e);
  }
}

function autoRestoreLastChat(){
  try{
    const last=localStorage.getItem('chathub_last');
    if(!last)return;
    const{type,id}=JSON.parse(last);
    if(type==='user'&&id)window.selectUser?.(id);
    else if(type==='channel'&&id)window.selectChannel?.(id);
  }catch(e){}
}

function subscribeToProfiles(){
  supabase
    .channel('profiles-chat-changes')
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

function startLastOnlineUpdateTimer(){
  setInterval(()=>{try{displayUsers();}catch(e){}},60000);
}

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

  document.addEventListener('touchend',()=>{clearTimeout(touchTimer);touchTimer=null;},{passive:true});
  document.addEventListener('touchmove',()=>{clearTimeout(touchTimer);touchTimer=null;},{passive:true});

  document.addEventListener('touchstart',(e)=>{
    if(!e.target.closest('.message')&&!e.target.closest('.message-actions')){
      activeMsgEl?.classList.remove('touch-active');
      activeMsgEl=null;
    }
  },{passive:true});
}