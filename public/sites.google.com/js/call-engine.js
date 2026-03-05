// call-engine.js v2.1
import{state}from'./chat-state.js';

export function getPeerId(u){return 'apphub-'+u.substring(0,8);}
function _myId(){return state.currentProfile.id;}
function _myPeerId(){return getPeerId(_myId());}

let peer=null;
let localStream=null;
let screenStream=null;
let dmCall=null;
let pendingCall=null;
let _dmOtherId=null;
let vcStream=null;
let vcId=null;
let vcCalls={};
let _peerGeneration=0; // ③ 再接続時の古いpeerを識別するフラグ

export function initCallEngine(){
  if(typeof Peer==='undefined'){console.error('[call] PeerJS未ロード');return;}
  _createPeer();
}

function _createPeer(){
  if(peer){try{peer.destroy();}catch(e){}}
  peer=null;
  const gen=++_peerGeneration; // この世代番号を閉じ込める

  const p=new Peer(_myPeerId(),{
    debug:0,
    config:{iceServers:[
      {urls:'stun:stun.l.google.com:19302'},
      {urls:'stun:stun1.l.google.com:19302'}
    ]}
  });

  p.on('open',(id)=>{
    if(gen!==_peerGeneration)return; // 古い世代なら無視
    peer=p;
    console.log('[call] PeerJS ready:',id);
  });

  p.on('error',(err)=>{
    if(gen!==_peerGeneration)return;
    console.error('[call] peer error:',err.type,err);
    if(['unavailable-id','network','server-error'].includes(err.type)){
      setTimeout(_createPeer,3000);
    }
    if(err.type==='peer-unavailable'){
      _toast('相手に接続できませんでした');
      _cleanupDm();
      _ui('hideCallModal');
    }
  });

  p.on('disconnected',()=>{
    if(gen!==_peerGeneration)return;
    console.warn('[call] disconnected, reconnecting...');
    try{p.reconnect();}catch(e){setTimeout(_createPeer,3000);}
  });

  p.on('call',(call)=>{
    if(gen!==_peerGeneration)return; // 古い世代なら無視
    if(vcId){
      call.answer(vcStream||undefined);
      _setupVcCall(call,null);
    }else{
      console.log('[call] DM pending from peer:',call.peer);
      if(pendingCall){
        clearTimeout(pendingCall._autoClose);
        try{pendingCall.close();}catch(e){}
      }
      pendingCall=call;
      pendingCall._autoClose=setTimeout(()=>{
        if(pendingCall===call){
          pendingCall=null;
          try{call.close();}catch(e){}
        }
      },30000);
    }
  });

  window.callEngine={
    onCallAnswer:_onCallAnswer,
    onCallEnd:_onCallEnd,
    onVcJoin:_onVcJoin,
    onVcLeave:_onVcLeave,
    onVcSync:_onVcSync,
  };
  console.log('[call] 初期化完了');
}

export async function startDmCall(targetUser){
  if(!peer||!peer.open){_toast('通話エンジン準備中です。少し待ってから再試行してください');return;}
  if(vcId){_toast('ボイスチャンネル参加中は通話できません');return;}
  if(dmCall||pendingCall){_toast('すでに通話中です');return;}

  localStream=await _getMic();
  if(!localStream)return;

  _dmOtherId=targetUser.id;

  const call=peer.call(getPeerId(targetUser.id),localStream);
  if(!call){
    _toast('接続に失敗しました');
    _stopStream(localStream);localStream=null;
    _dmOtherId=null;
    return;
  }
  dmCall=call;

  call.on('stream',(remote)=>{
    _playAudio('dm-remote',remote);
    _ui('updateCallStatus','通話中');
  });
  call.on('close',()=>{
    if(dmCall===call){_cleanupDm();_ui('hideCallModal');}
  });
  call.on('error',(e)=>{
    console.error('[call] dm outgoing err:',e);
    _cleanupDm();
    _ui('hideCallModal');
    _toast('通話エラーが発生しました');
  });

  _broadcast('call',{
    caller_id:_myId(),
    caller_name:state.currentProfile.display_name,
    caller_icon:state.currentProfile.avatar_url||null,
    target_id:targetUser.id,
  });

  _ui('showCallModal',{
    id:targetUser.id,
    display_name:targetUser.display_name,
    avatar_url:targetUser.avatar_url||null,
  },'outgoing');
}

