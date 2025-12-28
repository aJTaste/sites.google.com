import{initPage,supabase,getCurrentProfile}from'../common/core.js';
import{canAccessChannel}from'../common/permissions.js';

// ========================================
// 状態管理
// ========================================

const CHANNELS=[
  {id:'general',name:'連絡',desc:'報連相大事',icon:'campaign',requiredRole:'user'},
  {id:'random',name:'共用チャット',desc:'全員見れます',icon:'chat_bubble',requiredRole:'user'},
  {id:'tech',name:'to管理人',desc:'欲しいツールとかなんでも',icon:'code',requiredRole:'user'},
  {id:'moderators',name:'教育委員会対策課',desc:'モデレーターのみ',icon:'shield',requiredRole:'moderator'}
];

let currentProfile=null;
let allUsers=[];
let selectedUser=null;
let selectedChannel=null;
let selectedImage=null;
let replyToMessage=null;
let isSending=false;
let unreadCounts={};
let typingUsers=new Set();
let typingTimeout=null;

// Supabaseサブスクリプション
let messagesSubscription=null;
let typingSubscription=null;

// ========================================
// ページ初期化
// ========================================

await initPage('chat','チャット',{
  onUserLoaded:async(profile)=>{
    currentProfile=profile;
    
    // オンライン状態を更新
    await supabase
      .from('profiles')
      .update({is_online:true,last_online:new Date().toISOString()})
      .eq('id',profile.id);
    
    // 全ユーザー読み込み
    await loadUsers();
    
    // 未読数計算
    await calculateUnreadCounts();
    
    // ユーザー一覧表示
    displayUserList();
    
    // リアルタイム購読開始
    subscribeToProfiles();
  }
});

// ========================================
// ユーザー読み込み
// ========================================

async function loadUsers(){
  const{data,error}=await supabase
    .from('profiles')
    .select('*')
    .neq('id',currentProfile.id)
    .order('last_online',{ascending:false});
  
  if(error){
    console.error('ユーザー読み込みエラー:',error);
    return;
  }
  
  allUsers=data||[];
}

// プロフィールのリアルタイム購読
function subscribeToProfiles(){
  supabase
    .channel('profiles-changes')
    .on('postgres_changes',{event:'*',schema:'public',table:'profiles'},(payload)=>{
      if(payload.eventType==='UPDATE'){
        const index=allUsers.findIndex(u=>u.id===payload.new.id);
        if(index!==-1){
          allUsers[index]=payload.new;
        }
        displayUserList();
        
        // 選択中のユーザーなら更新
        if(selectedUser&&selectedUser.id===payload.new.id){
          updateChatHeader(payload.new);
        }
      }
    })
    .subscribe();
}

// ========================================
// 未読数計算
// ========================================

async function calculateUnreadCounts(){
  // 自分の既読状態取得
  const{data:readData}=await supabase
    .from('read_status')
    .select('*')
    .eq('user_id',currentProfile.id);
  
  const readMap={};
  if(readData){
    readData.forEach(r=>{
      readMap[r.target_id]=new Date(r.last_read_at).getTime();
    });
  }
  
  unreadCounts={};
  
  // DM未読数
  for(const user of allUsers){
    const dmId=getDmId(currentProfile.id,user.id);
    const{data:messages}=await supabase
      .from('dm_messages')
      .select('id,sender_id,created_at')
      .eq('dm_id',dmId)
      .order('created_at',{ascending:false})
      .limit(50);
    
    if(messages){
      const lastRead=readMap[user.id]||0;
      const unread=messages.filter(m=>
        m.sender_id===user.id&&new Date(m.created_at).getTime()>lastRead
      ).length;
      unreadCounts[user.id]=unread;
    }
  }
  
  // チャンネル未読数
  for(const channel of CHANNELS){
    if(!canAccessChannel(currentProfile.role,channel.requiredRole))continue;
    
    const{data:messages}=await supabase
      .from('channel_messages')
      .select('id,sender_id,created_at')
      .eq('channel_id',channel.id)
      .order('created_at',{ascending:false})
      .limit(50);
    
    if(messages){
      const lastRead=readMap[channel.id]||0;
      const unread=messages.filter(m=>
        m.sender_id!==currentProfile.id&&new Date(m.created_at).getTime()>lastRead
      ).length;
      unreadCounts[channel.id]=unread;
    }
  }
}

// ========================================
// ユーザー一覧表示
// ========================================

