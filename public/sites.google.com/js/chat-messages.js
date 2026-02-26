// メッセージ表示・送信関連（Supabase版）- Cloudinary対応 + ページネーション

import{supabase}from'../common/supabase-config.js';
import{state,updateState,resetMessageState}from'./chat-state.js';
import{getDmId,formatMessageTime,showNotification}from'./chat-utils.js';
import{displayUsers}from'./chat-ui.js';
import{uploadBase64ToCloudinary}from'../common/cloudinary.js';
import{geoAvatarDataUrl}from'../common/geo-avatar.js';

const PAGE_SIZE=30;

// ページネーション管理
const pg={
  type:null,
  dmId:null,
  userId:null,
  channelId:null,
  oldestAt:null,
  hasMore:false,
  loading:false
};

function isStealthModeActive(){
  const saved=localStorage.getItem('stealthModeState');
  if(saved){try{return JSON.parse(saved).stealthMode;}catch(e){return false;}}
  return false;
}

// ========================================
// テキスト処理
// ========================================

function formatMessageText(text){
  if(!text)return'';
  const escaped=text
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
  let formatted=escaped.replace(/\n/g,'<br>');
  const urlRegex=/(https?:\/\/[^\s]+)/g;
  formatted=formatted.replace(urlRegex,'<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  return formatted;
}

function copyMessageText(text){
  if(!text){alert('コピーするテキストがありません');return;}
  navigator.clipboard.writeText(text).then(()=>{
    const n=document.createElement('div');
    n.style.cssText='position:fixed;top:80px;right:24px;padding:12px 20px;background:#2da44e;color:#fff;border-radius:6px;font-size:14px;font-weight:600;z-index:9999;animation:slideIn 0.3s ease;';
    n.textContent='✓ コピーしました';
    document.body.appendChild(n);
    setTimeout(()=>{n.style.animation='slideIn 0.3s ease reverse';setTimeout(()=>n.remove(),300);},2000);
  }).catch(()=>alert('コピーに失敗しました'));
}

// ========================================
// 日付セパレーター
// ========================================

function getDateKey(timestamp){
  const d=new Date(timestamp);
  return`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatDateLabel(timestamp){
  const d=new Date(timestamp);
  const now=new Date();
  const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const msgDay=new Date(d.getFullYear(),d.getMonth(),d.getDate());
  const diff=(today-msgDay)/86400000;
  if(diff===0)return'今日';
  if(diff===1)return'昨日';
  if(diff<7)return`${Math.floor(diff)}日前`;
  return d.toLocaleDateString('ja-JP',{year:'numeric',month:'long',day:'numeric'});
}

function createDateSeparator(timestamp){
  const el=document.createElement('div');
  el.className='date-separator';
  el.setAttribute('data-date-key',getDateKey(timestamp));
  el.innerHTML=`<span>${formatDateLabel(timestamp)}</span>`;
  return el;
}

// ========================================
// スクロール制御
// ========================================

function scrollToBottom(el,immediate=false){
  if(immediate){el.scrollTop=el.scrollHeight;}
  else{el.scrollTo({top:el.scrollHeight,behavior:'smooth'});}
}

function isAtBottom(el){
  return el.scrollHeight-el.scrollTop-el.clientHeight<=80;
}

// ========================================
// スクロールダウンボタン
// ========================================

function ensureScrollDownBtn(){
  let btn=document.getElementById('scroll-down-btn');
  if(!btn){
    btn=document.createElement('button');
    btn.id='scroll-down-btn';
    btn.className='scroll-down-btn';
    btn.innerHTML='<span class="material-symbols-outlined">keyboard_arrow_down</span>';
    btn.onclick=()=>{
      const cm=document.getElementById('chat-messages');
      if(cm)scrollToBottom(cm,false);
    };
    const chatMain=document.getElementById('chat-main');
    if(chatMain)chatMain.appendChild(btn);
  }
  return btn;
}

function updateScrollDownBtn(chatMessages){
  const btn=document.getElementById('scroll-down-btn');
  if(!btn)return;
  if(isAtBottom(chatMessages)){btn.classList.remove('visible');}
  else{btn.classList.add('visible');}
}

// ========================================
// もっと読み込むインジケーター
// ========================================

function showLoadMoreIndicator(chatMessages){
  let el=document.getElementById('load-more-indicator');
  if(!el){
    el=document.createElement('div');
    el.id='load-more-indicator';
    el.className='load-more-indicator';
    el.innerHTML='<div class="load-more-spinner"></div>';
  }
  chatMessages.insertBefore(el,chatMessages.firstChild);
}

function hideLoadMoreIndicator(){
  const el=document.getElementById('load-more-indicator');
  if(el)el.remove();
}

// ========================================
// スクロールイベント設定
// ========================================

function setupScrollListeners(chatMessages){
  chatMessages.addEventListener('scroll',()=>{
    updateScrollDownBtn(chatMessages);
    if(chatMessages.scrollTop<80&&pg.hasMore&&!pg.loading){
      if(pg.type==='dm')loadMoreDmMessages(chatMessages);
      else if(pg.type==='channel')loadMoreChannelMessages(chatMessages);
    }
  });
}

// ========================================
// メッセージ読み込み（DM）
// ========================================

export function loadMessages(userId){
  if(state.messageSubscription){supabase.removeChannel(state.messageSubscription);}

  const dmId=getDmId(state.currentProfile.user_id,userId);

  pg.type='dm';pg.dmId=dmId;pg.userId=userId;
  pg.channelId=null;pg.oldestAt=null;pg.hasMore=false;pg.loading=false;

  loadInitialMessages(dmId,userId);

  const subscription=supabase
    .channel(`dm:${dmId}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'dm_messages',filter:`dm_id=eq.${dmId}`},
    async(payload)=>{
      if(payload.eventType==='INSERT'){
        await displaySingleMessage(payload.new,userId,true);
        if(state.selectedUserId===userId)await markAsRead(userId);
        if(payload.new.sender_id!==state.currentProfile.id){
          const sender=state.allUsers.find(u=>u.id===payload.new.sender_id);
          if(sender&&!isStealthModeActive()){
            showNotification(`${sender.display_name}からのメッセージ`,payload.new.text||'画像を送信しました',sender.avatar_url||null);
          }
        }
      }else if(payload.eventType==='UPDATE'){
        updateMessageInDOM(payload.new.id,payload.new,userId);
      }else if(payload.eventType==='DELETE'){
        removeMessageFromDOM(payload.old.id);
      }
    })
    .subscribe();

  updateState('messageSubscription',subscription);
}

