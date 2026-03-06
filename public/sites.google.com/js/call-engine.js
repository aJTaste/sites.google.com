// call-engine.js v3.1
import{state}from'./chat-state.js';

export function getPeerId(u){return 'apphub-'+u.substring(0,8);}
function _myId(){return state.currentProfile.id;}
function _myPeerId(){return getPeerId(_myId());}

let peer=null;
let localStream=null;
let screenStream=null;
let _blankVideoTrack=null;
let dmCall=null;
let pendingCall=null;
let _dmOtherId=null;
let vcStream=null;
let vcId=null;
let vcCalls={};
let _peerGeneration=0;

// [Fix①] a.relay.metered.ca の認証情報が無効なため削除
// openrelay.metered.ca のみ使用（学校ネットワークでTCP/TLS443でも動作）
const ICE_SERVERS=[
  {urls:'stun:stun.l.google.com:19302'},
  {urls:'stun:stun1.l.google.com:19302'},
  {urls:'stun:stun.cloudflare.com:3478'},
  {
    urls:[
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turns:openrelay.metered.ca:443'
    ],
    username:'openrelayproject',
    credential:'openrelayproject'
  }
];

function _createBlankVideoTrack(){
  try{
    const canvas=document.createElement('canvas');
    canvas.width=2;canvas.height=2;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#000';
    ctx.fillRect(0,0,2,2);
    const stream=canvas.captureStream(1);
    const track=stream.getVideoTracks()[0];
    return track||null;
  }catch(e){
    console.warn('[call] blank video track作成失敗:',e);
    return null;
  }
}

export function initCallEngine(){
  if(typeof Peer==='undefined'){console.error('[call] PeerJS未ロード');return;}
  _createPeer();
}

