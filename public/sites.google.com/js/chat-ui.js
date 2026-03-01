// UI表示関連の関数

import{state,CHANNELS}from'./chat-state.js';
import{formatLastOnline}from'./chat-utils.js';
import{canAccessChannel}from'../common/permissions.js';
import{geoAvatarDataUrl}from'../common/geo-avatar.js';
import{supabase}from'../common/supabase-config.js';

function esc(text){
  const d=document.createElement('div');
  d.textContent=text||'';
  return d.innerHTML;
}

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
    let cls='channel-item';
    if(state.selectedChannelId===channel.id)cls+=' active';
    if(channel.requiredRole==='moderator')cls+=' moderator-only';
    channelItem.className=cls;

    const unreadCount=state.unreadCounts[channel.id]||0;
    const unreadBadge=unreadCount>0?`<span class="unread-badge">${unreadCount}</span>`:'';

    channelItem.innerHTML=`
      <div class="channel-icon">
        <span class="material-symbols-outlined">${channel.icon}</span>
      </div>
      <div class="channel-info">
        <div class="channel-name">${esc(channel.name)}${unreadBadge}</div>
        <div class="channel-desc">${esc(channel.desc)}</div>
      </div>
    `;
    channelItem.addEventListener('click',()=>window.selectChannel?.(channel.id));
    dmList.appendChild(channelItem);
  });

  // 区切り線
  const divider=document.createElement('div');
  divider.style.cssText='height:1px;background:var(--border);margin:8px 0;';
  dmList.appendChild(divider);

  // ユーザー一覧（最終ログイン順）
  if(!state.allUsers?.length)return;

  [...state.allUsers]
    .sort((a,b)=>new Date(b.last_online||b.created_at)-new Date(a.last_online||a.created_at))
    .forEach(user=>{
      const dmItem=document.createElement('div');
      let itemCls='dm-item';
      if(state.selectedUserId===user.user_id)itemCls+=' active';
      dmItem.className=itemCls;

      const iconSrc=user.avatar_url||geoAvatarDataUrl(user.id,40);
      const isOnline=user.is_online||false;
      const onlineIndicator=isOnline?'<div class="online-indicator"></div>':'';
      const currentPage=user.current_page||'';
      const statusText=isOnline
        ?(currentPage?`🟢 ${esc(currentPage)}`:'🟢 オンライン')
        :`最終: ${formatLastOnline(user.last_online||user.created_at)}`;

      const unreadCount=state.unreadCounts[user.user_id]||0;
      const unreadBadge=unreadCount>0?`<span class="unread-badge">${unreadCount}</span>`:'';

      dmItem.innerHTML=`
        <div class="dm-item-avatar" style="cursor:pointer;" title="クリック: プロフィール / Ctrl+クリック: 呼び出し">
          <img src="${esc(iconSrc)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">
          ${onlineIndicator}
        </div>
        <div class="dm-item-info">
          <div class="dm-item-name">${esc(user.display_name)}${unreadBadge}</div>
          <div class="dm-item-status">${statusText}</div>
        </div>
      `;

      const avatarEl=dmItem.querySelector('.dm-item-avatar');

      // アバタークリック → プロフィールポップアップ / Ctrl+クリック → 呼び出し
      avatarEl.addEventListener('click',(e)=>{
        e.stopPropagation();
        if(e.ctrlKey){
          _handleCallUser(user);
        }else{
          showProfilePopup(user,avatarEl);
        }
      });

      // アイテム本体クリック → DM開く
      dmItem.addEventListener('click',(e)=>{
        if(e.target.closest('.dm-item-avatar'))return;
        window.selectUser?.(user.user_id);
      });

      dmList.appendChild(dmItem);
    });
}

// ========================================
// 呼び出し
// ========================================

async function _handleCallUser(user){
  if(!user.is_online){
    _miniToast(`${esc(user.display_name)} はオフラインです`);
    return;
  }
  const ok=await window.sendCall?.(user.id,user.display_name);
  if(ok!==false)_miniToast(`${esc(user.display_name)} を呼び出しました 📞`);
}

function _miniToast(html){
  const t=document.createElement('div');
  t.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--bg-primary);border:1px solid var(--border);border-radius:8px;padding:10px 20px;font-size:13px;font-weight:600;color:var(--text-primary);box-shadow:0 4px 16px rgba(0,0,0,0.15);z-index:99998;white-space:nowrap;';
  t.innerHTML=html;
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),3000);
}

// ========================================
// プロフィールポップアップ
// ========================================

let _popup=null;

