// UI描画関連
import{CHANNELS}from'./chat-supabase.js';
import{formatMessageTime,formatLastOnline,escapeHtml}from'./chat-utils.js';
import{canAccessChannel}from'../common/permissions.js';

// ユーザー一覧とチャンネル一覧を表示
export function displayUserList(allUsers,unreadCounts,currentProfile,selectedUserId,selectedChannelId){
  const dmList=document.getElementById('dm-list');
  if(!dmList)return;
  
  dmList.innerHTML='';
  
  // チャンネルを追加
  CHANNELS.forEach(channel=>{
    if(!canAccessChannel(currentProfile.role,channel.requiredRole)){
      return;
    }
    
    const channelItem=document.createElement('div');
    channelItem.className='channel-item';
    if(selectedChannelId===channel.id){
      channelItem.classList.add('active');
    }
    
    if(channel.requiredRole==='moderator'){
      channelItem.classList.add('moderator-only');
    }
    
    const unreadCount=unreadCounts[channel.id]||0;
    const unreadBadge=unreadCount>0?`<span class="unread-badge">${unreadCount}</span>`:'';
    
    channelItem.innerHTML=`
      <div class="channel-icon">
        <span class="material-symbols-outlined">${channel.icon}</span>
      </div>
      <div class="channel-info">
        <div class="channel-name">
          ${channel.name}
          ${unreadBadge}
        </div>
        <div class="channel-desc">${channel.desc}</div>
      </div>
    `;
    
    channelItem.dataset.channelId=channel.id;
    dmList.appendChild(channelItem);
  });
  
  // 区切り線
  const divider=document.createElement('div');
  divider.style.cssText='height:1px;background:var(--border);margin:8px 0;';
  dmList.appendChild(divider);
  
  // ユーザー一覧
  allUsers.forEach(user=>{
    if(user.id===currentProfile.id)return;
    
    const dmItem=document.createElement('div');
    dmItem.className='dm-item';
    if(selectedUserId===user.id){
      dmItem.classList.add('active');
    }
    
    const avatarHtml=user.avatar_url
      ?`<img src="${user.avatar_url}" alt="${user.display_name}">`
      :`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${user.avatar_color};color:#fff;font-weight:600;font-size:16px;">${user.display_name.charAt(0).toUpperCase()}</div>`;
    
    const onlineIndicator=user.is_online?'<div class="online-indicator"></div>':'';
    const statusText=user.is_online?'オンライン':`最終: ${formatLastOnline(user.last_online)}`;
    
    const unreadCount=unreadCounts[user.id]||0;
    const unreadBadge=unreadCount>0?`<span class="unread-badge">${unreadCount}</span>`:'';
    
    dmItem.innerHTML=`
      <div class="dm-item-avatar">
        ${avatarHtml}
        ${onlineIndicator}
      </div>
      <div class="dm-item-info">
        <div class="dm-item-name">
          ${user.display_name}
          ${unreadBadge}
        </div>
        <div class="dm-item-status">${statusText}</div>
      </div>
    `;
    
    dmItem.dataset.userId=user.id;
    dmList.appendChild(dmItem);
  });
}

// チャット画面のヘッダーを生成（DM）
export function createChatHeaderHtml(user){
  const avatarHtml=user.avatar_url
    ?`<img src="${user.avatar_url}" alt="${user.display_name}">`
    :`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${user.avatar_color};color:#fff;font-weight:600;font-size:16px;">${user.display_name.charAt(0).toUpperCase()}</div>`;
  
  const statusText=user.is_online?'オンライン':`最終: ${formatLastOnline(user.last_online)}`;
  
  return`
    <div class="chat-header">
      <div class="chat-header-user">
        <div class="chat-header-avatar">
          ${avatarHtml}
        </div>
        <div class="chat-header-info">
          <div class="chat-header-name">${user.display_name}</div>
          <div class="chat-header-status">${statusText}</div>
        </div>
      </div>
    </div>
  `;
}

// チャット画面のヘッダーを生成（チャンネル）
export function createChannelHeaderHtml(channel){
  return`
    <div class="chat-header">
      <div class="chat-header-user">
        <div class="channel-icon" style="width:36px;height:36px;">
          <span class="material-symbols-outlined">${channel.icon}</span>
        </div>
        <div class="chat-header-info">
          <div class="chat-header-name">${channel.name}</div>
          <div class="chat-header-status" id="typing-indicator">${channel.desc}</div>
        </div>
      </div>
    </div>
  `;
}

// 入力欄のHTMLを生成
export function createInputAreaHtml(placeholder){
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
        <textarea class="chat-input" id="chat-input" placeholder="${placeholder}" rows="1"></textarea>
        <button class="send-btn" id="send-btn">
          <span class="material-symbols-outlined">send</span>
        </button>
      </div>
    </div>
  `;
}

// メッセージを表示
export function displayMessage(message,allUsers,currentUserId,isDm){
  const sender=allUsers.find(u=>u.id===message.sender_id);
  if(!sender)return null;
  
  const isCurrentUser=message.sender_id===currentUserId;
  
  const avatarHtml=sender.avatar_url
    ?`<img src="${sender.avatar_url}" alt="${sender.display_name}">`
    :`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${sender.avatar_color};color:#fff;font-weight:600;font-size:16px;">${sender.display_name.charAt(0).toUpperCase()}</div>`;
  
  // 操作ボタン
  let actionsHtml=`
    <div class="message-actions">
      <button class="message-action-btn reply-btn" data-message-id="${message.id}" data-text="${escapeHtml(message.text||'').replace(/"/g,'&quot;')}" title="返信">
        <span class="material-symbols-outlined">reply</span>
      </button>
  `;
  
  if(isCurrentUser){
    actionsHtml+=`
      <button class="message-action-btn edit-btn" data-message-id="${message.id}" data-text="${escapeHtml(message.text||'').replace(/"/g,'&quot;')}" data-is-dm="${isDm}" title="編集">
        <span class="material-symbols-outlined">edit</span>
      </button>
      <button class="message-action-btn delete delete-btn" data-message-id="${message.id}" data-is-dm="${isDm}" title="削除">
        <span class="material-symbols-outlined">delete</span>
      </button>
    `;
  }
  
  actionsHtml+=`</div>`;
  
  const messageEl=document.createElement('div');
  messageEl.className='message';
  messageEl.dataset.messageId=message.id;
  
  messageEl.innerHTML=`
    <div class="message-avatar">
      ${avatarHtml}
    </div>
    <div class="message-content">
      <div class="message-header">
        <span class="message-author">${sender.display_name}</span>
        <span class="message-time">${formatMessageTime(message.created_at)}</span>
      </div>
      ${message.reply_to?`<div class="message-reply">返信: ${escapeHtml((message.reply_to.text||'').substring(0,100))}...</div>`:''}
      <div class="message-text">${escapeHtml(message.text||'')}</div>
      ${message.image_url?`<img class="message-image" src="${message.image_url}" alt="画像" data-image-url="${message.image_url}">`:''}
      ${message.edited_at?`<div class="message-edited">(編集済み)</div>`:''}
    </div>
    ${actionsHtml}
  `;
  
  return messageEl;
}