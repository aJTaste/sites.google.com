// call-ui.js v3.0
import{state}from'./chat-state.js';
import{endCall,toggleMic,toggleScreenShare,answerDmCall,rejectDmCall,leaveVoiceChannel}from'./call-engine.js';
import{initVcChat,cleanupVcChat,sendVcMessage}from'./vc-chat.js';
import{addParticipant,removeParticipant,clearChannel,vcParticipants}from'./vc-state.js';

function esc(s){const d=document.createElement('div');d.textContent=s||'';return d.innerHTML;}

export function showCallModal(user,mode){
  const modal=document.getElementById('call-modal');
  if(!modal)return;
  const av=user.avatar_url
    ?('<img src="'+esc(user.avatar_url)+'" alt="'+esc(user.display_name||'')+'">')
    :('<div class="call-modal-avatar-fallback">'+esc((user.display_name||'?')[0])+'</div>');
  const statusText=mode==='outgoing'?'呼び出し中...'
    :mode==='incoming'?'接続中...'
    :'通話中';
  modal.innerHTML='<div class="call-modal-inner">'
    +'<div class="call-modal-avatar">'+av+'</div>'
    +'<div class="call-modal-name">'+esc(user.display_name||'不明')+'</div>'
    +'<div class="call-modal-status" id="call-modal-status">'+statusText+'</div>'
    // 画面共有映像エリア（非表示で待機）
    +'<div class="call-modal-video-wrap" id="call-modal-video-wrap" style="display:none;width:100%;max-height:240px;background:#000;border-radius:8px;overflow:hidden;margin:12px 0;"></div>'
    +'<div class="call-modal-actions">'
    +'<button class="call-btn call-btn-mute" id="call-btn-mute"><span class="material-symbols-outlined">mic</span></button>'
    +'<button class="call-btn call-btn-share" id="call-btn-share"><span class="material-symbols-outlined">screen_share</span></button>'
    +'<button class="call-btn call-btn-end" id="call-btn-end"><span class="material-symbols-outlined">call_end</span></button>'
    +'</div></div>';
  modal.style.display='flex';
  requestAnimationFrame(()=>modal.classList.add('show'));
  document.getElementById('call-btn-end').addEventListener('click',()=>endCall());
  document.getElementById('call-btn-mute').addEventListener('click',()=>{
    const muted=toggleMic();
    const btn=document.getElementById('call-btn-mute');
    const icon=btn?.querySelector('.material-symbols-outlined');
    if(icon)icon.textContent=muted?'mic_off':'mic';
    btn?.classList.toggle('call-btn-active',muted);
  });
  document.getElementById('call-btn-share').addEventListener('click',async()=>{
    const sharing=await toggleScreenShare();
    const btn=document.getElementById('call-btn-share');
    const icon=btn?.querySelector('.material-symbols-outlined');
    if(icon)icon.textContent=sharing?'stop_screen_share':'screen_share';
    btn?.classList.toggle('call-btn-active',sharing);
  });
}

export function hideCallModal(){
  const modal=document.getElementById('call-modal');
  if(!modal)return;
  modal.classList.remove('show');
  setTimeout(()=>{
    modal.style.display='none';
    modal.innerHTML='';
  },300);
}

export function updateCallStatus(text){
  const el=document.getElementById('call-modal-status');
  if(el)el.textContent=text;
}

// 相手の画面共有映像を通話モーダル内に表示
export function showRemoteVideo(id,videoEl){
  // DM通話モーダルのビデオエリアに差し込む
  const wrap=document.getElementById('call-modal-video-wrap');
  if(wrap){
    wrap.innerHTML='';
    videoEl.style.cssText='width:100%;height:100%;max-height:240px;object-fit:contain;display:block;background:#000;';
    wrap.appendChild(videoEl);
    wrap.style.display='block';
    videoEl.play().catch(()=>{});
    return;
  }
  // VCレイアウト内のグリッドに表示
  const grid=document.getElementById('vc-grid');
  if(grid){
    videoEl.style.cssText='width:100%;height:100%;object-fit:contain;display:block;background:#000;border-radius:8px;';
    const cell=document.createElement('div');
    cell.className='vc-video-cell';
    cell.dataset.remoteId=id;
    cell.style.cssText='position:relative;background:#000;border-radius:8px;overflow:hidden;aspect-ratio:16/9;';
    cell.innerHTML='<div style="position:absolute;top:6px;left:8px;font-size:11px;color:#fff;opacity:.7;z-index:1;">📺 画面共有</div>';
    cell.appendChild(videoEl);
    grid.appendChild(cell);
    videoEl.play().catch(()=>{});
  }
}