async function loadInitialMessages(dmId,userId){
  const chatMessages=document.getElementById('chat-messages');
  if(!chatMessages)return;
  chatMessages.innerHTML='<div style="display:flex;align-items:center;justify-content:center;padding:40px;color:var(--text-tertiary);font-size:14px;">読み込み中...</div>';

  try{
    const{data:messages,error}=await supabase
      .from('dm_messages').select('*').eq('dm_id',dmId)
      .order('created_at',{ascending:false}).limit(PAGE_SIZE);
    if(error)throw error;

    chatMessages.innerHTML='';

    if(messages&&messages.length>0){
      const sorted=messages.slice().reverse();
      pg.oldestAt=sorted[0].created_at;
      pg.hasMore=messages.length===PAGE_SIZE;

      let lastDateKey=null;
      for(const msg of sorted){
        const dk=getDateKey(msg.created_at);
        if(dk!==lastDateKey){chatMessages.appendChild(createDateSeparator(msg.created_at));lastDateKey=dk;}
        const el=await buildMessageElement(msg,userId,false);
        if(el)chatMessages.appendChild(el);
      }
      scrollToBottom(chatMessages,true);
      await markAsRead(userId);
    }else{
      chatMessages.innerHTML='<div style="text-align:center;color:var(--text-tertiary);padding:40px;">まだメッセージはありません</div>';
    }
    setupScrollListeners(chatMessages);
    ensureScrollDownBtn();
    updateScrollDownBtn(chatMessages);
  }catch(error){
    console.error('メッセージ読み込みエラー:',error);
    chatMessages.innerHTML='<div style="text-align:center;color:var(--text-tertiary);padding:40px;">メッセージの読み込みに失敗しました</div>';
  }
}