function displayUserList(){
  const dmList=document.getElementById('dm-list');
  if(!dmList)return;
  
  dmList.innerHTML='';
  
  // チャンネル表示
  CHANNELS.forEach(channel=>{
    if(!canAccessChannel(currentProfile.role,channel.requiredRole))return;
    
    const isActive=selectedChannel&&selectedChannel.id===channel.id;
    const unread=unreadCounts[channel.id]||0;
    const unreadBadge=unread>0?`<span class="unread-badge">${unread}</span>`:'';
    
    const item=document.createElement('div');
    item.className='channel-item'+(isActive?' active':'');
    if(channel.requiredRole==='moderator'){
      item.classList.add('moderator-only');
    }
    
    item.innerHTML=`
      <div class="channel-icon">
        <span class="material-symbols-outlined">${channel.icon}</span>
      </div>
      <div class="channel-info">
        <div class="channel-name">${channel.name}${unreadBadge}</div>
        <div class="channel-desc">${channel.desc}</div>
      </div>
    `;
    
    item.addEventListener('click',()=>selectChannel(channel));
    dmList.appendChild(item);
  });
  
  // 区切り線
  const divider=document.createElement('div');
  divider.style.cssText='height:1px;background:var(--border);margin:8px 0;';
  dmList.appendChild(divider);
  
  // ユーザー表示
  allUsers.forEach(user=>{
    const isActive=selectedUser&&selectedUser.id===user.id;
    const unread=unreadCounts[user.id]||0;
    const unreadBadge=unread>0?`<span class="unread-badge">${unread}</span>`:'';
    const onlineIndicator=user.is_online?'<div class="online-indicator"></div>':'';
    const statusText=user.is_online?'オンライン':`最終: ${formatLastOnline(user.last_online)}`;
    
    const iconHtml=user.avatar_url
      ?`<img src="${user.avatar_url}" alt="${user.display_name}">`
      :`<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:${user.avatar_color};color:#fff;font-weight:600;font-size:14px;">${user.display_name.charAt(0).toUpperCase()}</div>`;
    
    const item=document.createElement('div');
    item.className='dm-item'+(isActive?' active':'');
    item.innerHTML=`
      <div class="dm-item-avatar">
        ${iconHtml}
        ${onlineIndicator}
      </div>
      <div class="dm-item-info">
        <div class="dm-item-name">${user.display_name}${unreadBadge}</div>
        <div class="dm-item-status">${statusText}</div>
      </div>
    `;
    
    item.addEventListener('click',()=>selectUser(user));
    dmList.appendChild(item);
  });
}

// ========================================
// チャンネル選択
// ========================================

async function selectChannel(channel){
  selectedChannel=channel;
  selectedUser=null;
  
  // 未読をクリア
  await supabase
    .from('read_status')
    .upsert({
      user_id:currentProfile.id,
      target_id:channel.id,
      last_read_at:new Date().toISOString()
    },{onConflict:'user_id,target_id'});
  
  unreadCounts[channel.id]=0;
  displayUserList();
  
  // UI更新
  const chatMain=document.getElementById('chat-main');
  chatMain.innerHTML=createChannelChatHTML(channel);
  setupChatInput();
  
  // メッセージ読み込み
  await loadChannelMessages(channel.id);
  
  // 入力中購読開始
  subscribeToTyping(channel.id);
}

// ========================================
// ユーザー選択
// ========================================

async function selectUser(user){
  selectedUser=user;
  selectedChannel=null;
  
  // 未読をクリア
  await supabase
    .from('read_status')
    .upsert({
      user_id:currentProfile.id,
      target_id:user.id,
      last_read_at:new Date().toISOString()
    },{onConflict:'user_id,target_id'});
  
  unreadCounts[user.id]=0;
  displayUserList();
  
  // UI更新
  const chatMain=document.getElementById('chat-main');
  chatMain.innerHTML=createUserChatHTML(user);
  setupChatInput();
  
  // メッセージ読み込み
  await loadDmMessages(user.id);
  
  // 入力中購読開始
  const dmId=getDmId(currentProfile.id,user.id);
  subscribeToTyping(dmId);
}

// ========================================
// チャット画面HTML生成
// ========================================

