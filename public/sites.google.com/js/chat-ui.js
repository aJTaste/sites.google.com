// UI表示関連の関数

import{state}from'./chat-state.js';
import{formatLastOnline}from'./chat-utils.js';
import{canAccessChannel}from'../common/permissions.js';
import{geoAvatarDataUrl}from'../common/geo-avatar.js';
import{supabase}from'../common/supabase-config.js';
import{startDmCall,joinVoiceChannel}from'./call-engine.js';

function esc(text){
  const d=document.createElement('div');
  d.textContent=text||'';
  return d.innerHTML;
}

// ========================================
// ユーザー一覧を表示（外部API）
// ========================================

export function displayUsers(){
  renderSidebarItems();
}

// ========================================
// サイドバーアイテムの描画（内部）
// ========================================

function renderSidebarItems(){
  const dmList=document.getElementById('dm-list');
  if(!dmList)return;

  dmList.innerHTML='';

  // ---- チャンネルセクション ----
const accessibleChannels=(state.channels||[]).filter(ch=>
    canAccessChannel(state.currentProfile?.role,ch.requiredRole)
  );

  if(accessibleChannels.length>0){
    const secLabel=document.createElement('div');
    secLabel.className='dm-section-label';
    secLabel.innerHTML=`
      <span class="material-symbols-outlined">tag</span>
      チャンネル
    `;
    dmList.appendChild(secLabel);

    accessibleChannels.forEach(channel=>{
      let cls='channel-item';
      if(state.selectedChannelId===channel.id)cls+=' active';
      if(channel.requiredRole==='moderator')cls+=' moderator-only';

      const unreadCount=state.unreadCounts[channel.id]||0;
      const unreadBadge=unreadCount>0
        ?`<span class="unread-badge">${unreadCount}</span>`
        :'';

      const item=document.createElement('div');
      item.className=cls;
      item.innerHTML=`
        <div class="channel-icon">
          <span class="material-symbols-outlined">${esc(channel.icon)}</span>
        </div>
        <div class="channel-info">
          <div class="channel-name">${esc(channel.name)}${unreadBadge}</div>
          <div class="channel-desc">${esc(channel.desc)}</div>
        </div>
      `;
      item.addEventListener('click',()=>window.selectChannel?.(channel.id));
      dmList.appendChild(item);
    });
  }

  const VOICE_CHANNELS=[
  {id:'voice-1',name:'ボイス 1'},
  {id:'voice-2',name:'ボイス 2'},
];
const vcLabel=document.createElement('div');
vcLabel.className='dm-section-label';
vcLabel.innerHTML='<span class="material-symbols-outlined">volume_up</span> ボイスチャンネル';
dmList.appendChild(vcLabel);
VOICE_CHANNELS.forEach(vc=>{
  const item=document.createElement('div');
  item.className='vc-item';item.dataset.vcId=vc.id;
  item.innerHTML='<div class="vc-icon"><span class="material-symbols-outlined">volume_up</span></div>'
    +'<div class="vc-item-info"><div class="vc-item-name">'+esc(vc.name)+'</div></div>';
  item.addEventListener('click',()=>joinVoiceChannel(vc.id));
  dmList.appendChild(item);
});


  // ---- ユーザー一覧セクション ----
  if(!state.allUsers?.length)return;

  const sorted=[...state.allUsers].sort((a,b)=>{
    if(a.is_online!==b.is_online)return a.is_online?-1:1;
    return new Date(b.last_online||b.created_at)-new Date(a.last_online||a.created_at);
  });

  if(sorted.length>0){
    const secLabel=document.createElement('div');
    secLabel.className='dm-section-label';
    secLabel.innerHTML=`
      <span class="material-symbols-outlined">person</span>
      ダイレクトメッセージ
    `;
    dmList.appendChild(secLabel);

    sorted.forEach(user=>{
      const dmItem=document.createElement('div');
      let itemCls='dm-item';
      if(state.selectedUserId===user.user_id)itemCls+=' active';
      dmItem.className=itemCls;

      const iconSrc=user.avatar_url||geoAvatarDataUrl(user.id,40);
      const isOnline=user.is_online||false;
      const onlineIndicator=isOnline
        ?'<div class="online-indicator"></div>':'';
      const currentPage=user.current_page||'';
      const statusText=isOnline
        ?(currentPage?esc(currentPage):'オンライン')
        :`最終: ${formatLastOnline(user.last_online||user.created_at)}`;

      const unreadCount=state.unreadCounts[user.user_id]||0;
      const unreadBadge=unreadCount>0
        ?`<span class="unread-badge">${unreadCount}</span>`
        :'';

      dmItem.innerHTML=`
        <div class="dm-item-avatar" title="クリック: プロフィール / Ctrl+クリック: 呼び出し">
          <img src="${esc(iconSrc)}" alt="${esc(user.display_name)}">
          ${onlineIndicator}
        </div>
        <div class="dm-item-info">
          <div class="dm-item-name">${esc(user.display_name)}${unreadBadge}</div>
          <div class="dm-item-status">${statusText}</div>
        </div>
      `;

      const avatarEl=dmItem.querySelector('.dm-item-avatar');
      avatarEl.addEventListener('click',(e)=>{
        e.stopPropagation();
        if(e.ctrlKey){
          _handleCallUser(user);
        }else{
          showProfilePopup(user,avatarEl);
        }
      });

      dmItem.addEventListener('click',(e)=>{
        if(e.target.closest('.dm-item-avatar'))return;
        window.selectUser?.(user.user_id);
      });

      dmList.appendChild(dmItem);
    });
  }
}

