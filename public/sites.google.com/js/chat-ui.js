// UI表示関連の関数（Supabase版）

import{state,CHANNELS}from'./chat-state.js';
import{formatLastOnline}from'./chat-utils.js';
import{canAccessChannel}from'../common/permissions.js';

// ユーザー一覧を表示
export function displayUsers(){
  const dmList=document.getElementById('dm-list');
  if(!dmList)return;
  
  dmList.innerHTML='';
  
  // チャンネルを追加（権限チェック）
  CHANNELS.forEach(channel=>{
    // 権限チェック
    if(!canAccessChannel(state.currentProfile.role,channel.requiredRole)){
      return;
    }
    
    const channelItem=document.createElement('div');
    channelItem.className='channel-item';
    if(state.selectedChannelId===channel.id){
      channelItem.classList.add('active');
    }
    
    // モデレーター専用チャンネルのスタイル
    if(channel.requiredRole==='moderator'){
      channelItem.classList.add('moderator-only');
    }
    
    const unreadCount=state.unreadCounts[channel.id]||0;
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
    
    channelItem.addEventListener('click',()=>{
      if(window.selectChannel){
        window.selectChannel(channel.id);
      }
    });
    
    dmList.appendChild(channelItem);
  });
  
  // 区切り線
  const divider=document.createElement('div');
  divider.style.cssText='height:1px;background:var(--border);margin:8px 0;';
  dmList.appendChild(divider);
  
  // ユーザー一覧（最終ログイン時刻でソート済み）
  if(state.allUsers&&state.allUsers.length>0){
    state.allUsers.forEach(user=>{
      const dmItem=document.createElement('div');
      dmItem.className='dm-item';
      if(state.selectedUserId===user.user_id){
        dmItem.classList.add('active');
      }
      
      const isOnline=user.is_online||false;
      const onlineIndicator=isOnline?'<div class="online-indicator"></div>':'';
      const statusText=isOnline?'オンライン':`最終: ${formatLastOnline(user.last_online)}`;
      
      // アイコン表示
      let iconHtml='';
      if(user.avatar_url){
        iconHtml=`<img src="${user.avatar_url}" alt="${user.display_name}">`;
      }else{
        const initial=user.display_name.charAt(0).toUpperCase();
        const color=user.avatar_color||'#FF6B35';
        iconHtml=`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${color};color:#fff;font-weight:600;font-size:16px;">${initial}</div>`;
      }
      
      const unreadCount=state.unreadCounts[user.user_id]||0;
      const unreadBadge=unreadCount>0?`<span class="unread-badge">${unreadCount}</span>`:'';
      
      dmItem.innerHTML=`
        <div class="dm-item-avatar">
          ${iconHtml}
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
      
      dmItem.addEventListener('click',()=>{
        if(window.selectUser){
          window.selectUser(user.user_id);
        }
      });
      
      dmList.appendChild(dmItem);
    });
  }
}

// チャット画面のHTMLを生成（DM）
export function createChatHTML(selectedUser){
  const isOnline=selectedUser.is_online||false;
  const statusText=isOnline?'オンライン':`最終: ${formatLastOnline(selectedUser.last_online)}`;
  
  // アイコン表示
  let iconHtml='';
  if(selectedUser.avatar_url){
    iconHtml=`<img src="${selectedUser.avatar_url}" alt="${selectedUser.display_name}">`;
  }else{
    const initial=selectedUser.display_name.charAt(0).toUpperCase();
    const color=selectedUser.avatar_color||'#FF6B35';
    iconHtml=`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${color};color:#fff;font-weight:600;font-size:16px;">${initial}</div>`;
  }
  
  return`
    <div class="chat-header">
      <div class="chat-header-user">
        <div class="chat-header-avatar">
          ${iconHtml}
        </div>
        <div class="chat-header-info">
          <div class="chat-header-name">${selectedUser.display_name}</div>
          <div class="chat-header-status" id="chat-header-status">${statusText}</div>
        </div>
      </div>
    </div>
    <div class="chat-messages" id="chat-messages">
      <div style="display:flex;align-items:center;justify-content:center;padding:40px;color:var(--text-tertiary);font-size:14px;">
        メッセージを読み込み中...
      </div>
    </div>
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
        <textarea class="chat-input" id="chat-input" placeholder="${selectedUser.display_name} にメッセージを送信" rows="1"></textarea>
        <button class="send-btn" id="send-btn">
          <span class="material-symbols-outlined">send</span>
        </button>
      </div>
      <div class="typing-indicator" id="typing-indicator" style="display:none;padding:8px 0;font-size:12px;color:var(--text-tertiary);">
        <span id="typing-text"></span>
      </div>
    </div>
  `;
}

// チャット画面のHTMLを生成（チャンネル）
export function createChannelChatHTML(channel){
  return`
    <div class="chat-header">
      <div class="chat-header-user">
        <div class="channel-icon" style="width:36px;height:36px;background:var(--bg-secondary);border-radius:50%;display:flex;align-items:center;justify-content:center;">
          <span class="material-symbols-outlined">${channel.icon}</span>
        </div>
        <div class="chat-header-info">
          <div class="chat-header-name">${channel.name}</div>
          <div class="chat-header-status">${channel.desc}</div>
        </div>
      </div>
    </div>
    <div class="chat-messages" id="chat-messages">
      <div style="display:flex;align-items:center;justify-content:center;padding:40px;color:var(--text-tertiary);font-size:14px;">
        メッセージを読み込み中...
      </div>
    </div>
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
        <textarea class="chat-input" id="chat-input" placeholder="${channel.name} にメッセージを送信" rows="1"></textarea>
        <button class="send-btn" id="send-btn">
          <span class="material-symbols-outlined">send</span>
        </button>
      </div>
      <div class="typing-indicator" id="typing-indicator" style="display:none;padding:8px 0;font-size:12px;color:var(--text-tertiary);">
        <span id="typing-text"></span>
      </div>
    </div>
  `;
}