function createChannelChatHTML(channel){
  return`
    <div class="chat-header">
      <div class="chat-header-user">
        <div class="channel-icon" style="width:36px;height:36px;">
          <span class="material-symbols-outlined">${channel.icon}</span>
        </div>
        <div class="chat-header-info">
          <div class="chat-header-name">${channel.name}</div>
          <div class="chat-header-status" id="chat-status">${channel.desc}</div>
        </div>
      </div>
    </div>
    <div class="chat-messages" id="chat-messages"></div>
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
        <textarea class="chat-input" id="chat-input" placeholder="${channel.name}にメッセージを送信" rows="1"></textarea>
        <button class="send-btn" id="send-btn">
          <span class="material-symbols-outlined">send</span>
        </button>
      </div>
    </div>
  `;
}

function createUserChatHTML(user){
  const statusText=user.is_online?'オンライン':`最終: ${formatLastOnline(user.last_online)}`;
  
  const iconHtml=user.avatar_url
    ?`<img src="${user.avatar_url}" alt="${user.display_name}">`
    :`<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:${user.avatar_color};color:#fff;font-weight:600;font-size:16px;">${user.display_name.charAt(0).toUpperCase()}</div>`;
  
  return`
    <div class="chat-header">
      <div class="chat-header-user">
        <div class="chat-header-avatar">
          ${iconHtml}
        </div>
        <div class="chat-header-info">
          <div class="chat-header-name">${user.display_name}</div>
          <div class="chat-header-status" id="chat-status">${statusText}</div>
        </div>
      </div>
    </div>
    <div class="chat-messages" id="chat-messages"></div>
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
        <textarea class="chat-input" id="chat-input" placeholder="${user.display_name}にメッセージを送信" rows="1"></textarea>
        <button class="send-btn" id="send-btn">
          <span class="material-symbols-outlined">send</span>
        </button>
      </div>
    </div>
  `;
}

// チャットヘッダー更新
function updateChatHeader(user){
  const statusEl=document.getElementById('chat-status');
  if(!statusEl)return;
  
  const statusText=user.is_online?'オンライン':`最終: ${formatLastOnline(user.last_online)}`;
  statusEl.textContent=statusText;
}

// ========================================
// メッセージ読み込み
// ========================================

async function loadChannelMessages(channelId){
  // 既存の購読を解除
  if(messagesSubscription){
    await supabase.removeChannel(messagesSubscription);
  }
  
  // メッセージ取得
  const{data:messages,error}=await supabase
    .from('channel_messages')
    .select('*')
    .eq('channel_id',channelId)
    .order('created_at',{ascending:true});
  
  if(error){
    console.error('メッセージ読み込みエラー:',error);
    return;
  }
  
  const chatMessages=document.getElementById('chat-messages');
  chatMessages.innerHTML='';
  
  messages.forEach(msg=>displayMessage(msg,false));
  scrollToBottom();
  
  // リアルタイム購読
  messagesSubscription=supabase
    .channel(`channel:${channelId}`)
    .on('postgres_changes',{
      event:'INSERT',
      schema:'public',
      table:'channel_messages',
      filter:`channel_id=eq.${channelId}`
    },(payload)=>{
      displayMessage(payload.new,false);
      scrollToBottom();
      
      // 通知
      if(payload.new.sender_id!==currentProfile.id){
        showNotification(payload.new);
      }
    })
    .on('postgres_changes',{
      event:'UPDATE',
      schema:'public',
      table:'channel_messages',
      filter:`channel_id=eq.${channelId}`
    },(payload)=>{
      updateMessageInDOM(payload.new);
    })
    .on('postgres_changes',{
      event:'DELETE',
      schema:'public',
      table:'channel_messages',
      filter:`channel_id=eq.${channelId}`
    },(payload)=>{
      removeMessageFromDOM(payload.old.id);
    })
    .subscribe();
}

async function loadDmMessages(userId){
  // 既存の購読を解除
  if(messagesSubscription){
    await supabase.removeChannel(messagesSubscription);
  }
  
  const dmId=getDmId(currentProfile.id,userId);
  
  // メッセージ取得
  const{data:messages,error}=await supabase
    .from('dm_messages')
    .select('*')
    .eq('dm_id',dmId)
    .order('created_at',{ascending:true});
  
  if(error){
    console.error('メッセージ読み込みエラー:',error);
    return;
  }
  
  const chatMessages=document.getElementById('chat-messages');
  chatMessages.innerHTML='';
  
  messages.forEach(msg=>displayMessage(msg,true));
  scrollToBottom();
  
  // リアルタイム購読
  messagesSubscription=supabase
    .channel(`dm:${dmId}`)
    .on('postgres_changes',{
      event:'INSERT',
      schema:'public',
      table:'dm_messages',
      filter:`dm_id=eq.${dmId}`
    },(payload)=>{
      displayMessage(payload.new,true);
      scrollToBottom();
      
      // 通知
      if(payload.new.sender_id!==currentProfile.id){
        showNotification(payload.new);
      }
    })
    .on('postgres_changes',{
      event:'UPDATE',
      schema:'public',
      table:'dm_messages',
      filter:`dm_id=eq.${dmId}`
    },(payload)=>{
      updateMessageInDOM(payload.new);
    })
    .on('postgres_changes',{
      event:'DELETE',
      schema:'public',
      table:'dm_messages',
      filter:`dm_id=eq.${dmId}`
    },(payload)=>{
      removeMessageFromDOM(payload.old.id);
    })
    .subscribe();
}

