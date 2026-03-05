// call-engine.js — WebRTC/PeerJS コア (v1.8.2)
import{state}from'./chat-state.js';

export function getPeerId(userId){
  return 'apphub-'+userId.substring(0,8);
}

let peer=null;
let localStream=null;
let screenStream=null;
let currentCall=null;
let vcConnections={};
let vcStream=null;
let currentVcId=null;
let _dmTargetId=null;

export function initCallEngine(){
  if(typeof Peer==='undefined'){console.error('[callEngine] PeerJS未ロード');return;}
  const peerId=getPeerId(state.currentProfile.id);
  peer=new Peer(peerId,{
    debug:0,
    config:{iceServers:[
      {urls:'stun:stun.l.google.com:19302'},
      {urls:'stun:stun1.l.google.com:19302'}
    ]}
  });
  peer.on('open',(id)=>console.log('[callEngine] PeerJS ready:',id));
  peer.on('error',(err)=>{
    console.error('[callEngine] PeerJS err:',err.type,err);
    if(err.type==='unavailable-id'||err.type==='network'||err.type==='server-error'){
      setTimeout(()=>{
        try{peer.destroy();}catch(e){}
        peer=null;
        initCallEngine();
      },3000);
    }
    if(err.type==='peer-unavailable'){
      _cleanupDmCall();
      import('./call-ui.js').then(m=>m.hideCallModal());
      _miniToast('相手に接続できませんでした');
    }
  });
  peer.on('call',(call)=>{
    const stream=vcStream||localStream||undefined;
    call.answer(stream);
    call.on('stream',(remote)=>{
      if(currentVcId){
        _addAudio(call.peer,remote);
        vcConnections[call.peer]=call;
        import('./call-ui.js').then(m=>m.addVcParticipantAudio(call.peer));
      }else{
        _addAudio('dm-remote',remote);
        currentCall=call;
        import('./call-ui.js').then(m=>m.updateCallStatus('通話中'));
      }
    });
    // [fix⑤] VC/DM を正しく分岐してクリーンアップ
    // 旧: _removeAudio(call.peer) → DM通話では 'dm-remote' が消えない致命的バグ
    // 旧: _cleanupDmCall() を呼ばない → currentCall が残り次回「通話中です」になるバグ
    call.on('close',()=>{
      if(vcConnections[call.peer]){
        _removeAudio(call.peer);
        delete vcConnections[call.peer];
      }else{
        _cleanupDmCall();
        import('./call-ui.js').then(m=>m.hideCallModal());
      }
    });
    call.on('error',(e)=>console.error('[callEngine] incoming call err:',e));
  });
  window.callEngine={onCallAnswer,onCallEnd,onVcJoin,onVcLeave,onVcSync};
  console.log('[callEngine] 初期化完了');
}

export async function startDmCall(targetUser){
  // [fix⑥] peer.open チェック追加（PeerJSサーバー未接続でも peer!=null になるため）
  if(!peer||!peer.open){_miniToast('通話エンジン接続中です。少し待ってから再試行してください');return;}
  if(currentVcId){_miniToast('ボイスチャンネル参加中は通話できません');return;}
  if(currentCall){_miniToast('すでに通話中です');return;}
  try{
    localStream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
  }catch(e){
    _miniToast('マイクへのアクセスを許可してください');
    return;
  }
  _dmTargetId=targetUser.id;
  const{showCallModal}=await import('./call-ui.js');
  showCallModal(targetUser,'outgoing');
  window.sendCallBroadcast('call',{
    caller_id:state.currentProfile.id,
    caller_name:state.currentProfile.display_name,
    caller_icon:state.currentProfile.avatar_url||null,
    target_id:targetUser.id,
    peer_id:getPeerId(state.currentProfile.id)
  });
}

export async function answerDmCall(payload){
  // [fix⑥] peer.open チェック追加
  if(!peer||!peer.open){_miniToast('通話エンジン接続中です。少し待ってから再試行してください');return;}
  try{
    localStream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
  }catch(e){
    _miniToast('マイクへのアクセスを許可してください');
    window.sendCallBroadcast('call-answer',{caller_id:payload.caller_id,accepted:false});
    return;
  }
  _dmTargetId=payload.caller_id;
  window.sendCallBroadcast('call-answer',{
    caller_id:payload.caller_id,
    accepted:true,
    peer_id:getPeerId(state.currentProfile.id)
  });
  const callerPeerId=payload.peer_id||getPeerId(payload.caller_id);
  currentCall=peer.call(callerPeerId,localStream);
  currentCall.on('stream',(remote)=>{
    _addAudio('dm-remote',remote);
    import('./call-ui.js').then(m=>m.updateCallStatus('通話中'));
  });
  currentCall.on('close',()=>_cleanupDmCall());
  currentCall.on('error',(e)=>console.error('[callEngine] dm call err:',e));
  const{showCallModal}=await import('./call-ui.js');
  // [fix③] 'active' → 'incoming' に修正
  showCallModal({
    id:payload.caller_id,
    display_name:payload.caller_name,
    avatar_url:payload.caller_icon||null
  },'incoming');
}

export function rejectDmCall(payload){
  window.sendCallBroadcast('call-answer',{caller_id:payload.caller_id,accepted:false});
}

export function endCall(){
  window.sendCallBroadcast('call-end',{
    caller_id:state.currentProfile.id,
    target_id:_dmTargetId||''
  });
  _cleanupDmCall();
  import('./call-ui.js').then(m=>m.hideCallModal());
}

