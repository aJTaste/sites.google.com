import{initVcChat,cleanupVcChat,sendVcMessage}from'./vc-chat.js';
import{addParticipant,removeParticipant,clearChannel,updateVcSidebar}from'./vc-state.js';
// call-ui.js v1.8.0
import{state}from'./chat-state.js';
import{endCall,toggleMic,toggleScreenShare,answerDmCall,rejectDmCall,leaveVoiceChannel}from'./call-engine.js';

function esc(s){const d=document.createElement('div');d.textContent=s||'';return d.innerHTML;}

// DM通話モーダル
export function showCallModal(user,mode){
  const modal=document.getElementById('call-modal');
  if(!modal)return;
  const av=user.avatar_url
    ?('<img src="'+esc(user.avatar_url)+'" alt="'+esc(user.display_name||'')+'">')
    :('<div class="call-modal-avatar-fallback">'+esc((user.display_name||'?')[0])+'</div>');
  modal.innerHTML='<div class="call-modal-inner">'
    +'<div class="call-modal-avatar">'+(av)+'</div>'
    +'<div class="call-modal-name">'+esc(user.display_name||'不明')+'</div>'
    +'<div class="call-modal-status" id="call-modal-status">'+( mode==='outgoing'?'呼び出し中...':'通話中')+'</div>'
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
    btn?.classList.toggle('call-btn-active',!!sharing);
  });
}

export function hideCallModal(){
  const modal=document.getElementById('call-modal');
  if(!modal)return;
  modal.classList.remove('show');
  setTimeout(()=>{modal.style.display='none';modal.innerHTML='';},250);
}

export function updateCallStatus(text){
  const el=document.getElementById('call-modal-status');
  if(el)el.textContent=text;
}

// 着信トースト
export function showIncomingCallToast(payload){
  let wrap=document.getElementById('ch-toast-wrap');
  if(!wrap){wrap=document.createElement('div');wrap.id='ch-toast-wrap';document.body.appendChild(wrap);}
  document.getElementById('incoming-call-toast')?.remove();
  const t=document.createElement('div');
  t.className='ch-toast call';t.id='incoming-call-toast';
  const ic=payload.caller_icon?('<img src="'+esc(payload.caller_icon)+'">'):'📞';
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

// ボイスチャンネルUI
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
  if(!_vcP[peerId]){_vcP[peerId]={user_name:'参加者',avatar_url:null};_updateVcGrid();}
}
export function removeVcParticipant(peerId){
// どのチャンネルか特定するため vcParticipants を検索
import('./vc-state.js').then(({vcParticipants})=>{
Object.keys(vcParticipants).forEach(chId=>{
if(vcParticipants[chId][peerId]){
removeParticipant(chId,peerId);
}
});
});
delete _vcP[peerId];
_updateVcGrid();
}
export function onScreenShareEnded(){
  const btn=document.getElementById('call-btn-share');
  btn?.classList.remove('call-btn-active');
  const icon=btn?.querySelector('.material-symbols-outlined');
  if(icon)icon.textContent='screen_share';
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
    btn?.classList.toggle('call-btn-active',!!sharing);
  });
  const doSend=()=>{
    const input=document.getElementById('vc-chat-input');
    const txt=input?.value?.trim();
    if(!txt)return;
    sendVcMessage(channelId,txt);
    if(input)input.value='';
  };
  document.getElementById('vc-chat-send')?.addEventListener('click',doSend);
  document.getElementById('vc-chat-input')?.addEventListener('keydown',(e)=>{
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();doSend();}
  });
  _updateVcGrid();
}

function _updateVcGrid(){
  const grid=document.getElementById('vc-grid');
  if(!grid)return;
  grid.innerHTML='';
  Object.entries(_vcP).forEach(([,info])=>{
    const card=document.createElement('div');
    card.className='vc-participant-card';
    const av2=info.avatar_url
      ?('<img src="'+esc(info.avatar_url)+'" alt="'+esc(info.user_name)+'">') 
      :('<div class="vc-avatar-fallback">'+esc((info.user_name||'?')[0])+'</div>');
    card.innerHTML='<div class="vc-participant-avatar">'+av2+'</div><div class="vc-participant-name">'+esc(info.user_name)+'</div>';
    grid.appendChild(card);
  });
}