export async function answerDmCall(payload){
  if(!peer||!peer.open){_toast('通話エンジン準備中です');return;}
  if(dmCall){_toast('すでに通話中です');return;}

  localStream=await _getMic();
  if(!localStream){
    _broadcast('call-answer',{caller_id:payload.caller_id,accepted:false});
    return;
  }

  _dmOtherId=payload.caller_id;

  if(!pendingCall){
    await new Promise(resolve=>{
      const deadline=Date.now()+3000;
      const t=setInterval(()=>{
        if(pendingCall||Date.now()>=deadline){clearInterval(t);resolve();}
      },100);
    });
  }

  if(!pendingCall){
    _toast('接続データを受信できませんでした（再度お試しください）');
    _stopStream(localStream);localStream=null;
    _dmOtherId=null;
    _broadcast('call-answer',{caller_id:payload.caller_id,accepted:false});
    return;
  }

  clearTimeout(pendingCall._autoClose);
  const call=pendingCall;
  pendingCall=null;
  dmCall=call;

  call.answer(localStream);

  call.on('stream',(remote)=>{
    _playAudio('dm-remote',remote);
    _ui('updateCallStatus','通話中');
  });
  call.on('close',()=>{
    if(dmCall===call){_cleanupDm();_ui('hideCallModal');}
  });
  call.on('error',(e)=>{
    console.error('[call] dm answer err:',e);
    _cleanupDm();
    _ui('hideCallModal');
    _toast('通話エラーが発生しました');
  });

  _broadcast('call-answer',{caller_id:payload.caller_id,accepted:true});

  _ui('showCallModal',{
    id:payload.caller_id,
    display_name:payload.caller_name,
    avatar_url:payload.caller_icon||null,
  },'incoming'); // ② 'active' → 'incoming' に修正
}

export function rejectDmCall(payload){
  if(pendingCall){
    clearTimeout(pendingCall._autoClose);
    try{pendingCall.close();}catch(e){}
    pendingCall=null;
  }
  _broadcast('call-answer',{caller_id:payload.caller_id,accepted:false});
}

export function endCall(){
  _broadcast('call-end',{
    caller_id:_myId(),
    target_id:_dmOtherId||'',
  });
  _cleanupDm();
  _ui('hideCallModal');
}

function _onCallAnswer(payload){
  if(payload.caller_id!==_myId())return;
  if(payload.accepted){
    _ui('updateCallStatus','接続中...');
  }else{
    _cleanupDm();
    _ui('hideCallModal');
    _toast('通話が拒否されました');
  }
}

function _onCallEnd(payload){
  if(payload.caller_id===_myId()||payload.target_id===_myId()){
    _cleanupDm();
    _ui('hideCallModal');
  }
}

export async function joinVoiceChannel(channelId){
  if(!peer||!peer.open){_toast('通話エンジン準備中です');return;}
  if(dmCall){_toast('通話中はボイスチャンネルに入れません');return;}
  if(vcId)leaveVoiceChannel();

  vcStream=await _getMic();
  if(!vcStream)return;

  vcId=channelId;
  window.currentVcChannelId=channelId;

  _broadcast('vc-join',{
    channel_id:channelId,
    user_id:_myId(),
    peer_id:_myPeerId(),
    user_name:state.currentProfile.display_name,
    avatar_url:state.currentProfile.avatar_url||null,
  });

  _ui('showVoiceChannelUI',channelId);
}

function _onVcJoin(payload){
  if(payload.channel_id!==vcId)return;
  if(payload.user_id===_myId())return;
  if(!peer||!peer.open||!vcStream)return;

  const call=peer.call(payload.peer_id,vcStream);
  _setupVcCall(call,payload);

  _broadcast('vc-sync',{
    channel_id:vcId,
    user_id:_myId(),
    peer_id:_myPeerId(),
    user_name:state.currentProfile.display_name,
    avatar_url:state.currentProfile.avatar_url||null,
  });
}