// 映像エリアを非表示・削除
export function hideRemoteVideo(id){
  // モーダルのビデオエリアをリセット
  const wrap=document.getElementById('call-modal-video-wrap');
  if(wrap){wrap.style.display='none';wrap.innerHTML='';}
  // VCグリッドから削除
  document.querySelectorAll('[data-remote-id="'+id+'"]').forEach(el=>el.remove());
}

export function onScreenShareEnded(){
  const btn=document.getElementById('call-btn-share');
  btn?.classList.remove('call-btn-active');
  const icon=btn?.querySelector('.material-symbols-outlined');
  if(icon)icon.textContent='screen_share';
  // 通話モーダルのビデオエリアを非表示
  const wrap=document.getElementById('call-modal-video-wrap');
  if(wrap){wrap.style.display='none';wrap.innerHTML='';}
}

export function showIncomingCallToast(payload){
  const wrap=document.getElementById('ch-toast-wrap')||document.body;
  const t=document.createElement('div');
  t.className='ch-toast';
  const ic=payload.caller_icon
    ?('<img src="'+esc(payload.caller_icon)+'">'):'📞';
  t.innerHTML='<div class="ch-toast-icon">'+ic+'</div>'
    +'<div class="ch-toast-body">'
    +'<div class="ch-toast-title call">📞 '+esc(payload.caller_name||'不明')+'</div>'
    +'<div class="ch-toast-msg">通話リクエスト</div>'
    +'<div class="call-toast-btns">'
    +'<button class="call-toast-btn call-toast-accept" id="call-toast-accept">✅ 応答</button>'
    +'<button class="call-toast-btn call-toast-reject" id="call-toast-reject">❌ 拒否</button>'
    +'</div></div>';
  wrap.appendChild(t);
  let dismissed=false;
  const dismiss=()=>{
    if(dismissed)return;dismissed=true;
    t.style.animation='cht-out .25s ease forwards';
    setTimeout(()=>{if(t.isConnected)t.remove();},250);
  };
  document.getElementById('call-toast-accept').addEventListener('click',async()=>{dismiss();await answerDmCall(payload);});
  document.getElementById('call-toast-reject').addEventListener('click',()=>{dismiss();rejectDmCall(payload);});
  setTimeout(()=>{if(!dismissed){rejectDmCall(payload);dismiss();}},30000);
}

const _vcP={};

export function showVoiceChannelUI(channelId){
  const myPeerId='apphub-'+state.currentProfile.id.substring(0,8);
  _vcP[myPeerId]={user_name:state.currentProfile.display_name,avatar_url:state.currentProfile.avatar_url||null};
  addParticipant(channelId,myPeerId,{
    user_name:state.currentProfile.display_name,
    avatar_url:state.currentProfile.avatar_url||null,
    user_id:state.currentProfile.id
  });
  _renderVcUI(channelId);
  initVcChat(channelId);
}

export function hideVoiceChannelUI(){
  const chatMain=document.getElementById('chat-main');
  if(chatMain&&chatMain.dataset.vcMode==='1'){
    chatMain.innerHTML='<div class="chat-empty"><div class="chat-empty-icon"><span class="material-symbols-outlined">forum</span></div><h3>ChatHub</h3><p>チャンネルまたはユーザーを選択してください</p></div>';
    delete chatMain.dataset.vcMode;
  }
  cleanupVcChat();
  clearChannel(chatMain?.dataset.vcChannelId||'');
  Object.keys(_vcP).forEach(k=>delete _vcP[k]);
}

export function addVcParticipant(payload){
  _vcP[payload.peer_id]={user_name:payload.user_name,avatar_url:payload.avatar_url||null};
  addParticipant(payload.channel_id,payload.peer_id,{
    user_name:payload.user_name,
    avatar_url:payload.avatar_url||null,
    user_id:payload.user_id
  });
  _updateVcGrid();
}

export function addVcParticipantAudio(peerId){
  if(!_vcP[peerId]){
    _vcP[peerId]={user_name:'参加者',avatar_url:null};
    const chId=window.currentVcChannelId||'';
    if(chId)addParticipant(chId,peerId,{user_name:'参加者',avatar_url:null,user_id:''});
    _updateVcGrid();
  }
}

