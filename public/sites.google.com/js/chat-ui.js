// UI表示関連の関数

import{state,CHANNELS}from'./chat-state.js';
import{formatLastOnline}from'./chat-utils.js';

function log(msg){
  const debugDiv=document.getElementById('debug-log');
  if(debugDiv){
    const time=new Date().toLocaleTimeString();
    const p=document.createElement('div');
    p.textContent=`[${time}] UI: ${msg}`;
    debugDiv.appendChild(p);
    debugDiv.scrollTop=debugDiv.scrollHeight;
  }
  console.log('UI:',msg);
}

log('chat-ui.js読み込み開始');

// ユーザー一覧を表示
export function displayUsers(){
  log('displayUsers開始');
  log('allUsers数:'+state.allUsers.length);
  log('CHANNELS数:'+CHANNELS.length);
  
  const dmList=document.getElementById('dm-list');
  if(!dmList){
    log('ERROR:dm-list要素なし');
    return;
  }
  
  log('dm-listクリア');
  dmList.innerHTML='';
  
  // チャンネルを追加
  log('チャンネル追加開始');
  CHANNELS.forEach((channel,index)=>{
    log(`チャンネル${index}:${channel.name}`);
    
    const channelItem=document.createElement('div');
    channelItem.className='channel-item';
    if(state.selectedChannelId===channel.id){
      channelItem.classList.add('active');
    }
    
    const unreadCount=state.unreadCounts[channel.id]||0;
    const unreadBadge=unreadCount>0?`<span class="unread-badge">${unreadCount}</span>`:'';
    
    channelItem.innerHTML=`
      <div class="channel-icon">
        <span class="material-icons">${channel.icon}</span>
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
      log('チャンネルクリック:'+channel.id);
      if(window.selectChannel){
        window.selectChannel(channel.id);
      }else{
        log('ERROR:selectChannel関数なし');
      }
    });
    
    dmList.appendChild(channelItem);
  });
  
  log('チャンネル追加完了');
  
  // 区切り線
  const divider=document.createElement('div');
  divider.style.cssText='height:1px;background:var(--border);margin:8px 0;';
  dmList.appendChild(divider);
  
  // 最終ログイン時刻でソート（新しい順）
  if(state.allUsers&&state.allUsers.length>0){
    log('ユーザーソート開始');
    state.allUsers.sort((a,b)=>{
      const aTime=a.lastOnline||a.createdAt||0;
      const bTime=b.lastOnline||b.createdAt||0;
      return bTime-aTime;
    });
    
    log('ユーザー表示:'+state.allUsers.length+'人');
    
    state.allUsers.forEach((user,index)=>{
      log(`ユーザー${index}:${user.username}`);
      
      const dmItem=document.createElement('div');
      dmItem.className='dm-item';
      if(state.selectedUserId===user.uid){
        dmItem.classList.add('active');
      }
      
      const iconUrl=user.iconUrl&&user.iconUrl!=='default'?user.iconUrl:'assets/school.png';
      const isOnline=user.online||false;
      const onlineIndicator=isOnline?'<div class="online-indicator"></div>':'';
      const statusText=isOnline?'オンライン':`最終: ${formatLastOnline(user.lastOnline||user.createdAt)}`;
      
      const unreadCount=state.unreadCounts[user.uid]||0;
      const unreadBadge=unreadCount>0?`<span class="unread-badge">${unreadCount}</span>`:'';
      
      dmItem.innerHTML=`
        <div class="dm-item-avatar">
          <img src="${iconUrl}" alt="${user.username}">
          ${onlineIndicator}
        </div>
        <div class="dm-item-info">
          <div class="dm-item-name">
            ${user.username}
            ${unreadBadge}
          </div>
          <div class="dm-item-status">${statusText}</div>
        </div>
      `;
      
      dmItem.addEventListener('click',()=>{
        log('ユーザークリック:'+user.uid);
        if(window.selectUser){
          window.selectUser(user.uid);
        }else{
          log('ERROR:selectUser関数なし');
        }
      });
      
      dmList.appendChild(dmItem);
    });
    
    log('ユーザー追加完了');
  }else{
    log('表示ユーザー0人');
  }
}

// チャット画面のHTMLを生成（DM）
export function createChatHTML(selectedUser){
  const iconUrl=selectedUser.iconUrl&&selectedUser.iconUrl!=='default'?selectedUser.iconUrl:'assets/school.png';
  const isOnline=selectedUser.online||false;
  const statusText=isOnline?'オンライン':`最終: ${formatLastOnline(selectedUser.lastOnline||selectedUser.createdAt)}`;
  
  return`
    <div class="chat-header">
      <div class="chat-header-user">
        <div class="chat-header-avatar">
          <img src="${iconUrl}" alt="${selectedUser.username}">
        </div>
        <div class="chat-header-info">
          <div class="chat-header-name">${selectedUser.username}</div>
          <div class="chat-header-status">${statusText}</div>
        </div>
      </div>
    </div>
    <div class="chat-messages" id="chat-messages">
      <div class="loading">
        <div class="loading-spinner"></div>
        <div class="loading-text">メッセージを読み込み中...</div>
      </div>
    </div>
    <div class="chat-input-container">
      <div class="reply-preview" id="reply-preview">
        <button class="reply-preview-close" id="reply-preview-close">
          <span class="material-icons">close</span>
        </button>
        <div class="reply-preview-header">返信先:</div>
        <div class="reply-preview-text" id="reply-preview-text"></div>
      </div>
      <div class="image-preview-container" id="image-preview-container">
        <button class="image-preview-close" id="image-preview-close">
          <span class="material-icons">close</span>
        </button>
        <img class="image-preview" id="image-preview" src="" alt="画像プレビュー">
      </div>
      <div class="chat-input-actions">
        <input type="file" id="image-file-input" accept="image/*" hidden>
        <button class="action-btn" id="attach-image-btn" title="画像を添付">
          <span class="material-icons">image</span>
        </button>
      </div>
      <div class="chat-input-wrapper">
        <textarea class="chat-input" id="chat-input" placeholder="${selectedUser.username} にメッセージを送信" rows="1"></textarea>
        <button class="send-btn" id="send-btn">
          <span class="material-icons">send</span>
        </button>
      </div>
    </div>
  `;
}

// チャット画面のHTMLを生成（チャンネル）
export function createChannelChatHTML(channel){
  return`
    <div class="chat-header">
      <div class="chat-header-user">
        <div class="channel-icon" style="width:36px;height:36px;">
          <span class="material-icons">${channel.icon}</span>
        </div>
        <div class="chat-header-info">
          <div class="chat-header-name">${channel.name}</div>
          <div class="chat-header-status">${channel.desc}</div>
        </div>
      </div>
    </div>
    <div class="chat-messages" id="chat-messages">
      <div class="loading">
        <div class="loading-spinner"></div>
        <div class="loading-text">メッセージを読み込み中...</div>
      </div>
    </div>
    <div class="chat-input-container">
      <div class="reply-preview" id="reply-preview">
        <button class="reply-preview-close" id="reply-preview-close">
          <span class="material-icons">close</span>
        </button>
        <div class="reply-preview-header">返信先:</div>
        <div class="reply-preview-text" id="reply-preview-text"></div>
      </div>
      <div class="image-preview-container" id="image-preview-container">
        <button class="image-preview-close" id="image-preview-close">
          <span class="material-icons">close</span>
        </button>
        <img class="image-preview" id="image-preview" src="" alt="画像プレビュー">
      </div>
      <div class="chat-input-actions">
        <input type="file" id="image-file-input" accept="image/*" hidden>
        <button class="action-btn" id="attach-image-btn" title="画像を添付">
          <span class="material-icons">image</span>
        </button>
      </div>
      <div class="chat-input-wrapper">
        <textarea class="chat-input" id="chat-input" placeholder="${channel.name} にメッセージを送信" rows="1"></textarea>
        <button class="send-btn" id="send-btn">
          <span class="material-icons">send</span>
        </button>
      </div>
    </div>
  `;
}

log('chat-ui.js読み込み完了');
