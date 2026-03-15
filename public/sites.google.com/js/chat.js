// チャットアプリのメインファイル（Supabase版）【DEBUG版】
console.log('[DEBUG] chat.js: ファイル読み込み開始');

import{initPage,supabase}from'../common/core.js';
import{state,updateState,fetchChannels,fetchUserCommunities,DEFAULT_COMMUNITY_ID}from'./chat-state.js';
import{displayUsers,renderCommunitySwitcher}from'./chat-ui.js';
import{requestNotificationPermission,showNotification}from'./chat-utils.js';
import'./chat-handlers.js';
import'./chat-modals.js';
import{initCallEngine}from'./call-engine.js';

console.log('[DEBUG] chat.js: import完了');
console.log('[DEBUG] supabase:', typeof supabase, supabase ? '✅' : '❌NULL');
console.log('[DEBUG] state:', typeof state, state ? '✅' : '❌NULL');

// ★ TDZ確認のため宣言を最上位に移動
let _callChannel=null;
console.log('[DEBUG] _callChannel宣言完了:', _callChannel);

function isStealthModeActive(){
  const saved=localStorage.getItem('stealthModeState');
  if(saved){try{return JSON.parse(saved).stealthMode;}catch(e){return false;}}
  return false;
}

console.log('[DEBUG] chat.js: initPage呼び出し前');

// ページ初期化
await initPage('chat','ChatHub',{
  onUserLoaded:async(profile)=>{
    console.log('[DEBUG] onUserLoaded開始 profile:', profile?.id, profile?.display_name);
    updateState('currentProfile',profile);

    console.log('[DEBUG] 1: updateOnlineStatus開始');
    try{await updateOnlineStatus(true);console.log('[DEBUG] 1: updateOnlineStatus ✅');}
    catch(e){console.error('[DEBUG] 1: updateOnlineStatus ❌', e);}

    console.log('[DEBUG] 2: requestNotificationPermission開始');
    try{await requestNotificationPermission();console.log('[DEBUG] 2: requestNotificationPermission ✅');}
    catch(e){console.warn('[DEBUG] 2: requestNotificationPermission ❌', e);}

    try{
  const communities=await fetchUserCommunities(profile.id);
  updateState('communities',communities);
  const firstId=communities[0]?.id||DEFAULT_COMMUNITY_ID;
  updateState('currentCommunityId',firstId);
  const channels=await fetchChannels(firstId);
  updateState('channels',channels);
  renderCommunitySwitcher();
}catch(e){console.error('[communities/channels fetch]',e);}
    try{await loadUsers();renderCommunitySwitcher();console.log('[DEBUG] 3: loadUsers ✅ ユーザー数:', state.allUsers?.length);}
    catch(e){console.error('[DEBUG] 3: loadUsers ❌', e);}

    console.log('[DEBUG] 4: autoRestoreLastChat開始');
    try{autoRestoreLastChat();console.log('[DEBUG] 4: autoRestoreLastChat ✅');}
    catch(e){console.error('[DEBUG] 4: autoRestoreLastChat ❌', e);}

    console.log('[DEBUG] 5: subscribeToProfiles開始');
    try{subscribeToProfiles();console.log('[DEBUG] 5: subscribeToProfiles ✅');}
    catch(e){console.error('[DEBUG] 5: subscribeToProfiles ❌', e);}

    console.log('[DEBUG] 6: subscribeToGlobalDmNotifications開始');
    try{subscribeToGlobalDmNotifications();console.log('[DEBUG] 6: subscribeToGlobalDmNotifications ✅');}
    catch(e){console.error('[DEBUG] 6: subscribeToGlobalDmNotifications ❌', e);}

    console.log('[DEBUG] 7: subscribeToCallChannel開始');
    console.log('[DEBUG] 7: _callChannelの現在値:', _callChannel);
    console.log('[DEBUG] 7: supabaseの型:', typeof supabase);
    try{
      subscribeToCallChannel();
      console.log('[DEBUG] 7: subscribeToCallChannel ✅ _callChannel:', _callChannel ? '設定済み✅' : '❌NULL');
    }
    catch(e){console.error('[DEBUG] 7: subscribeToCallChannel ❌', e.message, e);}

    console.log('[DEBUG] 8: startLastOnlineUpdateTimer開始');
    try{startLastOnlineUpdateTimer();console.log('[DEBUG] 8: startLastOnlineUpdateTimer ✅');}
    catch(e){console.error('[DEBUG] 8: startLastOnlineUpdateTimer ❌', e);}

    console.log('[DEBUG] 9: startOnlineHeartbeat開始');
    try{startOnlineHeartbeat();console.log('[DEBUG] 9: startOnlineHeartbeat ✅');}
    catch(e){console.error('[DEBUG] 9: startOnlineHeartbeat ❌', e);}

    console.log('[DEBUG] 10: setupVisibilityHandlers開始');
    try{setupVisibilityHandlers();console.log('[DEBUG] 10: setupVisibilityHandlers ✅');}
    catch(e){console.error('[DEBUG] 10: setupVisibilityHandlers ❌', e);}

    console.log('[DEBUG] 11: setupMobileTouchActions開始');
    try{setupMobileTouchActions();console.log('[DEBUG] 11: setupMobileTouchActions ✅');}
    catch(e){console.error('[DEBUG] 11: setupMobileTouchActions ❌', e);}

    console.log('[DEBUG] 12: initCallEngine開始');
    console.log('[DEBUG] 12: window.callEngine before:', window.callEngine);
    try{
      initCallEngine();
      console.log('[DEBUG] 12: initCallEngine ✅');
      setTimeout(()=>{
        console.log('[DEBUG] 12: initCallEngine 500ms後 window.callEngine:', window.callEngine ? '設定済み✅' : '❌未設定');
      },500);
    }
    catch(e){console.error('[DEBUG] 12: initCallEngine ❌', e);}

    window._appState=state;
window._loadUsersByCommunity=loadUsers;
    console.log('[DEBUG] onUserLoaded完了 ✅');

    if(isMobile()){
      setTimeout(()=>{
        if(!state.selectedUserId&&!state.selectedChannelId){
          document.querySelector('.dm-sidebar')?.classList.add('show');
        }
      },200);
    }
  }
});

