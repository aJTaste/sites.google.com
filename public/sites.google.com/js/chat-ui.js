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
// 検索バーの初期化（一度だけ呼ぶ）
// ========================================

let _searchQuery='';

export function initSearchBar(){
  const input=document.getElementById('dm-search-input');
  if(!input||input.dataset.initialized)return;
  input.dataset.initialized='1';
  input.addEventListener('input',()=>{
    _searchQuery=input.value.trim().toLowerCase();
    renderSidebarItems();
  });
}

// ========================================
// ユーザー一覧を表示（外部API）
// ========================================

export function displayUsers(){
  initSearchBar();
  renderSidebarItems();
}

// ========================================
// サイドバーアイテムの描画（内部）
// ========================================

function renderSidebarItems(){
  const dmList=document.getElementById('dm-list');
  if(!dmList)return;

  const q=_searchQuery;
  dmList.innerHTML='';

  // ---- チャンネルセクション ----
  const accessibleChannels=CHANNELS.filter(ch=>
    canAccessChannel(state.currentProfile?.role,ch.requiredRole)
    &&(!q||ch.name.toLowerCase().includes(q)||ch.desc.toLowerCase().includes(q))
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

  // ---- ユーザー一覧セクション ----
  if(!state.allUsers?.length)return;

  const sorted=[...state.allUsers].sort((a,b)=>{
    // オンラインを先頭に、次に最終ログイン順
    if(a.is_online!==b.is_online)return a.is_online?-1:1;
    return new Date(b.last_online||b.created_at)-new Date(a.last_online||a.created_at);
  });

  const filtered=q
    ?sorted.filter(u=>u.display_name?.toLowerCase().includes(q)||u.user_id?.toLowerCase().includes(q))
    :sorted;

  if(filtered.length>0){
    const secLabel=document.createElement('div');
    secLabel.className='dm-section-label';
    secLabel.innerHTML=`
      <span class="material-symbols-outlined">person</span>
      ダイレクトメッセージ
    `;
    dmList.appendChild(secLabel);

    filtered.forEach(user=>{
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
      const unreadBadge=unreadCount>0
        ?`<span class="unread-badge">${unreadCount}</span>`
        :'';

      dmItem.innerHTML=`
        <div class="dm-item-avatar" title="クリック: プロフィール / Ctrl+クリック: 呼び出し">
          <img src="${esc(iconSrc)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">
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

  // 検索結果なし
  if(q&&accessibleChannels.length===0&&filtered.length===0){
    const noResult=document.createElement('div');
    noResult.className='dm-no-results';
    noResult.textContent=`"${q}" は見つかりませんでした`;
    dmList.appendChild(noResult);
  }
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
  t.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--bg-primary);border:1px solid var(--border);border-radius:8px;padding:10px 20px;font-size:13px;font-weight:600;color:var(--text-primary);box-shadow:0 4px 16px rgba(0,0,0,0.15);z-index:99998;white-space:nowrap;animation:fadeInUp 0.25s ease;';
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

  let profile={...user};
  try{
    const{data}=await supabase.from('profiles').select('*').eq('id',user.id).single();
    if(data)profile={...profile,...data};
  }catch(e){}

  const overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;inset:0;z-index:9990;';
  overlay.addEventListener('click',closeProfilePopup);

  const popup=document.createElement('div');
  popup.style.cssText='position:fixed;width:272px;background:var(--bg-primary);border:1px solid var(--border);border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,0.2);z-index:9991;overflow:hidden;animation:fadeInUp 0.2s ease;';

  const rect=anchorEl.getBoundingClientRect();
  let left=rect.right+10;
  if(left+272>window.innerWidth-8)left=rect.left-282;
  if(left<8)left=8;
  let top=rect.top;
  if(top+380>window.innerHeight)top=window.innerHeight-388;
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
    <div style="height:44px;background:linear-gradient(135deg,var(--main),#e55a2b);"></div>
    <div style="padding:0 14px 14px;">
      <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-top:-28px;margin-bottom:10px;">
        <div style="width:56px;height:56px;border-radius:50%;border:3px solid var(--bg-primary);overflow:hidden;background:var(--bg-secondary);flex-shrink:0;">
          <img src="${esc(avatarSrc)}" style="width:100%;height:100%;object-fit:cover;">
        </div>
        ${isOnline?'<button id="pp-call-btn" style="background:var(--main);border:none;border-radius:8px;padding:5px 12px;color:#fff;font-size:12px;font-weight:700;cursor:pointer;margin-bottom:2px;">📞 呼び出す</button>':''}
      </div>
      <div style="font-size:15px;font-weight:700;color:var(--text-primary);margin-bottom:1px;">${esc(profile.display_name)}</div>
      <div style="font-size:11px;color:var(--text-tertiary);margin-bottom:8px;">@${esc(profile.user_id||'')}</div>
      ${bio?`<div style="font-size:12px;color:var(--text-secondary);background:var(--bg-secondary);border-radius:8px;padding:7px 10px;margin-bottom:9px;line-height:1.5;word-break:break-word;">${esc(bio)}</div>`:''}
      <div style="font-size:12px;color:var(--text-secondary);display:flex;flex-direction:column;gap:3px;margin-bottom:10px;">
        <div>${statusDot} ${esc(statusLabel)}</div>
        ${!isOnline?`<div style="color:var(--text-tertiary);">最終: ${lastOnline}</div>`:''}
        <div style="color:var(--text-tertiary);">登録日: ${createdAt}</div>
      </div>
      <button id="pp-dm-btn" style="width:100%;padding:8px;background:var(--main);border:none;border-radius:8px;color:#fff;font-size:13px;font-weight:700;cursor:pointer;transition:background 0.12s;">💬 メッセージを送る</button>
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