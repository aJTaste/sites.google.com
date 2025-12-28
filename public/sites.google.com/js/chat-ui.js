// チャットUI生成と表示

import{state,CHANNELS,getDmId}from'./chat-state.js';
import{formatLastOnline,escapeHtml,formatMessageTime,canAccessChannel}from'./chat-utils.js';

// ユーザーリストを表示
export function displayUserList(){
  const dmList=document.getElementById('dm-list');
  if(!dmList)return;
  
  dmList.innerHTML='';
  
  // チャンネルを表示（権限チェック）
  CHANNELS.forEach(channel=>{
    if(!canAccessChannel(state.currentProfile.role,channel.requiredRole))return;
    
    const channelItem=document.createElement('div');
    channelItem.className='channel-item';
    if(state.selectedChannelId===channel.id)channelItem.classList.add('active');
    if(channel.requiredRole==='moderator')channelItem.classList.add('moderator-only');
    
    const unreadCount=state.unreadCounts[channel.id]||0;
    const unreadBadge=unreadCount>0?`<span class="unread-badge">${unreadCount}</span>`:'';
    
    channelItem.innerHTML=`
      <div class="channel-icon">
        <span class="material-symbols-outlined">${channel.icon}</span>
      </div>
      <div class="channel-info">
        <div class="channel-name">${channel.name}${unreadBadge}</div>
        <div class="channel-desc">${channel.desc}</div>
      </div>
    `;
    
    channelItem.addEventListener('click',()=>{
      if(window.selectChannel)window.selectChannel(channel.id);
    });
    
    dmList.appendChild(channelItem);
  });
  
  // 区切り線
  const divider=document.createElement('div');
  divider.style.cssText='height:1px;background:var(--border);margin:8px 0;';
  dmList.appendChild(divider);
  
  // ユーザーリスト（オンライン順→最終ログイン順）
  state.allProfiles.sort((a,b)=>{
    if(a.is_online&&!b.is_online)return -1;
    if(!a.is_online&&b.is_online)return 1;
    const aTime=new Date(a.last_online||a.created_at).getTime();
    const bTime=new Date(b.last_online||b.created_at).getTime();
    return bTime-aTime;
  });
  
  state.allProfiles.forEach(profile=>{
    const dmItem=document.createElement('div');
    dmItem.className='dm-item';
    if(state.selectedUserId===profile.id)dmItem.classList.add('active');
    
    const avatarHtml=profile.avatar_url
      ?`<img src="${profile.avatar_url}" alt="${profile.display_name}">`
      :`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${profile.avatar_color};color:#fff;font-weight:600;">${profile.display_name.charAt(0).toUpperCase()}</div>`;
    
    const onlineIndicator=profile.is_online?'<div class="online-indicator"></div>':'';
    const statusText=profile.is_online?'オンライン':`最終: ${formatLastOnline(profile.last_online)}`;
    
    const unreadCount=state.unreadCounts[profile.id]||0;
    const unreadBadge=unreadCount>0?`<span class="unread-badge">${unreadCount}</span>`:'';
    
    dmItem.innerHTML=`
      <div class="dm-item-avatar">${avatarHtml}${onlineIndicator}</div>
      <div class="dm-item-info">
        <div class="dm-item-name">${profile.display_name}${unreadBadge}</div>
        <div class="dm-item-status">${statusText}</div>
      </div>
    `;
    
    dmItem.addEventListener('click',()=>{
      if(window.selectUser)window.selectUser(profile.id);
    });
    
    dmList.appendChild(dmItem);
  });
}

// チャット画面HTML生成（DM）
export function createDmChatHtml(targetProfile){
  const avatarHtml=targetProfile.avatar_url
    ?`<img src="${targetProfile.avatar_url}" alt="${targetProfile.display_name}">`
    :`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${targetProfile.avatar_color};color:#fff;font-weight:600;">${targetProfile.display_name.charAt(0).toUpperCase()}</div>`;
  
  const statusText=targetProfile.is_online?'オンライン':`最終: ${formatLastOnline(targetProfile.last_online)}`;
  
  return`
    <div class="chat-header">
      <div class="chat-header-user">
        <div class="chat-header-avatar">${avatarHtml}</div>
        <div class="chat-header-info">
          <div class="chat-header-name">${targetProfile.display_name}</div>
          <div class="chat-header-status">${statusText}</div>
        </div>
      </div>
    </div>
    <div class="chat-messages" id="chat-messages"></div>
    ${createInputHtml(targetProfile.display_name)}
  `;
}