// ========================================
// メッセージ表示
// ========================================

function displayMessage(msg,isDM){
  const chatMessages=document.getElementById('chat-messages');
  if(!chatMessages)return;
  
  const sender=msg.sender_id===currentProfile.id?currentProfile:allUsers.find(u=>u.id===msg.sender_id);
  if(!sender)return;
  
  const isOwn=msg.sender_id===currentProfile.id;
  
  const iconHtml=sender.avatar_url
    ?`<img src="${sender.avatar_url}" alt="${sender.display_name}">`
    :`<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:${sender.avatar_color};color:#fff;font-weight:600;font-size:16px;">${sender.display_name.charAt(0).toUpperCase()}</div>`;
  
  let actionsHtml='<div class="message-actions">';
  actionsHtml+=`<button class="message-action-btn" onclick="replyToMsg('${msg.id}','${escapeHtml(msg.text||'')}','${msg.sender_id}')" title="返信"><span class="material-symbols-outlined">reply</span></button>`;
  if(isOwn){
    actionsHtml+=`<button class="message-action-btn" onclick="editMsg('${msg.id}','${escapeHtml(msg.text||'')}')" title="編集"><span class="material-symbols-outlined">edit</span></button>`;
    actionsHtml+=`<button class="message-action-btn delete" onclick="deleteMsg('${msg.id}',${isDM})" title="削除"><span class="material-symbols-outlined">delete</span></button>`;
  }
  actionsHtml+='</div>';
  
  const messageEl=document.createElement('div');
  messageEl.className='message';
  messageEl.dataset.messageId=msg.id;
  messageEl.innerHTML=`
    <div class="message-avatar">${iconHtml}</div>
    <div class="message-content">
      <div class="message-header">
        <span class="message-author">${sender.display_name}</span>
        <span class="message-time">${formatMessageTime(msg.created_at)}</span>
      </div>
      ${msg.reply_to?`<div class="message-reply">返信: ${escapeHtml(msg.reply_to.text||'').substring(0,100)}...</div>`:''}
      <div class="message-text">${escapeHtml(msg.text||'')}</div>
      ${msg.image_url?`<img class="message-image" src="${msg.image_url}" alt="画像" onclick="openImageModal('${msg.image_url}')">`:''}
      ${msg.edited_at?`<div class="message-edited">(編集済み)</div>`:''}
    </div>
    ${actionsHtml}
  `;
  
  chatMessages.appendChild(messageEl);
}

// DOM内のメッセージを更新
function updateMessageInDOM(msg){
  const messageEl=document.querySelector(`[data-message-id="${msg.id}"]`);
  if(!messageEl)return;
  
  const textEl=messageEl.querySelector('.message-text');
  if(textEl)textEl.innerHTML=escapeHtml(msg.text||'');
  
  let editedEl=messageEl.querySelector('.message-edited');
  if(msg.edited_at&&!editedEl){
    const contentEl=messageEl.querySelector('.message-content');
    editedEl=document.createElement('div');
    editedEl.className='message-edited';
    editedEl.textContent='(編集済み)';
    contentEl.appendChild(editedEl);
  }
}

// DOM内のメッセージを削除
function removeMessageFromDOM(msgId){
  const messageEl=document.querySelector(`[data-message-id="${msgId}"]`);
  if(messageEl)messageEl.remove();
}

// ========================================
// 入力中表示
// ========================================

function subscribeToTyping(targetId){
  if(typingSubscription){
    supabase.removeChannel(typingSubscription);
  }
  
  typingUsers.clear();
  
  typingSubscription=supabase
    .channel(`typing:${targetId}`)
    .on('postgres_changes',{
      event:'*',
      schema:'public',
      table:'typing_status',
      filter:`target_id=eq.${targetId}`
    },(payload)=>{
      if(payload.eventType==='DELETE'||!payload.new.is_typing){
        typingUsers.delete(payload.old?.user_id||payload.new.user_id);
      }else if(payload.new.is_typing&&payload.new.user_id!==currentProfile.id){
        typingUsers.add(payload.new.user_id);
      }
      updateTypingIndicator();
    })
    .subscribe();
}