async function loadMoreDmMessages(chatMessages){
  if(pg.loading||!pg.hasMore||!pg.oldestAt)return;
  pg.loading=true;
  showLoadMoreIndicator(chatMessages);
  const prevScrollHeight=chatMessages.scrollHeight;

  try{
    const{data:messages,error}=await supabase
      .from('dm_messages').select('*').eq('dm_id',pg.dmId)
      .lt('created_at',pg.oldestAt).order('created_at',{ascending:false}).limit(PAGE_SIZE);
    if(error)throw error;

    hideLoadMoreIndicator();
    if(!messages||messages.length===0){pg.hasMore=false;pg.loading=false;return;}

    const sorted=messages.slice().reverse();
    pg.oldestAt=sorted[0].created_at;
    pg.hasMore=messages.length===PAGE_SIZE;

    const firstDateEl=chatMessages.querySelector('.date-separator');
    const firstDateKey=firstDateEl?firstDateEl.getAttribute('data-date-key'):null;

    const frag=document.createDocumentFragment();
    let lastDateKey=null;
    for(const msg of sorted){
      const dk=getDateKey(msg.created_at);
      if(dk!==lastDateKey){frag.appendChild(createDateSeparator(msg.created_at));lastDateKey=dk;}
      const el=await buildMessageElement(msg,pg.userId,false);
      if(el)frag.appendChild(el);
    }
    if(lastDateKey&&lastDateKey===firstDateKey&&firstDateEl)firstDateEl.remove();
    chatMessages.insertBefore(frag,chatMessages.firstChild);
    chatMessages.scrollTop=chatMessages.scrollHeight-prevScrollHeight;
  }catch(error){
    console.error('追加読み込みエラー:',error);
    hideLoadMoreIndicator();
  }finally{pg.loading=false;}
}

// ========================================
// メッセージ読み込み（チャンネル）
// ========================================