export function removeVcParticipant(peerId){
  Object.keys(vcParticipants).forEach(chId=>{
    if(vcParticipants[chId]?.[peerId])removeParticipant(chId,peerId);
  });
  delete _vcP[peerId];
  _updateVcGrid();
}

function _renderVcUI(channelId){
  const chatMain=document.getElementById('chat-main');
  if(!chatMain)return;
  chatMain.dataset.vcMode='1';
  chatMain.dataset.vcChannelId=channelId;
  const chNum=esc(channelId.replace('voice-',''));
  chatMain.innerHTML='<div class="vc-layout">'
    +'<div class="vc-header">'
    +'<div class="vc-header-title"><span class="material-symbols-outlined">volume_up</span> ボイス '+chNum+'</div>'
    +'<button class="vc-leave-btn" id="vc-leave-btn"><span class="material-symbols-outlined">logout</span> 退室</button>'
    +'</div>'
    +'<div class="vc-body">'
    +'<div class="vc-main"><div class="vc-grid" id="vc-grid"></div></div>'
    +'<div class="vc-chat-panel">'
    +'<div class="vc-chat-messages" id="vc-chat-messages"></div>'
    +'<div class="vc-chat-input-area">'
    +'<textarea class="vc-chat-input" id="vc-chat-input" placeholder="メッセージ..." rows="1"></textarea>'
    +'<button class="vc-chat-send" id="vc-chat-send"><span class="material-symbols-outlined">send</span></button>'
    +'</div>'
    +'</div>'
    +'</div>'
    +'<div class="vc-controls">'
    +'<button class="call-btn call-btn-mute" id="call-btn-mute"><span class="material-symbols-outlined">mic</span></button>'
    +'<button class="call-btn call-btn-share" id="call-btn-share"><span class="material-symbols-outlined">screen_share</span></button>'
    +'</div>'
    +'</div>';
  document.getElementById('vc-leave-btn').addEventListener('click',()=>leaveVoiceChannel());
  document.getElementById('call-btn-mute').addEventListener('click',()=>{
    const muted=toggleMic();
    const btn=document.getElementById('call-btn-mute');
    const icon=btn?.querySelector('.material-symbols-outlined');
    if(icon)icon.textContent=muted?'mic_off':'mic';
    btn?.classList.toggle('call-btn-active',muted);
  });
  document.getElementById('call-btn-share').addEventListener('click',async()=>{
    const sharing=await toggleScreenShare();
    const btn=document.getElementById('call-btn-share');
    const icon=btn?.querySelector('.material-symbols-outlined');
    if(icon)icon.textContent=sharing?'stop_screen_share':'screen_share';
    btn?.classList.toggle('call-btn-active',sharing);
  });
  document.getElementById('vc-chat-send').addEventListener('click',()=>{
    const inp=document.getElementById('vc-chat-input');
    if(inp?.value.trim())sendVcMessage(inp.value.trim());
    if(inp)inp.value='';
  });
  document.getElementById('vc-chat-input').addEventListener('keydown',(e)=>{
    if(e.key==='Enter'&&!e.shiftKey){
      e.preventDefault();
      const inp=document.getElementById('vc-chat-input');
      if(inp?.value.trim())sendVcMessage(inp.value.trim());
      if(inp)inp.value='';
    }
  });
  _updateVcGrid();
}

function _updateVcGrid(){
  const grid=document.getElementById('vc-grid');
  if(!grid)return;
  // 既存の参加者カード（vc-video-cellは画面共有なので保持）
  grid.querySelectorAll('.vc-participant-card').forEach(el=>el.remove());
  Object.entries(_vcP).forEach(([peerId,info])=>{
    const av=info.avatar_url
      ?('<img src="'+esc(info.avatar_url)+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">')
      :('<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:28px;background:var(--main,#5865f2);border-radius:50%;color:#fff;">'+esc((info.user_name||'?')[0])+'</div>');
    const card=document.createElement('div');
    card.className='vc-participant-card';
    card.dataset.peerId=peerId;
    card.innerHTML='<div style="width:64px;height:64px;border-radius:50%;overflow:hidden;margin:0 auto 8px;">'+av+'</div>'
      +'<div style="font-size:13px;text-align:center;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(info.user_name||'参加者')+'</div>';
    grid.appendChild(card);
  });
}