// チャット画面HTML生成（チャンネル）
export function createChannelChatHtml(channel){
  return`
    <div class="chat-header">
      <div class="chat-header-user">
        <div class="channel-icon" style="width:36px;height:36px;">
          <span class="material-symbols-outlined">${channel.icon}</span>
        </div>
        <div class="chat-header-info">
          <div class="chat-header-name">${channel.name}</div>
          <div class="chat-header-status">${channel.desc}</div>
        </div>
      </div>
    </div>
    <div class="chat-messages" id="chat-messages"></div>
    ${createInputHtml(channel.name)}
  `;
}

// 入力エリアHTML
function createInputHtml(targetName){
  return`
    <div class="chat-input-container">
      <div class="reply-preview" id="reply-preview">
        <button class="reply-preview-close" id="reply-preview-close">
          <span class="material-symbols-outlined">close</span>
        </button>
        <div class="reply-preview-header">返信先:</div>
        <div class="reply-preview-text" id="reply-preview-text"></div>
      </div>
      <div class="image-preview-container" id="image-preview-container">
        <button class="image-preview-close" id="image-preview-close">
          <span class="material-symbols-outlined">close</span>
        </button>
        <img class="image-preview" id="image-preview" src="" alt="画像プレビュー">
      </div>
      <div class="chat-input-actions">
        <input type="file" id="image-file-input" accept="image/*" hidden>
        <button class="action-btn" id="attach-image-btn" title="画像を添付">
          <span class="material-symbols-outlined">image</span>
        </button>
      </div>
      <div class="chat-input-wrapper">
        <textarea class="chat-input" id="chat-input" placeholder="${targetName} にメッセージを送信" rows="1"></textarea>
        <button class="send-btn" id="send-btn">
          <span class="material-symbols-outlined">send</span>
        </button>
      </div>
    </div>
  `;
}

// メッセージを表示
export function displayMessage(msg,isDm=false){
  const chatMessages=document.getElementById('chat-messages');
  if(!chatMessages)return;
  
  const isCurrentUser=msg.sender_id===state.currentProfile.id;
  let senderProfile;
  
  if(isCurrentUser){
    senderProfile=state.currentProfile;
  }else{
    senderProfile=state.allProfiles.find(p=>p.id===msg.sender_id);
  }
  
  if(!senderProfile)return;
  
  const avatarHtml=senderProfile.avatar_url
    ?`<img src="${senderProfile.avatar_url}" alt="${senderProfile.display_name}">`
    :`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${senderProfile.avatar_color};color:#fff;font-weight:600;">${senderProfile.display_name.charAt(0).toUpperCase()}</div>`;
  
  // 操作ボタン
  const dmId=isDm?getDmId(state.currentProfile.id,state.selectedUserId):state.selectedChannelId;
  let actionsHtml=`
    <div class="message-actions">
      <button class="message-action-btn" onclick="window.replyMessage('${msg.id}','${escapeForAttr(msg.text)}','${msg.sender_id}')" title="返信">
        <span class="material-symbols-outlined">reply</span>
      </button>
  `;
  
  if(isCurrentUser){
    actionsHtml+=`
      <button class="message-action-btn" onclick="window.editMessage('${msg.id}','${dmId}','${escapeForAttr(msg.text)}',${isDm})" title="編集">
        <span class="material-symbols-outlined">edit</span>
      </button>
      <button class="message-action-btn delete" onclick="window.deleteMessage('${msg.id}',${isDm})" title="削除">
        <span class="material-symbols-outlined">delete</span>
      </button>
    `;
  }
  actionsHtml+=`</div>`;
  
  const messageEl=document.createElement('div');
  messageEl.className='message';
  messageEl.dataset.messageId=msg.id;
  
  const replyHtml=msg.reply_to?`<div class="message-reply">返信: ${escapeHtml(msg.reply_to.text||'').substring(0,100)}...</div>`:'';
  const editedHtml=msg.edited_at?`<div class="message-edited">(編集済み)</div>`:'';
  const imageHtml=msg.image_url?`<img class="message-image" src="${msg.image_url}" alt="画像" onclick="window.openImageModal('${msg.image_url}')">`:'';
  
  messageEl.innerHTML=`
    <div class="message-avatar">${avatarHtml}</div>
    <div class="message-content">
      <div class="message-header">
        <span class="message-author">${senderProfile.display_name}</span>
        <span class="message-time">${formatMessageTime(msg.created_at)}</span>
      </div>
      ${replyHtml}
      <div class="message-text">${escapeHtml(msg.text)}</div>
      ${imageHtml}
      ${editedHtml}
    </div>
    ${actionsHtml}
  `;
  
  chatMessages.appendChild(messageEl);
}

// 属性用エスケープ
function escapeForAttr(text){
  if(!text)return '';
  return text.replace(/'/g,'&#39;').replace(/"/g,'&quot;');
}