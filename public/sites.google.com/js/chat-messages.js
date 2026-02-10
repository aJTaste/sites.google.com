// メッセージ表示・送信関連（Supabase版）- 修正版

import{supabase}from'../common/supabase-config.js';
import{state,updateState,resetMessageState}from'./chat-state.js';
import{getDmId,formatMessageTime,showNotification}from'./chat-utils.js';
import{displayUsers}from'./chat-ui.js';


// ★ 追加：ステルスモードの状態をチェックする関数
function isStealthModeActive() {
  const saved = localStorage.getItem('stealthModeState');
  if (saved) {
    try {
      return JSON.parse(saved).stealthMode;
    } catch (e) {
      return false;
    }
  }
  return false;
}


// ========================================
// テキスト処理関数
// ========================================

// メッセージテキストをフォーマット（改行とURL対応）
function formatMessageText(text){
  if(!text)return'';
  
  // HTMLエスケープ
  const escaped=text
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
  
  // 改行を<br>に変換
  let formatted=escaped.replace(/\n/g,'<br>');
  
  // URLをリンク化
  const urlRegex=/(https?:\/\/[^\s]+)/g;
  formatted=formatted.replace(urlRegex,'<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  
  return formatted;
}

// テキストをクリップボードにコピー
function copyMessageText(text){
  if(!text){
    alert('コピーするテキストがありません');
    return;
  }
  
  navigator.clipboard.writeText(text).then(()=>{
    // コピー成功のフィードバック
    const notification=document.createElement('div');
    notification.style.cssText='position:fixed;top:80px;right:24px;padding:12px 20px;background:#2da44e;color:#fff;border-radius:6px;font-size:14px;font-weight:600;z-index:9999;animation:slideIn 0.3s ease;';
    notification.textContent='✓ コピーしました';
    document.body.appendChild(notification);
    
    setTimeout(()=>{
      notification.style.animation='slideIn 0.3s ease reverse';
      setTimeout(()=>notification.remove(),300);
    },2000);
  }).catch(err=>{
    console.error('コピー失敗:',err);
    alert('コピーに失敗しました');
  });
}

// ========================================
// メッセージ読み込み（DM）
// ========================================

export function loadMessages(userId){
  // 既存の購読を解除
  if(state.messageSubscription){
    supabase.removeChannel(state.messageSubscription);
  }
  
  const dmId=getDmId(state.currentProfile.user_id,userId);
  
  // 初回読み込み
  loadInitialMessages(dmId,userId);
  
  // リアルタイム購読
  const subscription=supabase
    .channel(`dm:${dmId}`)
    .on('postgres_changes',{
      event:'*',
      schema:'public',
      table:'dm_messages',
      filter:`dm_id=eq.${dmId}`
    },async(payload)=>{
      if(payload.eventType==='INSERT'){
        await displaySingleMessage(payload.new,userId,true);
        
        // 既読を即座に更新（会話を開いている場合のみ）
        if(state.selectedUserId===userId){
          await markAsRead(userId);
        }
        
        // 新着メッセージ通知（★修正：ステルスモード中はスキップ）
        if(payload.new.sender_id!==state.currentProfile.id){
          const sender=state.allUsers.find(u=>u.id===payload.new.sender_id);
          if(sender && !isStealthModeActive()){ 
            showNotification(
              `${sender.display_name}からのメッセージ`,
              payload.new.text||'画像を送信しました',
              sender.avatar_url||null
            );
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

// 既読を更新
async function markAsRead(targetId){
  try{
    await supabase
      .from('read_status')
      .upsert({
        user_id:state.currentProfile.id,
        target_id:targetId,
        last_read_at:new Date().toISOString()
      },{onConflict:'user_id,target_id'});
    
    // 未読数をリセット
    state.unreadCounts[targetId]=0;
    
    // UI更新
    displayUsers();
  }catch(error){
    console.error('既読更新エラー:',error);
  }
}

// 初回メッセージ読み込み（DM）
async function loadInitialMessages(dmId,userId){
  const chatMessages=document.getElementById('chat-messages');
  if(!chatMessages)return;
  
  chatMessages.innerHTML='';
  
  try{
    const{data:messages,error}=await supabase
      .from('dm_messages')
      .select('*')
      .eq('dm_id',dmId)
      .order('created_at',{ascending:true});
    
    if(error)throw error;
    
    if(messages&&messages.length>0){
      for(const msg of messages){
        await displaySingleMessage(msg,userId,false);
      }
      
      // スクロールを最下部に
      scrollToBottom(chatMessages,true);
      
      // 既読を更新
      await markAsRead(userId);
    }
  }catch(error){
    console.error('メッセージ読み込みエラー:',error);
    chatMessages.innerHTML='<div style="text-align:center;color:var(--text-tertiary);padding:40px;">メッセージの読み込みに失敗しました</div>';
  }
}

// ========================================
// メッセージ読み込み（チャンネル）
// ========================================

export function loadChannelMessages(channelId){
  // 既存の購読を解除
  if(state.messageSubscription){
    supabase.removeChannel(state.messageSubscription);
  }
  
  // 初回読み込み
  loadInitialChannelMessages(channelId);
  
  // リアルタイム購読
  const subscription=supabase
    .channel(`channel:${channelId}`)
    .on('postgres_changes',{
      event:'*',
      schema:'public',
      table:'channel_messages',
      filter:`channel_id=eq.${channelId}`
    },async(payload)=>{
      if(payload.eventType==='INSERT'){
        await displaySingleChannelMessage(payload.new);
        
        // 既読を即座に更新（チャンネルを開いている場合のみ）
        if(state.selectedChannelId===channelId){
          await markAsRead(channelId);
        }
        
        // 新着メッセージ通知（★修正：グループチャットでも通知＆ステルスモードチェック追加）
        if(payload.new.sender_id!==state.currentProfile.id){
          const sender=state.allUsers.find(u=>u.id===payload.new.sender_id)||{display_name:'不明'};
          if(!isStealthModeActive()){
            showNotification(
              `${channelId}: ${sender.display_name}`,
              payload.new.text||'画像を送信しました',
              sender.avatar_url||null
            );
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

// 初回メッセージ読み込み（チャンネル）
async function loadInitialChannelMessages(channelId){
  const chatMessages=document.getElementById('chat-messages');
  if(!chatMessages)return;
  
  chatMessages.innerHTML='';
  
  try{
    const{data:messages,error}=await supabase
      .from('channel_messages')
      .select('*')
      .eq('channel_id',channelId)
      .order('created_at',{ascending:true});
    
    if(error)throw error;
    
    if(messages&&messages.length>0){
      for(const msg of messages){
        await displaySingleChannelMessage(msg);
      }
      
      // スクロールを最下部に
      scrollToBottom(chatMessages,true);
      
      // 既読を更新
      await markAsRead(channelId);
    }
  }catch(error){
    console.error('メッセージ読み込みエラー:',error);
    chatMessages.innerHTML='<div style="text-align:center;color:var(--text-tertiary);padding:40px;">メッセージの読み込みに失敗しました</div>';
  }
}

// ========================================
// スクロール制御
// ========================================

function scrollToBottom(element,immediate=false){
  if(immediate){
    element.scrollTop=element.scrollHeight;
  }else{
    element.scrollTo({
      top:element.scrollHeight,
      behavior:'smooth'
    });
  }
}

function isAtBottom(element){
  const threshold=50;
  return element.scrollHeight-element.scrollTop-element.clientHeight<=threshold;
}

// ========================================
// メッセージ表示（DM）
// ========================================

async function displaySingleMessage(msg,otherUserId,shouldScroll){
  const chatMessages=document.getElementById('chat-messages');
  if(!chatMessages)return;
  
  const isCurrentUser=msg.sender_id===state.currentProfile.id;
  
  let senderData;
  if(isCurrentUser){
    senderData=state.currentProfile;
  }else{
    senderData=state.allUsers.find(u=>u.id===msg.sender_id);
  }
  
  if(!senderData)return;
  
  // アイコン表示
  let iconHtml;
  if(senderData.avatar_url){
    iconHtml=`<img src="${senderData.avatar_url}" alt="${senderData.display_name}">`;
  }else{
    const initial=senderData.display_name.charAt(0).toUpperCase();
    const bgColor=senderData.avatar_color||'#FF6B35';
    iconHtml=`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${bgColor};color:#fff;font-weight:600;font-size:16px;border-radius:50%;">${initial}</div>`;
  }
  
  // 既読チェック（DMの場合のみ）
  let isRead=false;
  if(isCurrentUser&&otherUserId){
    const{data:readStatus}=await supabase
      .from('read_status')
      .select('last_read_at')
      .eq('user_id',otherUserId)
      .eq('target_id',state.currentProfile.user_id)
      .single();
    
    isRead=readStatus&&new Date(readStatus.last_read_at)>=new Date(msg.created_at);
  }
  
  // 編集済みチェック
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
    img.className='message-image';
    img.src=msg.image_url;
    img.alt='画像';
    img.onclick=()=>window.openImageModal(msg.image_url);
    contentDiv.appendChild(img);
  }
  
  if(isEdited){
    const editedDiv=document.createElement('div');
    editedDiv.className='message-edited';
    editedDiv.textContent='(編集済み)';
    contentDiv.appendChild(editedDiv);
  }
  
  messageEl.appendChild(contentDiv);
  
  // 操作ボタン
  const actionsDiv=document.createElement('div');
  actionsDiv.className='message-actions';
  
  const replyBtn=document.createElement('button');
  replyBtn.className='message-action-btn';
  replyBtn.title='返信';
  replyBtn.innerHTML='<span class="material-symbols-outlined">reply</span>';
  replyBtn.onclick=()=>window.replyMessage(msg.id,msg.text||'',msg.sender_id);
  actionsDiv.appendChild(replyBtn);
  
  const copyBtn=document.createElement('button');
  copyBtn.className='message-action-btn';
  copyBtn.title='コピー';
  copyBtn.innerHTML='<span class="material-symbols-outlined">content_copy</span>';
  copyBtn.onclick=()=>copyMessageText(msg.text||'');
  actionsDiv.appendChild(copyBtn);
  
  if(isCurrentUser){
    const editBtn=document.createElement('button');
    editBtn.className='message-action-btn';
    editBtn.title='編集';
    editBtn.innerHTML='<span class="material-symbols-outlined">edit</span>';
    editBtn.onclick=()=>window.editMessage(msg.id,msg.text||'',true);
    actionsDiv.appendChild(editBtn);
    
    const deleteBtn=document.createElement('button');
    deleteBtn.className='message-action-btn delete';
    deleteBtn.title='削除';
    deleteBtn.innerHTML='<span class="material-symbols-outlined">delete</span>';
    deleteBtn.onclick=()=>window.deleteMessage(msg.id,true);
    actionsDiv.appendChild(deleteBtn);
  }
  
  messageEl.appendChild(actionsDiv);
  
  const wasAtBottom=isAtBottom(chatMessages);
  chatMessages.appendChild(messageEl);
  
  if(shouldScroll){
    if(isCurrentUser||wasAtBottom){
      scrollToBottom(chatMessages,false);
    }
  }
}

// ========================================
// メッセージ表示（チャンネル）
// ========================================

async function displaySingleChannelMessage(msg){
  const chatMessages=document.getElementById('chat-messages');
  if(!chatMessages)return;
  
  const isCurrentUser=msg.sender_id===state.currentProfile.id;
  
  let senderData;
  if(isCurrentUser){
    senderData=state.currentProfile;
  }else{
    senderData=state.allUsers.find(u=>u.id===msg.sender_id);
  }
  
  if(!senderData)return;
  
  // アイコン表示
  let iconHtml;
  if(senderData.avatar_url){
    iconHtml=`<img src="${senderData.avatar_url}" alt="${senderData.display_name}">`;
  }else{
    const initial=senderData.display_name.charAt(0).toUpperCase();
    const bgColor=senderData.avatar_color||'#FF6B35';
    iconHtml=`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${bgColor};color:#fff;font-weight:600;font-size:16px;border-radius:50%;">${initial}</div>`;
  }
  
  // 編集済みチェック
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
    img.className='message-image';
    img.src=msg.image_url;
    img.alt='画像';
    img.onclick=()=>window.openImageModal(msg.image_url);
    contentDiv.appendChild(img);
  }
  
  if(isEdited){
    const editedDiv=document.createElement('div');
    editedDiv.className='message-edited';
    editedDiv.textContent='(編集済み)';
    contentDiv.appendChild(editedDiv);
  }
  
  messageEl.appendChild(contentDiv);
  
  // 操作ボタン
  const actionsDiv=document.createElement('div');
  actionsDiv.className='message-actions';
  
  const replyBtn=document.createElement('button');
  replyBtn.className='message-action-btn';
  replyBtn.title='返信';
  replyBtn.innerHTML='<span class="material-symbols-outlined">reply</span>';
  replyBtn.onclick=()=>window.replyMessage(msg.id,msg.text||'',msg.sender_id);
  actionsDiv.appendChild(replyBtn);
  
  const copyBtn=document.createElement('button');
  copyBtn.className='message-action-btn';
  copyBtn.title='コピー';
  copyBtn.innerHTML='<span class="material-symbols-outlined">content_copy</span>';
  copyBtn.onclick=()=>copyMessageText(msg.text||'');
  actionsDiv.appendChild(copyBtn);
  
  if(isCurrentUser){
    const editBtn=document.createElement('button');
    editBtn.className='message-action-btn';
    editBtn.title='編集';
    editBtn.innerHTML='<span class="material-symbols-outlined">edit</span>';
    editBtn.onclick=()=>window.editMessage(msg.id,msg.text||'',false);
    actionsDiv.appendChild(editBtn);
    
    const deleteBtn=document.createElement('button');
    deleteBtn.className='message-action-btn delete';
    deleteBtn.title='削除';
    deleteBtn.innerHTML='<span class="material-symbols-outlined">delete</span>';
    deleteBtn.onclick=()=>window.deleteMessage(msg.id,false);
    actionsDiv.appendChild(deleteBtn);
  }
  
  messageEl.appendChild(actionsDiv);
  
  const wasAtBottom=isAtBottom(chatMessages);
  chatMessages.appendChild(messageEl);
  
  if(isCurrentUser||wasAtBottom){
    scrollToBottom(chatMessages,false);
  }
}

// ========================================
// DOM更新
// ========================================

function updateMessageInDOM(messageId,newData,otherUserId){
  const messageEl=document.querySelector(`[data-message-id="${messageId}"]`);
  if(!messageEl)return;
  
  const textEl=messageEl.querySelector('.message-text');
  if(textEl&&newData.text){
    textEl.innerHTML=formatMessageText(newData.text);
  }
  
  // 編集済みチェック
  const isEdited=newData.updated_at&&new Date(newData.updated_at).getTime()>new Date(newData.created_at).getTime()+1000;
  
  const existingEdited=messageEl.querySelector('.message-edited');
  if(isEdited&&!existingEdited){
    const editedEl=document.createElement('div');
    editedEl.className='message-edited';
    editedEl.textContent='(編集済み)';
    messageEl.querySelector('.message-content').appendChild(editedEl);
  }else if(!isEdited&&existingEdited){
    existingEdited.remove();
  }
  
  // 既読状態を更新（DMの場合のみ）
  if(otherUserId){
    updateReadStatus(messageEl,newData,otherUserId);
  }
}

async function updateReadStatus(messageEl,msgData,otherUserId){
  const isCurrentUser=msgData.sender_id===state.currentProfile.id;
  if(!isCurrentUser)return;
  
  const{data:readStatus}=await supabase
    .from('read_status')
    .select('last_read_at')
    .eq('user_id',otherUserId)
    .eq('target_id',state.currentProfile.user_id)
    .single();
  
  const isRead=readStatus&&new Date(readStatus.last_read_at)>=new Date(msgData.created_at);
  
  const headerDiv=messageEl.querySelector('.message-header');
  const existingReadBadge=headerDiv.querySelector('.message-read');
  
  if(isRead&&!existingReadBadge){
    const readSpan=document.createElement('span');
    readSpan.className='message-read';
    readSpan.textContent='既読';
    headerDiv.appendChild(readSpan);
  }else if(!isRead&&existingReadBadge){
    existingReadBadge.remove();
  }
}

function removeMessageFromDOM(messageId){
  const messageEl=document.querySelector(`[data-message-id="${messageId}"]`);
  if(messageEl){
    messageEl.remove();
  }
}

// ========================================
// メッセージ送信
// ========================================

export async function sendMessage(){
  if(state.isSending)return;
  
  const chatInput=document.getElementById('chat-input');
  const sendBtn=document.getElementById('send-btn');
  const text=chatInput.value.trim();
  
  if(!text&&!state.selectedImage)return;
  if(!state.selectedUserId&&!state.selectedChannelId)return;
  
  updateState('isSending',true);
  chatInput.disabled=true;
  sendBtn.disabled=true;
  sendBtn.classList.add('sending');
  
  const messageText=text;
  const messageImage=state.selectedImage;
  const messageReply=state.replyToMessage;
  
  chatInput.value='';
  chatInput.style.height='auto';
  resetMessageState();
  
  const imagePreviewContainer=document.getElementById('image-preview-container');
  const replyPreview=document.getElementById('reply-preview');
  if(imagePreviewContainer)imagePreviewContainer.classList.remove('show');
  if(replyPreview)replyPreview.classList.remove('show');
  
  try{
    let imageUrl=null;
    
    if(messageImage){
      const fileName=`${state.currentProfile.id}_${Date.now()}.png`;
      const base64Data=messageImage.split(',')[1];
      const binaryData=atob(base64Data);
      const bytes=new Uint8Array(binaryData.length);
      for(let i=0;i<binaryData.length;i++){
        bytes[i]=binaryData.charCodeAt(i);
      }
      const blob=new Blob([bytes],{type:'image/png'});
      
      const{error:uploadError}=await supabase.storage
        .from('chat-images')
        .upload(fileName,blob);
      
      if(uploadError)throw uploadError;
      
      const{data:urlData}=supabase.storage
        .from('chat-images')
        .getPublicUrl(fileName);
      
      imageUrl=await uploadBase64ToCloudinary(messageImage,'chat');
    }
    
    const now=new Date().toISOString();
    
    const messageData={
      sender_id:state.currentProfile.id,
      text:messageText,
      image_url:imageUrl,
      created_at:now,
      updated_at:now
    };
    
    if(messageReply){
      messageData.reply_to_id=messageReply.id;
      messageData.reply_to_text=messageReply.text;
      messageData.reply_to_sender_id=messageReply.senderId;
    }
    
    if(state.selectedUserId){
      const dmId=getDmId(state.currentProfile.user_id,state.selectedUserId);
      messageData.dm_id=dmId;
      
      const{error}=await supabase
        .from('dm_messages')
        .insert(messageData);
      
      if(error)throw error;
    }else if(state.selectedChannelId){
      messageData.channel_id=state.selectedChannelId;
      
      const{error}=await supabase
        .from('channel_messages')
        .insert(messageData);
      
      if(error)throw error;
    }
  }catch(error){
    console.error('送信エラー:',error);
    alert('送信に失敗しました');
    chatInput.value=messageText;
  }finally{
    updateState('isSending',false);
    chatInput.disabled=false;
    sendBtn.disabled=false;
    sendBtn.classList.remove('sending');
    chatInput.focus();
  }
}