function updateTypingIndicator(){
  const statusEl=document.getElementById('chat-status');
  if(!statusEl)return;
  
  if(typingUsers.size>0){
    const names=Array.from(typingUsers).map(userId=>{
      const user=allUsers.find(u=>u.id===userId);
      return user?user.display_name:'誰か';
    }).join(', ');
    statusEl.textContent=`${names}が入力中...`;
  }else if(selectedUser){
    const statusText=selectedUser.is_online?'オンライン':`最終: ${formatLastOnline(selectedUser.last_online)}`;
    statusEl.textContent=statusText;
  }else if(selectedChannel){
    statusEl.textContent=selectedChannel.desc;
  }
}

// 入力中状態を送信
async function sendTypingStatus(isTyping){
  const targetId=selectedChannel?selectedChannel.id:(selectedUser?getDmId(currentProfile.id,selectedUser.id):null);
  if(!targetId)return;
  
  if(isTyping){
    await supabase
      .from('typing_status')
      .upsert({
        user_id:currentProfile.id,
        target_id:targetId,
        is_typing:true,
        updated_at:new Date().toISOString()
      },{onConflict:'user_id,target_id'});
  }else{
    await supabase
      .from('typing_status')
      .delete()
      .eq('user_id',currentProfile.id)
      .eq('target_id',targetId);
  }
}

// ========================================
// メッセージ送信
// ========================================

async function sendMessage(){
  if(isSending)return;
  
  const chatInput=document.getElementById('chat-input');
  const text=chatInput.value.trim();
  
  if(!text&&!selectedImage)return;
  if(!selectedUser&&!selectedChannel)return;
  
  isSending=true;
  chatInput.disabled=true;
  document.getElementById('send-btn').disabled=true;
  
  // 入力中を解除
  await sendTypingStatus(false);
  
  try{
    let imageUrl=null;
    
    // 画像アップロード
    if(selectedImage){
      const fileName=`${Date.now()}_${currentProfile.id}.png`;
      const blob=await fetch(selectedImage).then(r=>r.blob());
      
      const{error:uploadError}=await supabase.storage
        .from('chat-images')
        .upload(fileName,blob);
      
      if(uploadError)throw uploadError;
      
      const{data:urlData}=supabase.storage
        .from('chat-images')
        .getPublicUrl(fileName);
      
      imageUrl=urlData.publicUrl;
    }
    
    const messageData={
      sender_id:currentProfile.id,
      text:text,
      image_url:imageUrl,
      reply_to:replyToMessage,
      created_at:new Date().toISOString()
    };
    
    if(selectedChannel){
      messageData.channel_id=selectedChannel.id;
      await supabase.from('channel_messages').insert(messageData);
    }else{
      messageData.dm_id=getDmId(currentProfile.id,selectedUser.id);
      await supabase.from('dm_messages').insert(messageData);
    }
    
    chatInput.value='';
    chatInput.style.height='auto';
    selectedImage=null;
    replyToMessage=null;
    document.getElementById('image-preview-container').classList.remove('show');
    document.getElementById('reply-preview').classList.remove('show');
    
  }catch(error){
    console.error('送信エラー:',error);
    alert('送信に失敗しました');
  }finally{
    isSending=false;
    chatInput.disabled=false;
    document.getElementById('send-btn').disabled=false;
    chatInput.focus();
  }
}

// ========================================
// チャット入力設定
// ========================================