function onCallAnswer(payload){
  if(payload.caller_id!==state.currentProfile.id)return;
  if(payload.accepted){
    import('./call-ui.js').then(m=>m.updateCallStatus('接続中...'));
  }else{
    _cleanupDmCall();
    import('./call-ui.js').then(m=>m.hideCallModal());
    _miniToast('通話が拒否されました');
  }
}

function onCallEnd(payload){
  const myId=state.currentProfile.id;
  if(payload.caller_id===myId||payload.target_id===myId){
    _cleanupDmCall();
    import('./call-ui.js').then(m=>m.hideCallModal());
  }
}

export async function joinVoiceChannel(channelId){
  if(!peer||!peer.open){_miniToast('通話エンジン接続中です。少し待ってから再試行してください');return;}
  if(currentCall){_miniToast('通話中はボイスチャンネルに入れません');return;}
  if(currentVcId)leaveVoiceChannel();
  try{
    vcStream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
  }catch(e){
    _miniToast('マイクへのアクセスを許可してください');
    return;
  }
  currentVcId=channelId;
  window.currentVcChannelId=channelId;
  window.sendCallBroadcast('vc-join',{
    channel_id:channelId,
    user_id:state.currentProfile.id,
    peer_id:getPeerId(state.currentProfile.id),
    user_name:state.currentProfile.display_name,
    avatar_url:state.currentProfile.avatar_url||null
  });
  import('./call-ui.js').then(m=>m.showVoiceChannelUI(channelId));
}

function onVcJoin(payload){
  if(payload.channel_id!==currentVcId)return;
  if(payload.user_id===state.currentProfile.id)return;
  if(!peer||!vcStream)return;
  window.sendCallBroadcast('vc-sync',{
    channel_id:currentVcId,
    user_id:state.currentProfile.id,
    peer_id:getPeerId(state.currentProfile.id),
    user_name:state.currentProfile.display_name,
    avatar_url:state.currentProfile.avatar_url||null
  });
  const call=peer.call(payload.peer_id,vcStream);
  call.on('stream',(remote)=>{
    _addAudio(payload.peer_id,remote);
    vcConnections[payload.peer_id]=call;
    import('./call-ui.js').then(m=>m.addVcParticipant(payload));
  });
  call.on('close',()=>{
    _removeAudio(payload.peer_id);
    delete vcConnections[payload.peer_id];
    import('./call-ui.js').then(m=>m.removeVcParticipant(payload.peer_id));
  });
  call.on('error',(e)=>console.error('[callEngine] vc call err:',e));
}

function onVcSync(payload){
  if(payload.channel_id!==currentVcId)return;
  if(payload.user_id===state.currentProfile.id)return;
  import('./call-ui.js').then(m=>m.addVcParticipant(payload));
}

function onVcLeave(payload){
  if(payload.channel_id!==currentVcId)return;
  try{vcConnections[payload.peer_id]?.close();}catch(e){}
  delete vcConnections[payload.peer_id];
  _removeAudio(payload.peer_id);
  import('./call-ui.js').then(m=>m.removeVcParticipant(payload.peer_id));
}

export function leaveVoiceChannel(){
  if(!currentVcId)return;
  const chId=currentVcId;
  Object.values(vcConnections).forEach(c=>{try{c.close();}catch(e){}});
  vcConnections={};
  _stopStream(vcStream);
  vcStream=null;
  currentVcId=null;
  window.currentVcChannelId=null;
  document.querySelectorAll('.call-audio').forEach(el=>el.remove());
  window.sendCallBroadcast('vc-leave',{
    channel_id:chId,
    user_id:state.currentProfile.id,
    peer_id:getPeerId(state.currentProfile.id)
  });
  import('./call-ui.js').then(m=>m.hideVoiceChannelUI());
}

export function toggleMic(){
  const stream=vcStream||localStream;
  const track=stream?.getAudioTracks()[0];
  if(!track)return false;
  track.enabled=!track.enabled;
  return !track.enabled;
}

export async function toggleScreenShare(){
  if(screenStream){_stopStream(screenStream);screenStream=null;return false;}
  try{
    screenStream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});
    screenStream.getVideoTracks()[0].addEventListener('ended',()=>{
      screenStream=null;
      import('./call-ui.js').then(m=>m.onScreenShareEnded());
    });
    return true;
  }catch(e){return false;}
}

function _addAudio(id,stream){
  _removeAudio(id);
  const a=document.createElement('audio');
  a.srcObject=stream;a.autoplay=true;
  a.className='call-audio';a.dataset.audioId=id;
  document.body.appendChild(a);
}
function _removeAudio(id){
  document.querySelector('.call-audio[data-audio-id="'+id+'"]')?.remove();
}
function _stopStream(s){s?.getTracks().forEach(t=>{try{t.stop();}catch(e){}});}
function _cleanupDmCall(){
  currentCall?.close();currentCall=null;
  _stopStream(localStream);localStream=null;
  _stopStream(screenStream);screenStream=null;
  _removeAudio('dm-remote');
  _dmTargetId=null;
}
function _miniToast(msg){
  const t=document.createElement('div');
  t.textContent=msg;
  t.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--text-primary,#111);color:var(--bg-primary,#fff);padding:8px 18px;border-radius:20px;font-size:13px;z-index:99999;white-space:nowrap;pointer-events:none;';
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),3000);
}