export async function showProfilePopup(user,anchorEl){
  closeProfilePopup();

  // フル情報取得（bio など最新データ）
  let profile={...user};
  try{
    const{data}=await supabase.from('profiles').select('*').eq('id',user.id).single();
    if(data)profile={...profile,...data};
  }catch(e){}

  const overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;inset:0;z-index:9990;';
  overlay.addEventListener('click',closeProfilePopup);

  const popup=document.createElement('div');
  popup.style.cssText='position:fixed;width:272px;background:var(--bg-primary);border:1px solid var(--border);border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,0.2);z-index:9991;overflow:hidden;';

  // 位置計算
  const rect=anchorEl.getBoundingClientRect();
  let left=rect.right+8;
  if(left+272>window.innerWidth-8)left=rect.left-280;
  if(left<8)left=8;
  let top=rect.top;
  if(top+360>window.innerHeight)top=window.innerHeight-368;
  if(top<8)top=8;
  popup.style.left=left+'px';
  popup.style.top=top+'px';

  const isOnline=profile.is_online||false;
  const statusDot=isOnline?'🟢':'⚫';
  const statusLabel=isOnline?(profile.current_page||'オンライン'):'オフライン';
  const lastOnline=formatLastOnline(profile.last_online||profile.created_at);
  const createdAt=profile.created_at?new Date(profile.created_at).toLocaleDateString('ja-JP'):'不明';
  const bio=profile.bio||'';
  const avatarSrc=profile.avatar_url||geoAvatarDataUrl(profile.id,64);

  popup.innerHTML=`
    <div style="height:44px;background:linear-gradient(135deg,var(--main,#4f46e5),#7c3aed);"></div>
    <div style="padding:0 14px 14px;">
      <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-top:-28px;margin-bottom:10px;">
        <div style="width:58px;height:58px;border-radius:50%;border:3px solid var(--bg-primary);overflow:hidden;background:var(--bg-secondary);">
          <img src="${esc(avatarSrc)}" style="width:100%;height:100%;object-fit:cover;">
        </div>
        ${isOnline?'<button id="pp-call-btn" style="background:var(--main);border:none;border-radius:8px;padding:5px 11px;color:#fff;font-size:12px;font-weight:700;cursor:pointer;margin-bottom:2px;">📞 呼び出す</button>':''}
      </div>
      <div style="font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:1px;">${esc(profile.display_name)}</div>
      <div style="font-size:11px;color:var(--text-tertiary);margin-bottom:8px;">@${esc(profile.user_id)}</div>
      ${bio?`<div style="font-size:12px;color:var(--text-secondary);background:var(--bg-secondary);border-radius:8px;padding:7px 9px;margin-bottom:9px;line-height:1.5;word-break:break-word;">${esc(bio)}</div>`:''}
      <div style="font-size:12px;color:var(--text-secondary);display:flex;flex-direction:column;gap:3px;margin-bottom:10px;">
        <div>${statusDot} ${esc(statusLabel)}</div>
        ${!isOnline?`<div style="color:var(--text-tertiary);">最終: ${lastOnline}</div>`:''}
        <div style="color:var(--text-tertiary);">登録日: ${createdAt}</div>
      </div>
      <button id="pp-dm-btn" style="width:100%;padding:8px;background:var(--main);border:none;border-radius:8px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;">💬 メッセージを送る</button>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(popup);
  _popup={overlay,popup};

  popup.querySelector('#pp-dm-btn')?.addEventListener('click',()=>{
    closeProfilePopup();
    window.selectUser?.(profile.user_id);
  });
  popup.querySelector('#pp-call-btn')?.addEventListener('click',()=>{
    closeProfilePopup();
    _handleCallUser(profile);
  });
}

export function closeProfilePopup(){
  if(_popup){
    _popup.overlay.remove();
    _popup.popup.remove();
    _popup=null;
  }
}

// ========================================
// チャット画面のHTML生成（DM）
// ★ 元のHTML構造を維持（.chat-input-actions + .chat-input-wrapper）
// ========================================

export function createChatHTML(selectedUser){
  const iconSrc=selectedUser.avatar_url||geoAvatarDataUrl(selectedUser.id,36);
  const isOnline=selectedUser.is_online||false;
  const currentPage=selectedUser.current_page||'';
  const statusText=isOnline
    ?(currentPage?`🟢 ${esc(currentPage)}`:'🟢 オンライン')
    :`最終: ${formatLastOnline(selectedUser.last_online||selectedUser.created_at)}`;

  return`
    <div class="chat-header">
      <button class="back-btn" id="back-to-list">
        <span class="material-symbols-outlined">arrow_back</span>
      </button>
      <div class="chat-header-user" style="cursor:pointer;" id="chat-header-user-area" title="プロフィールを表示">
        <div class="chat-header-avatar">
          <img src="${esc(iconSrc)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">
        </div>
        <div class="chat-header-info">
          <div class="chat-header-name">${esc(selectedUser.display_name)}</div>
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
        <img class="image-preview" id="image-preview" src="" alt="画像プレビュー">
      </div>
      <div class="chat-input-actions">
        <input type="file" id="image-file-input" accept="image/*" hidden>
        <button class="action-btn" id="attach-image-btn" title="画像を添付">
          <span class="material-symbols-outlined">image</span>
        </button>
      </div>
      <div class="chat-input-wrapper">
        <textarea class="chat-input" id="chat-input" placeholder="${esc(selectedUser.display_name)} にメッセージを送信" rows="1"></textarea>
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
        <div class="channel-icon" style="width:36px;height:36px;">
          <span class="material-symbols-outlined">${esc(channel.icon)}</span>
        </div>
        <div class="chat-header-info">
          <div class="chat-header-name">${esc(channel.name)}</div>
          <div class="chat-header-status">${esc(channel.desc)}</div>
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
        <textarea class="chat-input" id="chat-input" placeholder="${esc(channel.name)} にメッセージを送信" rows="1"></textarea>
        <button class="send-btn" id="send-btn">
          <span class="material-symbols-outlined">send</span>
        </button>
      </div>
      <div class="typing-indicator" id="typing-indicator"></div>
    </div>
  `;
}