function setupChatInput(){
  const chatInput=document.getElementById('chat-input');
  const sendBtn=document.getElementById('send-btn');
  const attachBtn=document.getElementById('attach-image-btn');
  const imageInput=document.getElementById('image-file-input');
  
  // 入力イベント
  chatInput.addEventListener('input',()=>{
    chatInput.style.height='auto';
    chatInput.style.height=Math.min(chatInput.scrollHeight,120)+'px';
    
    // 入力中状態を送信
    if(typingTimeout)clearTimeout(typingTimeout);
    sendTypingStatus(true);
    typingTimeout=setTimeout(()=>sendTypingStatus(false),3000);
  });
  
  chatInput.addEventListener('keydown',(e)=>{
    if(e.key==='Enter'&&!e.shiftKey){
      e.preventDefault();
      sendMessage();
    }
  });
  
  // クリップボード画像貼り付け
  chatInput.addEventListener('paste',(e)=>{
    const items=e.clipboardData.items;
    for(let i=0;i<items.length;i++){
      if(items[i].type.indexOf('image')!==-1){
        const file=items[i].getAsFile();
        handleImageFile(file);
        e.preventDefault();
        break;
      }
    }
  });
  
  sendBtn.addEventListener('click',sendMessage);
  
  // 画像添付
  attachBtn.addEventListener('click',()=>imageInput.click());
  imageInput.addEventListener('change',(e)=>{
    const file=e.target.files[0];
    if(file)handleImageFile(file);
  });
  
  // プレビュー削除
  document.getElementById('image-preview-close').addEventListener('click',()=>{
    selectedImage=null;
    document.getElementById('image-preview-container').classList.remove('show');
  });
  
  document.getElementById('reply-preview-close').addEventListener('click',()=>{
    replyToMessage=null;
    document.getElementById('reply-preview').classList.remove('show');
  });
}

function handleImageFile(file){
  if(!file.type.startsWith('image/')){
    alert('画像ファイルを選択してください');
    return;
  }
  
  if(file.size>2*1024*1024){
    alert('画像サイズは2MB以下にしてください');
    return;
  }
  
  const reader=new FileReader();
  reader.onload=(e)=>{
    selectedImage=e.target.result;
    document.getElementById('image-preview').src=selectedImage;
    document.getElementById('image-preview-container').classList.add('show');
  };
  reader.readAsDataURL(file);
}

// ========================================
// メッセージ操作（グローバル関数）
// ========================================

window.replyToMsg=function(msgId,text,senderId){
  replyToMessage={id:msgId,text:text,senderId:senderId};
  document.getElementById('reply-preview-text').textContent=text.substring(0,100);
  document.getElementById('reply-preview').classList.add('show');
  document.getElementById('chat-input').focus();
}

window.editMsg=async function(msgId,text){
  const newText=prompt('メッセージを編集:',text);
  if(!newText||newText===text)return;
  
  try{
    const table=selectedChannel?'channel_messages':'dm_messages';
    await supabase
      .from(table)
      .update({text:newText,edited_at:new Date().toISOString()})
      .eq('id',msgId);
  }catch(error){
    console.error('編集エラー:',error);
    alert('編集に失敗しました');
  }
}

window.deleteMsg=async function(msgId,isDM){
  if(!confirm('このメッセージを削除しますか？'))return;
  
  try{
    const table=isDM?'dm_messages':'channel_messages';
    await supabase.from(table).delete().eq('id',msgId);
  }catch(error){
    console.error('削除エラー:',error);
    alert('削除に失敗しました');
  }
}

window.openImageModal=function(imageUrl){
  document.getElementById('image-modal-img').src=imageUrl;
  document.getElementById('image-modal').classList.add('show');
}

document.getElementById('image-modal-close').addEventListener('click',()=>{
  document.getElementById('image-modal').classList.remove('show');
});

document.getElementById('image-modal').addEventListener('click',(e)=>{
  if(e.target.id==='image-modal'){
    document.getElementById('image-modal').classList.remove('show');
  }
});

// ========================================
// ユーティリティ関数
// ========================================

function getDmId(uid1,uid2){
  return[uid1,uid2].sort().join('_');
}

function formatMessageTime(timestamp){
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

function formatLastOnline(timestamp){
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

function escapeHtml(text){
  const div=document.createElement('div');
  div.textContent=text;
  let escaped=div.innerHTML;
  
  // URLをリンク化
  const urlRegex=/(https?:\/\/[^\s]+)/g;
  escaped=escaped.replace(urlRegex,'<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  
  return escaped;
}

function scrollToBottom(){
  const chatMessages=document.getElementById('chat-messages');
  if(chatMessages){
    setTimeout(()=>{
      chatMessages.scrollTop=chatMessages.scrollHeight;
    },10);
  }
}

function showNotification(msg){
  if('Notification'in window&&Notification.permission==='granted'&&document.hidden){
    const sender=allUsers.find(u=>u.id===msg.sender_id)||currentProfile;
    new Notification(sender.display_name,{
      body:msg.text||'画像を送信しました',
      icon:sender.avatar_url||'assets/favicon1.svg',
      tag:'chat-message'
    });
  }
}

// 通知権限リクエスト
if('Notification'in window&&Notification.permission==='default'){
  Notification.requestPermission();
}
