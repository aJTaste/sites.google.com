// UI表示関連（Supabase版）

import{state,CHANNELS}from'./chat-state.js';
import{canAccessChannel}from'../common/permissions.js';

// 時刻フォーマット
export function formatMessageTime(timestamp){
  const date=new Date(timestamp);
  const now=new Date();
  const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const messageDate=new Date(date.getFullYear(),date.getMonth(),date.getDate());
  
  if(messageDate.getTime()===today.getTime()){
    return date.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }else if(messageDate.getTime()===today.getTime()-86400000){
    return '昨日 '+date.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }else{
    return date.toLocaleDateString('ja-JP',{month:'short',day:'numeric'})+' '+date.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }
}

// 最終ログイン時刻フォーマット
export function formatLastOnline(timestamp){
  if(!timestamp)return '不明';
  
  const date=new Date(timestamp);
  const now=new Date();
  const diff=now-date;
  const seconds=Math.floor(diff/1000);
  const minutes=Math.floor(diff/60000);
  const hours=Math.floor(diff/3600000);
  const days=Math.floor(diff/86400000);
  
  if(seconds<10)return 'たった今';
  if(seconds<60)return `${seconds}秒前`;
  if(minutes<60)return `${minutes}分前`;
  if(hours<24)return `${hours}時間前`;
  if(days<7)return `${days}日前`;
  
  return date.toLocaleDateString('ja-JP',{month:'short',day:'numeric'});
}

// HTMLエスケープ
export function escapeHtml(text){
  const div=document.createElement('div');
  div.textContent=text;
  let escaped=div.innerHTML;
  
  const urlRegex=/(https?:\/\/[^\s]+)/g;
  escaped=escaped.replace(urlRegex,'<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  
  return escaped;
}

// ユーザー一覧を表示
export function displayUsers(){
  const dmList=document.getElementById('dm-list');
  if(!dmList)return;
  
  dmList.innerHTML='';
  
  // チャンネルを追加
  CHANNELS.forEach(channel=>{
    if(!canAccessChannel(state.currentProfile.role,channel.requiredRole)){
      return;
    }
    
    const channelItem=document.createElement('div');
    channelItem.className='channel-item';
    if(state.selectedChannelId===channel.id){
      channelItem.classList.add('active');
    }
    
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
  
  // ユーザー一覧（最終ログイン時刻でソート）
  if(state.allProfiles&&state.allProfiles.length>0){
    state.allProfiles.sort((a,b)=>{
      const aTime=new Date(a.last_online||a.created_at).getTime();
      const bTime=new Date(b.last_online||b.created_at).getTime();
      return bTime-aTime;
    });
    
    state.allProfiles.forEach(profile=>{
      const dmItem=document.createElement('div');
      dmItem.className='dm-item';
      if(state.selectedUserId===profile.id){
        dmItem.classList.add('active');
      }
      
      const avatarHtml=profile.avatar_url
        ?`<img src="${profile.avatar_url}" alt="${profile.display_name}">`
        :`<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:${profile.avatar_color};color:#fff;font-weight:600;font-size:14px;">${profile.display_name.charAt(0).toUpperCase()}</div>`;
      
      const isOnline=profile.is_online||false;
      const onlineIndicator=isOnline?'<div class="online-indicator"></div>':'';
      const statusText=isOnline?'オンライン':`最終: ${formatLastOnline(profile.last_online||profile.created_at)}`;
      
      const unreadCount=state.unreadCounts[profile.id]||0;
      const unreadBadge=unreadCount>0?`<span class="unread-badge">${unreadCount}</span>`:'';
      
      dmItem.innerHTML=`
        <div class="dm-item-avatar">
          ${avatarHtml}
          ${onlineIndicator}
        </div>
        <div class="dm-item-info">
          <div class="dm-item-name">
            ${profile.display_name}
            ${unreadBadge}
          </div>
          <div class="dm-item-status">${statusText}</div>
        </div>
      `;
      
      dmItem.addEventListener('click',()=>{
        if(window.selectUser){
          window.selectUser(profile.id);
        }
      });
      
      dmList.appendChild(dmItem);
    });
  }
}

// チャット画面のHTML生成（DM）
export function createChatHTML(selectedProfile){
  const avatarHtml=selectedProfile.avatar_url
    ?`<img src="${selectedProfile.avatar_url}" alt="${selectedProfile.display_name}">`
    :`<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:${selectedProfile.avatar_color};color:#fff;font-weight:600;font-size:14px;">${selectedProfile.display_name.charAt(0).toUpperCase()}</div>`;
  
  const isOnline=selectedProfile.is_online||false;
  const statusText=isOnline?'オンライン':`最終: ${formatLastOnline(selectedProfile.last_online||selectedProfile.created_at)}`;
  
  return`
    <div class="chat-header">
      <div class="chat-header-user">
        <div class="chat-header-avatar">
          ${avatarHtml}
        </div>
        <div class="chat-header-info">
          <div class="chat-header-name">${selectedProfile.display_name}</div>
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
        <textarea class="chat-input" id="chat-input" placeholder="${selectedProfile.display_name} にメッセージを送信" rows="1"></textarea>
        <button class="send-btn" id="send-btn">
          <span class="material-symbols-outlined">send</span>
        </button>
      </div>
    </div>
  `;
}

// チャット画面のHTML生成（チャンネル）
export function createChannelChatHTML(channel){
  return`
    <div class="chat-header">
      <div class="chat-header-user">
        <div class="channel-icon" style="width:36px;height:36px;">
          <span class="material-symbols-outlined">${channel.icon}</span>
        </div>
        <div class="chat-header-info">
          <div class="chat-header-name">${channel.name}</div>
          <div class="chat-header-status" id="chat-header-status">${channel.desc}</div>
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
    </div>
  `;
}