function _onVcSync(payload){
  if(payload.channel_id!==vcId)return;
  if(payload.user_id===_myId())return;
  _ui('addVcParticipant',payload);
}

function _onVcLeave(payload){
  if(payload.channel_id!==vcId)return;
  try{vcCalls[payload.peer_id]?.close();}catch(e){}
  delete vcCalls[payload.peer_id];
  _removeAudio(payload.peer_id);
  _ui('removeVcParticipant',payload.peer_id);
}

function _setupVcCall(call,payload){
  vcCalls[call.peer]=call;
  call.on('stream',(remote)=>{
    _playAudio(call.peer,remote);
    if(payload)_ui('addVcParticipant',payload);
    else _ui('addVcParticipantAudio',call.peer);
  });
  call.on('close',()=>{
    _removeAudio(call.peer);
    delete vcCalls[call.peer];
    _ui('removeVcParticipant',call.peer);
  });
  call.on('error',(e)=>console.error('[call] vc call err:',e));
}

export function leaveVoiceChannel(){
  if(!vcId)return;
  const ch=vcId;
  Object.values(vcCalls).forEach(c=>{try{c.close();}catch(e){}});
  vcCalls={};
  _stopStream(vcStream);vcStream=null;
  vcId=null;
  window.currentVcChannelId=null;
  document.querySelectorAll('.call-audio').forEach(a=>a.remove());
  _broadcast('vc-leave',{
    channel_id:ch,
    user_id:_myId(),
    peer_id:_myPeerId(),
  });
  _ui('hideVoiceChannelUI');
}

export function toggleMic(){
  const s=vcStream||localStream;
  const t=s?.getAudioTracks()[0];
  if(!t)return false;
  t.enabled=!t.enabled;
  return !t.enabled;
}

export async function toggleScreenShare(){
  if(screenStream){_stopStream(screenStream);screenStream=null;return false;}
  try{
    screenStream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});
    screenStream.getVideoTracks()[0].addEventListener('ended',()=>{
      screenStream=null;
      _ui('onScreenShareEnded');
    });
    return true;
  }catch(e){return false;}
}

async function _getMic(){
  try{
    return await navigator.mediaDevices.getUserMedia({audio:true,video:false});
  }catch(e){
    _toast('マイクへのアクセスを許可してください');
    return null;
  }
}

function _playAudio(id,stream){
  _removeAudio(id);
  const a=document.createElement('audio');
  a.srcObject=stream;a.autoplay=true;
  a.className='call-audio';a.dataset.audioId=id;
  document.body.appendChild(a);
}
function _removeAudio(id){document.querySelector('.call-audio[data-audio-id="'+id+'"]')?.remove();}
function _stopStream(s){s?.getTracks().forEach(t=>{try{t.stop();}catch(e){}});}
function _cleanupDm(){
  try{dmCall?.close();}catch(e){}
  dmCall=null;
  if(pendingCall){
    clearTimeout(pendingCall._autoClose);
    try{pendingCall.close();}catch(e){}
    pendingCall=null;
  }
  _stopStream(localStream);localStream=null;
  _stopStream(screenStream);screenStream=null;
  _removeAudio('dm-remote');
  _dmOtherId=null;
}
function _broadcast(event,payload){window.sendCallBroadcast?.(event,payload);}
function _ui(fn,...args){
  import('./call-ui.js').then(m=>{
    if(typeof m[fn]==='function')m[fn](...args);
  }).catch(e=>console.error('[call] ui error:',fn,e));
}
function _toast(msg){
  const t=document.createElement('div');
  t.textContent=msg;
  t.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--text-primary,#111);color:var(--bg-primary,#fff);padding:8px 18px;border-radius:20px;font-size:13px;z-index:99999;white-space:nowrap;pointer-events:none;';
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),3000);
}