console.log('[DEBUG] chat.js: initPage呼び出し完了（await）');

function isMobile(){
  return window.innerWidth<=768;
}

// ========================================
// オンライン状態を更新
// ========================================

async function updateOnlineStatus(isOnline){
  if(!state.currentProfile?.id){
    console.warn('[DEBUG] updateOnlineStatus: currentProfile.idなし');
    return;
  }
  const updates={
    is_online:isOnline,
    last_online:new Date().toISOString()
  };
  const{error}=await supabase
    .from('profiles')
    .update({...updates,current_page:isOnline?'ChatHub':''})
    .eq('id',state.currentProfile.id);
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
    try{
      import('./call-engine.js').then(m=>{
        m.endCall?.();
        m.leaveVoiceChannel?.();
      });
    }catch(e){}

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
  console.log('[DEBUG] subscribeToGlobalDmNotifications: 購読開始 userId:', state.currentProfile?.id);
  supabase
    .channel('global-dm-notif-'+state.currentProfile.id)
    .on('postgres_changes',{event:'INSERT',schema:'public',table:'dm_messages'},
      (payload)=>{
        try{
          const msg=payload.new;
          if(!msg||msg.sender_id===state.currentProfile.id)return;
          if(isStealthModeActive())return;

          const currentDmId=getCurrentOpenDmId();
          if(currentDmId&&msg.dm_id===currentDmId)return;

          const sender=state.allUsers.find(u=>u.id===msg.sender_id);
          if(!sender)return;

          showNotification(sender.display_name,msg.text||'画像を送信しました',sender.avatar_url||null);

          state.unreadCounts[sender.user_id]=(state.unreadCounts[sender.user_id]||0)+1;
          displayUsers();
        }catch(e){console.error('dm通知エラー:',e);}
      })
    .subscribe((status)=>{
      console.log('[DEBUG] globalDmNotif購読ステータス:', status);
      if(status==='CHANNEL_ERROR'){
        console.warn('[DEBUG] グローバルDM購読エラー。3秒後に再接続...');
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

function subscribeToCallChannel(){
  console.log('[DEBUG] subscribeToCallChannel: 開始');
  console.log('[DEBUG] subscribeToCallChannel: supabase型:', typeof supabase);
  console.log('[DEBUG] subscribeToCallChannel: _callChannel現在値:', _callChannel);

  _callChannel=supabase
    .channel('apphub-calls-v1')
    .on('broadcast',{event:'call'},(data)=>{
      console.log('[DEBUG] broadcast受信: call', data.payload);
      try{
        const payload=data.payload;
        if(!payload||payload.target_id!==state.currentProfile.id)return;
        if(isStealthModeActive())return;
        import('./call-ui.js').then(m=>m.showIncomingCallToast(payload));
      }catch(e){console.error('call受信エラー:',e);}
    })
    .on('broadcast',{event:'call-answer'},(data)=>{
      console.log('[DEBUG] broadcast受信: call-answer', data.payload);
      window.callEngine?.onCallAnswer(data.payload);
    })
    .on('broadcast',{event:'call-end'},(data)=>{
      console.log('[DEBUG] broadcast受信: call-end', data.payload);
      window.callEngine?.onCallEnd(data.payload);
    })
    .on('broadcast',{event:'vc-join'},(data)=>{
      console.log('[DEBUG] broadcast受信: vc-join', data.payload);
      window.callEngine?.onVcJoin(data.payload);
    })
    .on('broadcast',{event:'vc-leave'},(data)=>{
      console.log('[DEBUG] broadcast受信: vc-leave', data.payload);
      window.callEngine?.onVcLeave(data.payload);
    })
    .on('broadcast',{event:'vc-sync'},(data)=>{
      console.log('[DEBUG] broadcast受信: vc-sync', data.payload);
      window.callEngine?.onVcSync(data.payload);
    })
    .subscribe((status)=>{
      console.log('[DEBUG] callChannel購読ステータス:', status);
      if(status==='SUBSCRIBED'){
        console.log('[DEBUG] callChannel ✅ 購読成功！');
      }else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){
        console.error('[DEBUG] callChannel ❌ 購読失敗:', status);
      }
    });

  console.log('[DEBUG] subscribeToCallChannel: _callChannel設定後:', _callChannel ? '✅' : '❌NULL');
}

window.sendCallBroadcast=async function(event,payload){
  console.log('[DEBUG] sendCallBroadcast:', event, payload);
  if(!_callChannel){
    console.error('[DEBUG] sendCallBroadcast: _callChannelがNULL！送信できません');
    return;
  }
  try{
    await _callChannel.send({type:'broadcast',event,payload});
    console.log('[DEBUG] sendCallBroadcast: 送信成功 ✅');
  }
  catch(e){console.error('[DEBUG] broadcast送信エラー:',e);}
};

// ========================================
// ユーザー一覧を読み込む
// ========================================

async function loadUsers(communityId=null){
  console.log('[DEBUG] loadUsers: 開始');
  const cid=communityId||state.currentCommunityId;
  const{data:members,error:me}=await supabase
    .from('community_members')
    .select('user_id')
    .eq('community_id',cid);
  if(me){console.error('[DEBUG] loadUsers: members ❌',me);throw me;}
  const memberIds=(members||[]).map(m=>m.user_id).filter(id=>id!==state.currentProfile.id);
  if(memberIds.length===0){
    updateState('allUsers',[]);
    displayUsers();
    return;
  }
  const{data:profiles,error}=await supabase
    .from('profiles')
    .select('*')
    .in('id',memberIds)
    .order('last_online',{ascending:false,nullsFirst:false});
  if(error){
    console.error('[DEBUG] loadUsers: ❌ クエリエラー', error);
    throw error;
  }
  console.log('[DEBUG] loadUsers: 取得プロフィール数:', profiles?.length);
  updateState('allUsers',profiles||[]);
  await loadUnreadCounts();
  displayUsers();
  console.log('[DEBUG] loadUsers: 完了');
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

    for(const channel of state.channels){
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
    console.error('[DEBUG] loadUnreadCounts: ❌', e);
  }
}

function autoRestoreLastChat(){
  console.log('[DEBUG] autoRestoreLastChat: 開始');
  try{
    const last=localStorage.getItem('chathub_last');
    if(!last){console.log('[DEBUG] autoRestoreLastChat: 保存データなし');return;}
    const{type,id}=JSON.parse(last);
    console.log('[DEBUG] autoRestoreLastChat: 復元 type:', type, 'id:', id);
    if(type==='user'&&id)window.selectUser?.(id);
    else if(type==='channel'&&id)window.selectChannel?.(id);
  }catch(e){
    console.error('[DEBUG] autoRestoreLastChat: ❌', e);
  }
}

function subscribeToProfiles(){
  console.log('[DEBUG] subscribeToProfiles: 購読開始');
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
    .subscribe((status)=>{
      console.log('[DEBUG] profiles購読ステータス:', status);
    });
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