// ========================================
// 呼び出し
// ========================================

async function _handleCallUser(user){
  if(!user.is_online){
    _miniToast(user.display_name+' はオフラインです');
    return;
  }
  await startDmCall(user);
}

function _miniToast(msg){
  const t=document.createElement('div');
  t.className='mini-toast';
  t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>t.classList.add('show'),10);
  setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),300);},2500);
}

// ========================================
// プロフィールポップアップ
// ========================================

let _popup=null;

export function showProfilePopup(profile,anchorEl){
  if(_popup){closeProfilePopup();}

  const overlay=document.createElement('div');
  overlay.className='profile-popup-overlay';
  overlay.addEventListener('click',closeProfilePopup);

  const popup=document.createElement('div');
  popup.className='profile-popup';

  const iconSrc=profile.avatar_url||geoAvatarDataUrl(profile.id,56);
  const isOnline=profile.is_online||false;
  const currentPage=profile.current_page||'';
  const statusText=isOnline
    ?(currentPage?esc(currentPage):'オンライン')
    :`最終: ${formatLastOnline(profile.last_online||profile.created_at)}`;

  let roleBadge='';
  if(profile.role==='admin'){
    roleBadge='<span class="role-badge role-admin">Admin</span>';
  }else if(profile.role==='moderator'){
    roleBadge='<span class="role-badge role-moderator">Mod</span>';
  }

  const bioSection=profile.bio
    ?`<div class="pp-body">
        <div class="pp-field">
          <div class="pp-field-label">自己紹介</div>
          <div class="pp-field-value">${esc(profile.bio)}</div>
        </div>
      </div>`
    :`<div style="height:2px;"></div>`;

  popup.innerHTML=`
    <div class="pp-header">
      <div class="pp-avatar">
        <img src="${esc(iconSrc)}" alt="${esc(profile.display_name)}">
        ${isOnline?'<div class="online-indicator"></div>':''}
      </div>
      <div class="pp-name-row">
        <div class="pp-name">${esc(profile.display_name)}</div>
        ${roleBadge}
        ${isOnline?'<span class="pp-online-text">● オンライン</span>':''}
      </div>
      <div class="pp-status">${statusText}</div>
    </div>
    ${bioSection}
    <div class="pp-actions">
      <button class="pp-btn" id="pp-dm-btn">
        <span class="material-symbols-outlined">chat_bubble</span>
        メッセージ
      </button>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(popup);
  _popup=popup;

  // 位置調整
  const rect=anchorEl.getBoundingClientRect();
  const pw=276;
  let left=rect.left;
  let top=rect.bottom+8;

  if(left+pw>window.innerWidth-12)left=window.innerWidth-pw-12;
  if(top+popup.offsetHeight>window.innerHeight-12)top=rect.top-popup.offsetHeight-8;

  popup.style.left=`${Math.max(12,left)}px`;
  popup.style.top=`${Math.max(12,top)}px`;

  const dmBtn=popup.querySelector('#pp-dm-btn');
  if(dmBtn){
    dmBtn.addEventListener('click',()=>{
      closeProfilePopup();
      window.selectUser?.(profile.user_id);
    });
  }
}

function closeProfilePopup(){
  if(_popup){_popup.remove();_popup=null;}
  document.querySelector('.profile-popup-overlay')?.remove();
}

// ========================================
// チャット画面のHTML生成（DM）
// ========================================

export function createChatHTML(selectedUser){
  const iconSrc=selectedUser.avatar_url||geoAvatarDataUrl(selectedUser.id,36);
  const isOnline=selectedUser.is_online||false;
  const currentPage=selectedUser.current_page||'';
  const statusText=isOnline
    ?(currentPage?esc(currentPage):'オンライン')
    :`最終: ${formatLastOnline(selectedUser.last_online||selectedUser.created_at)}`;
  const onlineIndicator=isOnline?'<div class="online-indicator"></div>':'';

  return`
    <div class="chat-header">
      <button class="back-btn" id="back-to-list">
        <span class="material-symbols-outlined">arrow_back</span>
      </button>
      <div class="chat-header-user" id="chat-header-user-area">
        <div class="chat-header-avatar">
          <img src="${esc(iconSrc)}" alt="${esc(selectedUser.display_name)}">
          ${onlineIndicator}
        </div>
        <div class="chat-header-info">
          <div class="chat-header-name">${esc(selectedUser.display_name)}</div>
          <div class="chat-header-status">${statusText}</div>
        </div>
      </div>
    </div>
    <div class="chat-messages" id="chat-messages">
      <div style="display:flex;align-items:center;justify-content:center;padding:40px;color:var(--text-tertiary);font-size:14px;">
        読み込み中...
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
      <div class="chat-input-wrapper">
        <input type="file" id="image-file-input" accept="image/*" hidden>
        <button class="action-btn" id="attach-image-btn" title="画像を添付">
          <span class="material-symbols-outlined">image</span>
        </button>
        <textarea class="chat-input" id="chat-input" placeholder="${esc(selectedUser.display_name)} にメッセージ..." rows="1"></textarea>
        <button class="send-btn" id="send-btn">
          <span class="material-symbols-outlined">send</span>
        </button>
      </div>
      <div class="typing-indicator" id="typing-indicator"></div>
    </div>
  `;
}

// ========================================
// チャット画面のHTML生成（チャンネル）
// ========================================

export function createChannelChatHTML(channel){
  return`
    <div class="chat-header">
      <button class="back-btn" id="back-to-list">
        <span class="material-symbols-outlined">arrow_back</span>
      </button>
      <div class="chat-header-user">
        <div class="channel-icon" style="width:36px;height:36px;border-radius:10px;">
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
        読み込み中...
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
      <div class="chat-input-wrapper">
        <input type="file" id="image-file-input" accept="image/*" hidden>
        <button class="action-btn" id="attach-image-btn" title="画像を添付">
          <span class="material-symbols-outlined">image</span>
        </button>
        <textarea class="chat-input" id="chat-input" placeholder="${esc(channel.name)} にメッセージ..." rows="1"></textarea>
        <button class="send-btn" id="send-btn">
          <span class="material-symbols-outlined">send</span>
        </button>
      </div>
      <div class="typing-indicator" id="typing-indicator"></div>
    </div>
  `;
}