function _createPeer(){
  if(peer){try{peer.destroy();}catch(e){}}
  peer=null;
  const gen=++_peerGeneration;

  const p=new Peer(_myPeerId(),{
    debug:0,
    config:{
      iceServers:ICE_SERVERS,
      iceTransportPolicy:'all'
    }
  });

  p.on('open',(id)=>{
    if(gen!==_peerGeneration)return;
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
    if(gen!==_peerGeneration)return;
    if(vcId){
      // [Fix②] vcStreamがnullの場合は無音で応答せず、マイク再取得を試みる
      if(vcStream){
        call.answer(vcStream);
      }else{
        _getMic().then(s=>{
          if(s){vcStream=s;}
          call.answer(vcStream||new MediaStream());
        });
      }
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

async function _getMicWithVideo(){
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
    _blankVideoTrack=_createBlankVideoTrack();
    if(_blankVideoTrack)stream.addTrack(_blankVideoTrack);
    return stream;
  }catch(e){
    _toast('マイクへのアクセスを許可してください');
    return null;
  }
}

async function _getMic(){
  try{
    return await navigator.mediaDevices.getUserMedia({audio:true,video:false});
  }catch(e){
    _toast('マイクへのアクセスを許可してください');
    return null;
  }
}

export async function startDmCall(targetUser){
  if(!peer||!peer.open){_toast('通話エンジン準備中です。少し待ってから再試行してください');return;}
  if(vcId){_toast('ボイスチャンネル参加中は通話できません');return;}
  if(dmCall||pendingCall){_toast('すでに通話中です');return;}

  localStream=await _getMicWithVideo();
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
    _playMedia('dm-remote',remote);
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

  localStream=await _getMicWithVideo();
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
    _playMedia('dm-remote',remote);
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
  },'incoming');
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

  // [Fix③] WebRTC接続完了（stream到着）を待たず即座にUIへ表示
  // → ICE失敗時でも参加者アイコンが表示される
  _ui('addVcParticipant',payload);

  const call=peer.call(payload.peer_id,vcStream);
  if(!call){
    console.error('[call] peer.call失敗: peer_id=',payload.peer_id);
    return;
  }
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
  _removeMedia(payload.peer_id);
  _ui('removeVcParticipant',payload.peer_id);
}

function _setupVcCall(call,payload){
  vcCalls[call.peer]=call;
  call.on('stream',(remote)=>{
    _playMedia(call.peer,remote);
    // payloadがある（発信側）はstream到着時に再描画、ない（着信側）はaddVcParticipantAudio
    if(payload)_ui('addVcParticipant',payload);
    else _ui('addVcParticipantAudio',call.peer);
  });
  call.on('close',()=>{
    _removeMedia(call.peer);
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
  document.querySelectorAll('.call-audio,.call-video').forEach(a=>a.remove());
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
  if(screenStream){
    _stopStream(screenStream);
    screenStream=null;
    if(_blankVideoTrack){
      _replaceVideoSender(_blankVideoTrack);
    }
    _ui('onScreenShareEnded');
    return false;
  }
  try{
    screenStream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});
    const videoTrack=screenStream.getVideoTracks()[0];
    if(!videoTrack){
      _stopStream(screenStream);screenStream=null;
      return false;
    }
    videoTrack.addEventListener('ended',()=>{
      screenStream=null;
      if(_blankVideoTrack)_replaceVideoSender(_blankVideoTrack);
      _ui('onScreenShareEnded');
    });
    await _replaceVideoSender(videoTrack);
    return true;
  }catch(e){
    console.error('[call] screen share err:',e);
    return false;
  }
}

// [Fix④] ビデオ送信スロットがない場合はaddTrackで追加（ブランクトラック作成失敗時の対策）
async function _replaceVideoSender(newTrack){
  const calls=[dmCall,...Object.values(vcCalls)].filter(Boolean);
  for(const c of calls){
    try{
      const pc=c.peerConnection;
      if(!pc)continue;
      const senders=pc.getSenders();
      const videoSender=senders.find(s=>s.track&&s.track.kind==='video');
      if(videoSender){
        await videoSender.replaceTrack(newTrack);
      }else{
        // 送信スロットがない場合はaddTrackで追加
        const baseStream=localStream||vcStream||new MediaStream([newTrack]);
        pc.addTrack(newTrack,baseStream);
      }
    }catch(e){
      console.error('[call] replaceVideoSender err:',e);
    }
  }
}

function _playMedia(id,stream){
  _removeMedia(id);

  if(stream.getAudioTracks().length>0){
    const audioStream=new MediaStream(stream.getAudioTracks());
    const a=document.createElement('audio');
    a.srcObject=audioStream;
    a.autoplay=true;
    a.className='call-audio';
    a.dataset.audioId=id;
    document.body.appendChild(a);
    a.play().catch(()=>{
      const resume=()=>{a.play().catch(()=>{});document.removeEventListener('click',resume);};
      document.addEventListener('click',resume,{once:true});
    });
  }

  const videoTracks=stream.getVideoTracks();
  if(videoTracks.length>0){
    const videoStream=new MediaStream(videoTracks);
    const v=document.createElement('video');
    v.srcObject=videoStream;
    v.autoplay=true;
    v.playsInline=true;
    v.muted=true;
    v.className='call-video';
    v.dataset.audioId=id;
    v.style.cssText='display:none;width:100%;height:100%;object-fit:contain;background:#000;border-radius:8px;';
    document.body.appendChild(v);
    v.play().catch(()=>{});

    v.addEventListener('loadedmetadata',()=>{
      if(v.videoWidth>2){
        _ui('showRemoteVideo',id,v);
      }
    });

    videoTracks[0].addEventListener('unmute',()=>{
      if(v.videoWidth>2)_ui('showRemoteVideo',id,v);
    });
  }
}

function _removeMedia(id){
  document.querySelectorAll('[data-audio-id="'+id+'"]').forEach(el=>el.remove());
  _ui('hideRemoteVideo',id);
}

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
  if(_blankVideoTrack){try{_blankVideoTrack.stop();}catch(e){}_blankVideoTrack=null;}
  _removeMedia('dm-remote');
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