export function loadChannelMessages(channelId){
  if(state.messageSubscription){supabase.removeChannel(state.messageSubscription);}

  pg.type='channel';pg.channelId=channelId;
  pg.dmId=null;pg.userId=null;pg.oldestAt=null;pg.hasMore=false;pg.loading=false;

  loadInitialChannelMessages(channelId);

  const subscription=supabase
    .channel(`channel:${channelId}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'channel_messages',filter:`channel_id=eq.${channelId}`},
    async(payload)=>{
      if(payload.eventType==='INSERT'){
        await displaySingleChannelMessage(payload.new,true);
        if(state.selectedChannelId===channelId)await markAsRead(channelId);
        if(payload.new.sender_id!==state.currentProfile.id){
          const sender=state.allUsers.find(u=>u.id===payload.new.sender_id)||{display_name:'不明'};
          if(!isStealthModeActive()){
            showNotification(`${channelId}: ${sender.display_name}`,payload.new.text||'画像を送信しました',sender.avatar_url||null);
          }
        }
      }else if(payload.eventType==='UPDATE'){
        updateMessageInDOM(payload.new.id,payload.new,null);
      }else if(payload.eventType==='DELETE'){
        removeMessageFromDOM(payload.old.id);
      }
    })
    .subscribe();

  updateState('messageSubscription',subscription);
}

async function loadInitialChannelMessages(channelId){
  const chatMessages=document.getElementById('chat-messages');
  if(!chatMessages)return;
  chatMessages.innerHTML='<div style="display:flex;align-items:center;justify-content:center;padding:40px;color:var(--text-tertiary);font-size:14px;">読み込み中...</div>';

  try{
    const{data:messages,error}=await supabase
      .from('channel_messages').select('*').eq('channel_id',channelId)
      .order('created_at',{ascending:false}).limit(PAGE_SIZE);
    if(error)throw error;

    chatMessages.innerHTML='';

    if(messages&&messages.length>0){
      const sorted=messages.slice().reverse();
      pg.oldestAt=sorted[0].created_at;
      pg.hasMore=messages.length===PAGE_SIZE;

      let lastDateKey=null;
      for(const msg of sorted){
        const dk=getDateKey(msg.created_at);
        if(dk!==lastDateKey){chatMessages.appendChild(createDateSeparator(msg.created_at));lastDateKey=dk;}
        const el=await buildChannelMessageElement(msg);
        if(el)chatMessages.appendChild(el);
      }
      scrollToBottom(chatMessages,true);
      await markAsRead(channelId);
    }else{
      chatMessages.innerHTML='<div style="text-align:center;color:var(--text-tertiary);padding:40px;">まだメッセージはありません</div>';
    }
    setupScrollListeners(chatMessages);
    ensureScrollDownBtn();
    updateScrollDownBtn(chatMessages);
  }catch(error){
    console.error('メッセージ読み込みエラー:',error);
    chatMessages.innerHTML='<div style="text-align:center;color:var(--text-tertiary);padding:40px;">メッセージの読み込みに失敗しました</div>';
  }
}

async function loadMoreChannelMessages(chatMessages){
  if(pg.loading||!pg.hasMore||!pg.oldestAt)return;
  pg.loading=true;
  showLoadMoreIndicator(chatMessages);
  const prevScrollHeight=chatMessages.scrollHeight;

  try{
    const{data:messages,error}=await supabase
      .from('channel_messages').select('*').eq('channel_id',pg.channelId)
      .lt('created_at',pg.oldestAt).order('created_at',{ascending:false}).limit(PAGE_SIZE);
    if(error)throw error;

    hideLoadMoreIndicator();
    if(!messages||messages.length===0){pg.hasMore=false;pg.loading=false;return;}

    const sorted=messages.slice().reverse();
    pg.oldestAt=sorted[0].created_at;
    pg.hasMore=messages.length===PAGE_SIZE;

    const firstDateEl=chatMessages.querySelector('.date-separator');
    const firstDateKey=firstDateEl?firstDateEl.getAttribute('data-date-key'):null;

    const frag=document.createDocumentFragment();
    let lastDateKey=null;
    for(const msg of sorted){
      const dk=getDateKey(msg.created_at);
      if(dk!==lastDateKey){frag.appendChild(createDateSeparator(msg.created_at));lastDateKey=dk;}
      const el=await buildChannelMessageElement(msg);
      if(el)frag.appendChild(el);
    }
    if(lastDateKey&&lastDateKey===firstDateKey&&firstDateEl)firstDateEl.remove();
    chatMessages.insertBefore(frag,chatMessages.firstChild);
    chatMessages.scrollTop=chatMessages.scrollHeight-prevScrollHeight;
  }catch(error){
    console.error('追加読み込みエラー:',error);
    hideLoadMoreIndicator();
  }finally{pg.loading=false;}
}

// ========================================
// 既読管理
// ========================================

async function markAsRead(targetId){
  try{
    await supabase.from('read_status').upsert({
      user_id:state.currentProfile.id,
      target_id:targetId,
      last_read_at:new Date().toISOString()
    },{onConflict:'user_id,target_id'});
    state.unreadCounts[targetId]=0;
    displayUsers();
  }catch(error){console.error('既読更新エラー:',error);}
}

// ========================================
// メッセージ要素生成（DM）
// ========================================

async function buildMessageElement(msg,otherUserId,checkRead){
  const isCurrentUser=msg.sender_id===state.currentProfile.id;
  let senderData=isCurrentUser?state.currentProfile:state.allUsers.find(u=>u.id===msg.sender_id);
  if(!senderData)return null;

  const iconHtml=`<img src="${senderData.avatar_url||geoAvatarDataUrl(senderData.id,40)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;

  let isRead=false;
  if(checkRead&&isCurrentUser&&otherUserId){
    const{data:readStatus}=await supabase
      .from('read_status').select('last_read_at')
      .eq('user_id',otherUserId).eq('target_id',state.currentProfile.user_id).single();
    isRead=readStatus&&new Date(readStatus.last_read_at)>=new Date(msg.created_at);
  }

  const isEdited=msg.updated_at&&new Date(msg.updated_at).getTime()>new Date(msg.created_at).getTime()+1000;
  const messageEl=document.createElement('div');
  messageEl.className='message';
  messageEl.setAttribute('data-message-id',msg.id);

  const avatarDiv=document.createElement('div');
  avatarDiv.className='message-avatar';
  avatarDiv.innerHTML=iconHtml;
  messageEl.appendChild(avatarDiv);

  const contentDiv=document.createElement('div');
  contentDiv.className='message-content';

  const headerDiv=document.createElement('div');
  headerDiv.className='message-header';
  headerDiv.innerHTML=`
    <span class="message-author">${senderData.display_name}</span>
    <span class="message-time">${formatMessageTime(msg.created_at)}</span>
    ${isCurrentUser&&isRead?'<span class="message-read">既読</span>':''}
  `;
  contentDiv.appendChild(headerDiv);

  if(msg.reply_to_text){
    const replyDiv=document.createElement('div');
    replyDiv.className='message-reply';
    replyDiv.textContent='返信: '+(msg.reply_to_text.substring(0,100))+(msg.reply_to_text.length>100?'...':'');
    contentDiv.appendChild(replyDiv);
  }
  if(msg.text){
    const textDiv=document.createElement('div');
    textDiv.className='message-text';
    textDiv.innerHTML=formatMessageText(msg.text);
    contentDiv.appendChild(textDiv);
  }
  if(msg.image_url){
    const img=document.createElement('img');
    img.className='message-image';img.src=msg.image_url;img.alt='画像';
    img.onclick=()=>window.openImageModal(msg.image_url);
    contentDiv.appendChild(img);
  }
  if(isEdited){
    const editedDiv=document.createElement('div');
    editedDiv.className='message-edited';editedDiv.textContent='(編集済み)';
    contentDiv.appendChild(editedDiv);
  }
  messageEl.appendChild(contentDiv);

  const actionsDiv=document.createElement('div');
  actionsDiv.className='message-actions';

  const replyBtn=document.createElement('button');
  replyBtn.className='message-action-btn';replyBtn.title='返信';
  replyBtn.innerHTML='<span class="material-symbols-outlined">reply</span>';
  replyBtn.onclick=()=>window.replyMessage(msg.id,msg.text||'',msg.sender_id);
  actionsDiv.appendChild(replyBtn);

  const copyBtn=document.createElement('button');
  copyBtn.className='message-action-btn';copyBtn.title='コピー';
  copyBtn.innerHTML='<span class="material-symbols-outlined">content_copy</span>';
  copyBtn.onclick=()=>copyMessageText(msg.text||'');
  actionsDiv.appendChild(copyBtn);

  if(isCurrentUser){
    const editBtn=document.createElement('button');
    editBtn.className='message-action-btn';editBtn.title='編集';
    editBtn.innerHTML='<span class="material-symbols-outlined">edit</span>';
    editBtn.onclick=()=>window.editMessage(msg.id,msg.text||'',true);
    actionsDiv.appendChild(editBtn);

    const deleteBtn=document.createElement('button');
    deleteBtn.className='message-action-btn delete';deleteBtn.title='削除';
    deleteBtn.innerHTML='<span class="material-symbols-outlined">delete</span>';
    deleteBtn.onclick=()=>window.deleteMessage(msg.id,true);
    actionsDiv.appendChild(deleteBtn);
  }
  messageEl.appendChild(actionsDiv);
  return messageEl;
}

// ========================================
// メッセージ表示（DM）
// ========================================

async function displaySingleMessage(msg,otherUserId,shouldScroll){
  const chatMessages=document.getElementById('chat-messages');
  if(!chatMessages)return;

  const isCurrentUser=msg.sender_id===state.currentProfile.id;

  // リアルタイム受信時の日付セパレーター
  const dk=getDateKey(msg.created_at);
  const lastDateEl=chatMessages.querySelector('.date-separator:last-of-type');
  const lastDateKey=lastDateEl?lastDateEl.getAttribute('data-date-key'):null;
  if(dk!==lastDateKey)chatMessages.appendChild(createDateSeparator(msg.created_at));

  const el=await buildMessageElement(msg,otherUserId,shouldScroll);
  if(!el)return;

  const wasAtBottom=isAtBottom(chatMessages);
  chatMessages.appendChild(el);

  if(shouldScroll&&(isCurrentUser||wasAtBottom))scrollToBottom(chatMessages,false);
  updateScrollDownBtn(chatMessages);
}

// ========================================
// メッセージ要素生成（チャンネル）
// ========================================

async function buildChannelMessageElement(msg){
  const isCurrentUser=msg.sender_id===state.currentProfile.id;
  let senderData=isCurrentUser?state.currentProfile:state.allUsers.find(u=>u.id===msg.sender_id);
  if(!senderData)return null;

  let iconHtml;
  if(senderData.avatar_url){
    iconHtml=`<img src="${senderData.avatar_url}" alt="${senderData.display_name}">`;
  }else{
    const initial=senderData.display_name.charAt(0).toUpperCase();
    const bgColor=senderData.avatar_color||'#FF6B35';
    iconHtml=`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${bgColor};color:#fff;font-weight:600;font-size:16px;border-radius:50%;">${initial}</div>`;
  }

  const isEdited=msg.updated_at&&new Date(msg.updated_at).getTime()>new Date(msg.created_at).getTime()+1000;
  const messageEl=document.createElement('div');
  messageEl.className='message';
  messageEl.setAttribute('data-message-id',msg.id);

  const avatarDiv=document.createElement('div');
  avatarDiv.className='message-avatar';avatarDiv.innerHTML=iconHtml;
  messageEl.appendChild(avatarDiv);

  const contentDiv=document.createElement('div');
  contentDiv.className='message-content';

  const headerDiv=document.createElement('div');
  headerDiv.className='message-header';
  headerDiv.innerHTML=`
    <span class="message-author">${senderData.display_name}</span>
    <span class="message-time">${formatMessageTime(msg.created_at)}</span>
  `;
  contentDiv.appendChild(headerDiv);

  if(msg.reply_to_text){
    const replyDiv=document.createElement('div');
    replyDiv.className='message-reply';
    replyDiv.textContent='返信: '+(msg.reply_to_text.substring(0,100))+(msg.reply_to_text.length>100?'...':'');
    contentDiv.appendChild(replyDiv);
  }
  if(msg.text){
    const textDiv=document.createElement('div');
    textDiv.className='message-text';textDiv.innerHTML=formatMessageText(msg.text);
    contentDiv.appendChild(textDiv);
  }
  if(msg.image_url){
    const img=document.createElement('img');
    img.className='message-image';img.src=msg.image_url;img.alt='画像';
    img.onclick=()=>window.openImageModal(msg.image_url);
    contentDiv.appendChild(img);
  }
  if(isEdited){
    const editedDiv=document.createElement('div');
    editedDiv.className='message-edited';editedDiv.textContent='(編集済み)';
    contentDiv.appendChild(editedDiv);
  }
  messageEl.appendChild(contentDiv);

  const actionsDiv=document.createElement('div');
  actionsDiv.className='message-actions';

  const replyBtn=document.createElement('button');
  replyBtn.className='message-action-btn';replyBtn.title='返信';
  replyBtn.innerHTML='<span class="material-symbols-outlined">reply</span>';
  replyBtn.onclick=()=>window.replyMessage(msg.id,msg.text||'',msg.sender_id);
  actionsDiv.appendChild(replyBtn);

  const copyBtn=document.createElement('button');
  copyBtn.className='message-action-btn';copyBtn.title='コピー';
  copyBtn.innerHTML='<span class="material-symbols-outlined">content_copy</span>';
  copyBtn.onclick=()=>copyMessageText(msg.text||'');
  actionsDiv.appendChild(copyBtn);

  if(isCurrentUser){
    const editBtn=document.createElement('button');
    editBtn.className='message-action-btn';editBtn.title='編集';
    editBtn.innerHTML='<span class="material-symbols-outlined">edit</span>';
    editBtn.onclick=()=>window.editMessage(msg.id,msg.text||'',false);
    actionsDiv.appendChild(editBtn);

    const deleteBtn=document.createElement('button');
    deleteBtn.className='message-action-btn delete';deleteBtn.title='削除';
    deleteBtn.innerHTML='<span class="material-symbols-outlined">delete</span>';
    deleteBtn.onclick=()=>window.deleteMessage(msg.id,false);
    actionsDiv.appendChild(deleteBtn);
  }
  messageEl.appendChild(actionsDiv);
  return messageEl;
}

// ========================================
// メッセージ表示（チャンネル）
// ========================================

async function displaySingleChannelMessage(msg,shouldScroll=true){
  const chatMessages=document.getElementById('chat-messages');
  if(!chatMessages)return;

  const isCurrentUser=msg.sender_id===state.currentProfile.id;

  if(shouldScroll){
    const dk=getDateKey(msg.created_at);
    const lastDateEl=chatMessages.querySelector('.date-separator:last-of-type');
    const lastDateKey=lastDateEl?lastDateEl.getAttribute('data-date-key'):null;
    if(dk!==lastDateKey)chatMessages.appendChild(createDateSeparator(msg.created_at));
  }

  const el=await buildChannelMessageElement(msg);
  if(!el)return;

  const wasAtBottom=isAtBottom(chatMessages);
  chatMessages.appendChild(el);

  if(shouldScroll&&(isCurrentUser||wasAtBottom))scrollToBottom(chatMessages,false);
  updateScrollDownBtn(chatMessages);
}

// ========================================
// DOM更新
// ========================================

function updateMessageInDOM(messageId,newData,otherUserId){
  const messageEl=document.querySelector(`[data-message-id="${messageId}"]`);
  if(!messageEl)return;

  const textEl=messageEl.querySelector('.message-text');
  if(textEl&&newData.text)textEl.innerHTML=formatMessageText(newData.text);

  const isEdited=newData.updated_at&&new Date(newData.updated_at).getTime()>new Date(newData.created_at).getTime()+1000;
  const existingEdited=messageEl.querySelector('.message-edited');
  if(isEdited&&!existingEdited){
    const editedEl=document.createElement('div');
    editedEl.className='message-edited';editedEl.textContent='(編集済み)';
    messageEl.querySelector('.message-content').appendChild(editedEl);
  }else if(!isEdited&&existingEdited){existingEdited.remove();}

  if(otherUserId)updateReadStatus(messageEl,newData,otherUserId);
}

async function updateReadStatus(messageEl,msgData,otherUserId){
  const isCurrentUser=msgData.sender_id===state.currentProfile.id;
  if(!isCurrentUser)return;

  const{data:readStatus}=await supabase
    .from('read_status').select('last_read_at')
    .eq('user_id',otherUserId).eq('target_id',state.currentProfile.user_id).single();

  const isRead=readStatus&&new Date(readStatus.last_read_at)>=new Date(msgData.created_at);
  const headerDiv=messageEl.querySelector('.message-header');
  const existingReadBadge=headerDiv.querySelector('.message-read');

  if(isRead&&!existingReadBadge){
    const readSpan=document.createElement('span');
    readSpan.className='message-read';readSpan.textContent='既読';
    headerDiv.appendChild(readSpan);
  }else if(!isRead&&existingReadBadge){existingReadBadge.remove();}
}

function removeMessageFromDOM(messageId){
  const el=document.querySelector(`[data-message-id="${messageId}"]`);
  if(el)el.remove();
}

// ========================================
// メッセージ送信（Cloudinary対応）
// ========================================

export async function sendMessage(){
  if(state.isSending)return;

  const chatInput=document.getElementById('chat-input');
  const sendBtn=document.getElementById('send-btn');
  const text=chatInput.value.trim();

  if(!text&&!state.selectedImage)return;
  if(!state.selectedUserId&&!state.selectedChannelId)return;

  updateState('isSending',true);
  chatInput.disabled=true;sendBtn.disabled=true;sendBtn.classList.add('sending');

  const messageText=text;
  const messageImage=state.selectedImage;
  const messageReply=state.replyToMessage;

  chatInput.value='';chatInput.style.height='auto';
  resetMessageState();

  const imagePreviewContainer=document.getElementById('image-preview-container');
  const replyPreview=document.getElementById('reply-preview');
  if(imagePreviewContainer)imagePreviewContainer.classList.remove('show');
  if(replyPreview)replyPreview.classList.remove('show');

  try{
    let imageUrl=null;
    if(messageImage)imageUrl=await uploadBase64ToCloudinary(messageImage,'chat');

    const now=new Date().toISOString();
    const messageData={
      sender_id:state.currentProfile.id,text:messageText,
      image_url:imageUrl,created_at:now,updated_at:now
    };

    if(messageReply){
      messageData.reply_to_id=messageReply.id;
      messageData.reply_to_text=messageReply.text;
      messageData.reply_to_sender_id=messageReply.senderId;
    }

    if(state.selectedUserId){
      const dmId=getDmId(state.currentProfile.user_id,state.selectedUserId);
      messageData.dm_id=dmId;
      const{error}=await supabase.from('dm_messages').insert(messageData);
      if(error)throw error;
    }else if(state.selectedChannelId){
      messageData.channel_id=state.selectedChannelId;
      const{error}=await supabase.from('channel_messages').insert(messageData);
      if(error)throw error;
    }
  }catch(error){
    console.error('送信エラー:',error);
    alert('送信に失敗しました');
    chatInput.value=messageText;
  }finally{
    updateState('isSending',false);
    chatInput.disabled=false;sendBtn.disabled=false;sendBtn.classList.remove('sending');
    chatInput.focus();
  }
}