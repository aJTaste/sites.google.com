// call-engine.js v2.0 — 完全再設計
import{state}from'./chat-state.js';

export function getPeerId(u){return 'apphub-'+u.substring(0,8);}
function _myId(){return state.currentProfile.id;}
function _myPeerId(){return getPeerId(_myId());}

// ==========================================
// 状態変数
// ==========================================
let peer=null;
let localStream=null;   // DM通話用マイクストリーム
let screenStream=null;  // 画面共有ストリーム
let dmCall=null;        // アクティブなDM通話オブジェクト
let pendingCall=null;   // 着信保留中のPeerJS callオブジェクト
let _dmOtherId=null;    // DM相手のuserId
let vcStream=null;      // VC用マイクストリーム
let vcId=null;          // 参加中VCチャンネルID
let vcCalls={};         // {peerId: MediaConnection}

// ==========================================
// 初期化
// ==========================================
export function initCallEngine(){
  if(typeof Peer==='undefined'){console.error('[call] PeerJS未ロード');return;}
  _createPeer();
}

function _createPeer(){
  if(peer){try{peer.destroy();}catch(e){}}
  peer=null;

  const p=new Peer(_myPeerId(),{
    debug:0,
    config:{iceServers:[
      {urls:'stun:stun.l.google.com:19302'},
      {urls:'stun:stun1.l.google.com:19302'}
    ]}
  });

  p.on('open',(id)=>{
    peer=p;
    console.log('[call] PeerJS ready:',id);
  });

  p.on('error',(err)=>{
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
    console.warn('[call] disconnected, reconnecting...');
    try{p.reconnect();}catch(e){setTimeout(_createPeer,3000);}
  });

  // ★ 着信ハンドラ（DM/VC共通）
  // DM: ユーザーが応答操作をするまで call オブジェクトを pendingCall に保留
  // VC: 即座に answer
  p.on('call',(call)=>{
    if(vcId){
      // VC参加中 → 即答
      call.answer(vcStream||undefined);
      _setupVcCall(call,null);
    }else{
      // DM着信 → 保留（answerDmCall で answer する）
      console.log('[call] DM pending from peer:',call.peer);
      if(pendingCall){
        clearTimeout(pendingCall._autoClose);
        try{pendingCall.close();}catch(e){}
      }
      pendingCall=call;
      // 30秒でタイムアウト自動クローズ
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

// ==========================================
// DM通話 — 発信
// ==========================================
// ★ 正しい流れ: 発信側が peer.call() → 受信側が call.answer()
export async function startDmCall(targetUser){
  if(!peer||!peer.open){_toast('通話エンジン準備中です。少し待ってから再試行してください');return;}
  if(vcId){_toast('ボイスチャンネル参加中は通話できません');return;}
  if(dmCall||pendingCall){_toast('すでに通話中です');return;}

  localStream=await _getMic();
  if(!localStream)return;

  _dmOtherId=targetUser.id;

  // ★ 発信側が peer.call() する
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

  // Supabaseで着信通知ブロードキャスト
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

// ==========================================
// DM通話 — 着信応答
// ==========================================
// ★ 受信側は pendingCall.answer() するだけ（peer.call() は呼ばない）
export async function answerDmCall(payload){
  if(!peer||!peer.open){_toast('通話エンジン準備中です');return;}
  if(dmCall){_toast('すでに通話中です');return;}

  localStream=await _getMic();
  if(!localStream){
    _broadcast('call-answer',{caller_id:payload.caller_id,accepted:false});
    return;
  }

  _dmOtherId=payload.caller_id;

  // pendingCall がまだ届いていない場合は最大3秒待つ
  // （Supabase broadcastとPeerJSシグナリングの到達順が逆になることがある）
  if(!pendingCall){
    await new Promise(resolve=>{
      const deadline=Date.now()+3000;
      const timer=setInterval(()=>{
        if(pendingCall||Date.now()>=deadline){
          clearInterval(timer);
          resolve();
        }
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

  // pendingCall に answer する
  clearTimeout(pendingCall._autoClose);
  const call=pendingCall;
  pendingCall=null;
  dmCall=call;

  // ★ 受信側は answer() のみ
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

  // 発信側に応答OKを通知
  _broadcast('call-answer',{caller_id:payload.caller_id,accepted:true});

  // 通話モーダル表示
  _ui('showCallModal',{
    id:payload.caller_id,
    display_name:payload.caller_name,
    avatar_url:payload.caller_icon||null,
  },'active');
}

// ==========================================
// DM通話 — 拒否
// ==========================================
export function rejectDmCall(payload){
  if(pendingCall){
    clearTimeout(pendingCall._autoClose);
    try{pendingCall.close();}catch(e){}
    pendingCall=null;
  }
  _broadcast('call-answer',{caller_id:payload.caller_id,accepted:false});
}

// ==========================================
// DM通話 — 終了
// ==========================================
export function endCall(){
  _broadcast('call-end',{
    caller_id:_myId(),
    target_id:_dmOtherId||'',
  });
  _cleanupDm();
  _ui('hideCallModal');
}

// ==========================================
// ブロードキャスト受信ハンドラ
// ==========================================
// 発信側: call-answer を受け取って UI を更新するだけ
// WebRTC接続は startDmCall の peer.call() で既に開始済み
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

// ==========================================
// ボイスチャンネル
// ==========================================
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

// 既存参加者が新規参加者に call する
function _onVcJoin(payload){
  if(payload.channel_id!==vcId)return;
  if(payload.user_id===_myId())return;
  if(!peer||!peer.open||!vcStream)return;

  const call=peer.call(payload.peer_id,vcStream);
  _setupVcCall(call,payload);

  // 自分の情報を新参加者に同期
  _broadcast('vc-sync',{
    channel_id:vcId,
    user_id:_myId(),
    peer_id:_myPeerId(),
    user_name:state.currentProfile.display_name,
    avatar_url:state.currentProfile.avatar_url||null,
  });
}

// UI同期のみ（WebRTC接続は peer.on('call') 側で処理済み）
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

// ==========================================
// マイク・画面共有トグル
// ==========================================
export function toggleMic(){
  const s=vcStream||localStream;
  const t=s?.getAudioTracks()[0];
  if(!t)return false;
  t.enabled=!t.enabled;
  return !t.enabled; // true = ミュート中
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

// ==========================================
// プライベートユーティリティ
// ==========================================
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

function _removeAudio(id){
  document.querySelector('.call-audio[data-audio-id="'+id+'"]')?.remove();
}

function _stopStream(s){
  s?.getTracks().forEach(t=>{try{t.stop();}catch(e){}});
}

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

function _broadcast(event,payload){
  window.sendCallBroadcast?.(event,payload);
}

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
