// UI表示関連の関数

import{state,CHANNELS}from'./chat-state.js';
import{formatLastOnline}from'./chat-utils.js';
import{canAccessChannel}from'../common/permissions.js';
import{geoAvatarDataUrl}from'../common/geo-avatar.js';
import{supabase}from'../common/supabase-config.js';

// ========================================
// ユーザー一覧を表示
// ========================================

export function displayUsers(){
  const dmList=document.getElementById('dm-list');
  if(!dmList)return;

  dmList.innerHTML='';

  // チャンネル
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

  // ユーザー一覧（最終ログイン順）
  if(state.allUsers&&state.allUsers.length>0){
    state.allUsers.sort((a,b)=>{
      const at=new Date(a.last_online||a.created_at).getTime();
      const bt=new Date(b.last_online||b.created_at).getTime();
      return bt-at;
    });

    state.allUsers.forEach(user=>{
      const dmItem=document.createElement('div');
      dmItem.className='dm-item';
      if(state.selectedUserId===user.user_id)dmItem.classList.add('active');

      const iconHtml=`<img src="${user.avatar_url||geoAvatarDataUrl(user.id,40)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
      const isOnline=user.is_online||false;
      const onlineIndicator=isOnline?'<div class="online-indicator"></div>':'';
      const statusText=isOnline
        ?(user.current_page?`🟢 ${user.current_page}`:'🟢 オンライン')
        :`最終: ${formatLastOnline(user.last_online||user.created_at)}`;

      const unreadCount=state.unreadCounts[user.user_id]||0;
      const unreadBadge=unreadCount>0?`<span class="unread-badge">${unreadCount}</span>`:'';

      dmItem.innerHTML=`
        <div class="dm-item-avatar" data-user-id="${user.id}" title="Ctrl+クリックで呼び出し">
          ${iconHtml}
          ${onlineIndicator}
        </div>
        <div class="dm-item-info">
          <div class="dm-item-name">${user.display_name}${unreadBadge}</div>
          <div class="dm-item-status">${statusText}</div>
        </div>
      `;

      // アバタークリック → プロフィールポップアップ (Ctrl+クリック → 呼び出し)
      const avatarEl=dmItem.querySelector('.dm-item-avatar');
      avatarEl.style.cursor='pointer';
      avatarEl.addEventListener('click',(e)=>{
        e.stopPropagation();
        if(e.ctrlKey){
          // 呼び出し
          handleCallUser(user);
        }else{
          showProfilePopup(user,avatarEl);
        }
      });

      // DMアイテム本体クリック → チャット開く
      dmItem.addEventListener('click',(e)=>{
        if(e.target.closest('.dm-item-avatar'))return;
        if(window.selectUser)window.selectUser(user.user_id);
      });

      dmList.appendChild(dmItem);
    });
  }
}

// ========================================
// 呼び出し処理
// ========================================

async function handleCallUser(user){
  if(!user.is_online){
    showCallToast(`${user.display_name}はオフラインです`);
    return;
  }
  if(window.sendCall){
    await window.sendCall(user.id,user.display_name);
    showCallToast(`${user.display_name}を呼び出しました 📞`);
  }
}

function showCallToast(msg){
  const t=document.createElement('div');
  t.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--bg-primary);border:1px solid var(--border);border-radius:8px;padding:10px 20px;font-size:13px;font-weight:600;color:var(--text-primary);box-shadow:0 4px 16px rgba(0,0,0,0.15);z-index:99998;animation:toastIn 0.2s ease;';
  t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),3000);
}

// ========================================
// プロフィールポップアップ
// ========================================

let currentPopup=null;

export async function showProfilePopup(user,anchorEl){
  closeProfilePopup();

  // フル情報を取得（bioなど）
  let profile=user;
  try{
    const{data}=await supabase
      .from('profiles')
      .select('*')
      .eq('id',user.id)
      .single();
    if(data)profile=data;
  }catch(e){}

  const overlay=document.createElement('div');
  overlay.id='profile-popup-overlay';
  overlay.style.cssText='position:fixed;inset:0;z-index:9990;';
  overlay.addEventListener('click',closeProfilePopup);

  const popup=document.createElement('div');
  popup.id='profile-popup';

  // アンカー位置計算
  const rect=anchorEl.getBoundingClientRect();
  const popupWidth=280;
  let left=rect.right+8;
  if(left+popupWidth>window.innerWidth-8)left=rect.left-popupWidth-8;
  let top=rect.top;
  if(top+400>window.innerHeight)top=window.innerHeight-408;
  if(top<8)top=8;

  popup.style.cssText=`
    position:fixed;
    left:${left}px;
    top:${top}px;
    width:${popupWidth}px;
    background:var(--bg-primary);
    border:1px solid var(--border);
    border-radius:16px;
    box-shadow:0 8px 32px rgba(0,0,0,0.2);
    z-index:9991;
    overflow:hidden;
    animation:toastIn 0.2s ease;
  `;

  const isOnline=profile.is_online||false;
  const statusDot=isOnline?'🟢':'⚫';
  const statusLabel=isOnline?(profile.current_page||'オンライン'):'オフライン';
  const lastOnline=formatLastOnline(profile.last_online||profile.created_at);
  const createdAt=profile.created_at?new Date(profile.created_at).toLocaleDateString('ja-JP'):'不明';
  const bio=profile.bio||'';

  const avatarSrc=profile.avatar_url||geoAvatarDataUrl(profile.id,72);

  popup.innerHTML=`
    <div style="background:var(--main,#4f46e5);height:48px;"></div>
    <div style="padding:0 16px 16px;">
      <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-top:-32px;margin-bottom:8px;">
        <div style="width:64px;height:64px;border-radius:50%;border:3px solid var(--bg-primary);overflow:hidden;background:var(--bg-secondary);">
          <img src="${avatarSrc}" style="width:100%;height:100%;object-fit:cover;">
        </div>
        <div style="font-size:20px;margin-bottom:4px;" title="Ctrl+クリックでこの人を呼び出し">
          ${isOnline?`<button class="profile-call-btn" data-id="${profile.id}" data-name="${escHtml(profile.display_name)}" title="呼び出し（Ctrl+クリック）" style="background:var(--main);border:none;border-radius:8px;padding:6px 12px;color:#fff;font-size:12px;font-weight:700;cursor:pointer;">📞 呼び出す</button>`:''}
        </div>
      </div>
      <div style="font-size:17px;font-weight:700;color:var(--text-primary);margin-bottom:2px;">${escHtml(profile.display_name)}</div>
      <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:8px;">@${escHtml(profile.user_id)}</div>
      ${bio?`<div style="font-size:13px;color:var(--text-secondary);background:var(--bg-secondary);border-radius:8px;padding:8px 10px;margin-bottom:10px;line-height:1.5;">${escHtml(bio)}</div>`:''}
      <div style="display:flex;flex-direction:column;gap:4px;">
        <div style="font-size:12px;color:var(--text-secondary);display:flex;align-items:center;gap:6px;">
          <span>${statusDot}</span>
          <span>${escHtml(statusLabel)}</span>
        </div>
        ${!isOnline?`<div style="font-size:12px;color:var(--text-tertiary);">最終ログイン: ${lastOnline}</div>`:''}
        <div style="font-size:12px;color:var(--text-tertiary);">登録日: ${createdAt}</div>
      </div>
      <button id="popup-dm-btn" style="width:100%;margin-top:12px;padding:8px;background:var(--main);border:none;border-radius:8px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;">💬 メッセージを送る</button>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(popup);
  currentPopup={overlay,popup};

  // メッセージを送るボタン
  popup.querySelector('#popup-dm-btn')?.addEventListener('click',()=>{
    closeProfilePopup();
    if(window.selectUser)window.selectUser(profile.user_id);
  });

  // 呼び出しボタン
  popup.querySelector('.profile-call-btn')?.addEventListener('click',async()=>{
    closeProfilePopup();
    await handleCallUser(profile);
  });
}

function escHtml(text){
  const d=document.createElement('div');
  d.textContent=text||'';
  return d.innerHTML;
}

function closeProfilePopup(){
  if(currentPopup){
    currentPopup.overlay.remove();
    currentPopup.popup.remove();
    currentPopup=null;
  }
}

// ========================================
// チャット画面のHTML生成（DM）
// ========================================

export function createChatHTML(selectedUser){
  const iconHtml=`<img src="${selectedUser.avatar_url||geoAvatarDataUrl(selectedUser.id,36)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  const isOnline=selectedUser.is_online||false;
  const statusText=isOnline
    ?(selectedUser.current_page?`🟢 ${selectedUser.current_page}`:'🟢 オンライン')
    :`最終: ${formatLastOnline(selectedUser.last_online||selectedUser.created_at)}`;

  return`
    <div class="chat-header">
      <button class="back-btn" id="back-to-list">
        <span class="material-symbols-outlined">arrow_back</span>
      </button>
      <div class="chat-header-user" style="cursor:pointer;" id="chat-header-user-btn" title="プロフィールを表示">
        <div class="chat-header-avatar">
          ${iconHtml}
        </div>
        <div class="chat-header-info">
          <div class="chat-header-name">${selectedUser.display_name}</div>
          <div class="chat-header-status">${statusText}</div>
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
        <img class="image-preview" id="image-preview" alt="プレビュー">
      </div>
      <div class="chat-input-row">
        <button class="image-upload-btn" id="image-upload-btn">
          <span class="material-symbols-outlined">image</span>
        </button>
        <input type="file" id="image-file-input" accept="image/*" hidden>
        <textarea class="chat-input" id="chat-input" placeholder="メッセージを入力..." rows="1"></textarea>
        <button class="send-btn" id="send-btn">
          <span class="material-symbols-outlined">send</span>
        </button>
      </div>
      <div class="typing-indicator" id="typing-indicator"></div>
    </div>
  `;
}

// チャット画面のHTML生成（チャンネル）
export function createChannelChatHTML(channel){
  return`
    <div class="chat-header">
      <button class="back-btn" id="back-to-list">
        <span class="material-symbols-outlined">arrow_back</span>
      </button>
      <div class="chat-header-user">
        <div class="chat-header-avatar" style="background:var(--main-light);display:flex;align-items:center;justify-content:center;">
          <span class="material-symbols-outlined" style="color:var(--main);font-size:20px;">${channel.icon}</span>
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
        <img class="image-preview" id="image-preview" alt="プレビュー">
      </div>
      <div class="chat-input-row">
        <button class="image-upload-btn" id="image-upload-btn">
          <span class="material-symbols-outlined">image</span>
        </button>
        <input type="file" id="image-file-input" accept="image/*" hidden>
        <textarea class="chat-input" id="chat-input" placeholder="${channel.name}にメッセージを送る..." rows="1"></textarea>
        <button class="send-btn" id="send-btn">
          <span class="material-symbols-outlined">send</span>
        </button>
      </div>
      <div class="typing-indicator" id="typing-indicator"></div>
    </div>
  `;
}