// メッセージ表示・送信関連（Supabase版）

import{supabase}from'../common/supabase-config.js';
import{state,updateState,resetMessageState}from'./chat-state.js';
import{getDmId,formatMessageTime,escapeHtml,showNotification}from'./chat-utils.js';

// メッセージを読み込み（DM）
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
        
        // 新着メッセージ通知
        if(payload.new.sender_id!==state.currentProfile.id){
          const sender=state.allUsers.find(u=>u.id===payload.new.sender_id);
          if(sender){
            showNotification(
              `${sender.display_name}からのメッセージ`,
              payload.new.text||'画像を送信しました',
              sender.avatar_url||null
            );
          }
        }
      }else if(payload.eventType==='UPDATE'){
        updateMessageInDOM(payload.new.id,payload.new);
      }else if(payload.eventType==='DELETE'){
        removeMessageFromDOM(payload.old.id);
      }
    })
    .subscribe();
  
  updateState('messageSubscription',subscription);
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
      setTimeout(()=>{
        chatMessages.scrollTop=chatMessages.scrollHeight;
      },10);
      
      // 既読を更新
      await supabase
        .from('read_status')
        .upsert({
          user_id:state.currentProfile.id,
          target_id:userId,
          last_read_at:new Date().toISOString()
        },{onConflict:'user_id,target_id'});
    }
  }catch(error){
    console.error('メッセージ読み込みエラー:',error);
    chatMessages.innerHTML='<div style="text-align:center;color:var(--text-tertiary);padding:40px;">メッセージの読み込みに失敗しました</div>';
  }
}

// メッセージを読み込み（チャンネル）
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
        
        // 新着メッセージ通知
        if(payload.new.sender_id!==state.currentProfile.id){
          const sender=state.allUsers.find(u=>u.id===payload.new.sender_id);
          if(sender){
            showNotification(
              `${channelId}: ${sender.display_name}`,
              payload.new.text||'画像を送信しました',
              sender.avatar_url||null
            );
          }
        }
      }else if(payload.eventType==='UPDATE'){
        updateMessageInDOM(payload.new.id,payload.new);
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
      setTimeout(()=>{
        chatMessages.scrollTop=chatMessages.scrollHeight;
      },10);
      
      // 既読を更新
      await supabase
        .from('read_status')
        .upsert({
          user_id:state.currentProfile.id,
          target_id:channelId,
          last_read_at:new Date().toISOString()
        },{onConflict:'user_id,target_id'});
    }
  }catch(error){
    console.error('メッセージ読み込みエラー:',error);
    chatMessages.innerHTML='<div style="text-align:center;color:var(--text-tertiary);padding:40px;">メッセージの読み込みに失敗しました</div>';
  }
}

// 単一メッセージを表示（DM）
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
  
  // 操作ボタン
  let actionsHtml=`
    <div class="message-actions">
      <button class="message-action-btn" onclick="window.replyMessage('${msg.id}','${escapeHtml(msg.text||'').replace(/'/g,"\\'")}','${msg.sender_id}')" title="返信">
        <span class="material-symbols-outlined">reply</span>
      </button>
  `;
  
  if(isCurrentUser){
    actionsHtml+=`
      <button class="message-action-btn" onclick="window.editMessage('${msg.id}','${escapeHtml(msg.text||'').replace(/'/g,"\\'")}',true)" title="編集">
        <span class="material-symbols-outlined">edit</span>
      </button>
      <button class="message-action-btn delete" onclick="window.deleteMessage('${msg.id}',true)" title="削除">
        <span class="material-symbols-outlined">delete</span>
      </button>
    `;
  }
  
  actionsHtml+=`</div>`;
  
  const messageEl=document.createElement('div');
  messageEl.className='message';
  messageEl.setAttribute('data-message-id',msg.id);
  messageEl.innerHTML=`
    <div class="message-avatar">
      ${iconHtml}
    </div>
    <div class="message-content">
      <div class="message-header">
        <span class="message-author">${senderData.display_name}</span>
        <span class="message-time">${formatMessageTime(msg.created_at)}</span>
      </div>
      ${msg.reply_to_text?`<div class="message-reply">返信: ${escapeHtml(msg.reply_to_text).substring(0,100)}...</div>`:''}
      ${msg.text?`<div class="message-text">${escapeHtml(msg.text)}</div>`:''}
      ${msg.image_url?`<img class="message-image" src="${msg.image_url}" alt="画像" onclick="window.openImageModal('${msg.image_url}')">`:''}
      ${msg.updated_at&&msg.updated_at!==msg.created_at?`<div class="message-edited">(編集済み)</div>`:''}
    </div>
    ${actionsHtml}
  `;
  
  chatMessages.appendChild(messageEl);
  
  if(shouldScroll){
    const wasAtBottom=chatMessages.scrollHeight-chatMessages.scrollTop<=chatMessages.clientHeight+50;
    if(wasAtBottom){
      chatMessages.scrollTop=chatMessages.scrollHeight;
    }
  }
}

// 単一メッセージを表示（チャンネル）
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
  
  // 操作ボタン
  let actionsHtml=`
    <div class="message-actions">
      <button class="message-action-btn" onclick="window.replyMessage('${msg.id}','${escapeHtml(msg.text||'').replace(/'/g,"\\'")}','${msg.sender_id}')" title="返信">
        <span class="material-symbols-outlined">reply</span>
      </button>
  `;
  
  if(isCurrentUser){
    actionsHtml+=`
      <button class="message-action-btn" onclick="window.editMessage('${msg.id}','${escapeHtml(msg.text||'').replace(/'/g,"\\'")}',false)" title="編集">
        <span class="material-symbols-outlined">edit</span>
      </button>
      <button class="message-action-btn delete" onclick="window.deleteMessage('${msg.id}',false)" title="削除">
        <span class="material-symbols-outlined">delete</span>
      </button>
    `;
  }
  
  actionsHtml+=`</div>`;
  
  const messageEl=document.createElement('div');
  messageEl.className='message';
  messageEl.setAttribute('data-message-id',msg.id);
  messageEl.innerHTML=`
    <div class="message-avatar">
      ${iconHtml}
    </div>
    <div class="message-content">
      <div class="message-header">
        <span class="message-author">${senderData.display_name}</span>
        <span class="message-time">${formatMessageTime(msg.created_at)}</span>
      </div>
      ${msg.reply_to_text?`<div class="message-reply">返信: ${escapeHtml(msg.reply_to_text).substring(0,100)}...</div>`:''}
      ${msg.text?`<div class="message-text">${escapeHtml(msg.text)}</div>`:''}
      ${msg.image_url?`<img class="message-image" src="${msg.image_url}" alt="画像" onclick="window.openImageModal('${msg.image_url}')">`:''}
      ${msg.updated_at&&msg.updated_at!==msg.created_at?`<div class="message-edited">(編集済み)</div>`:''}
    </div>
    ${actionsHtml}
  `;
  
  chatMessages.appendChild(messageEl);
  
  const wasAtBottom=chatMessages.scrollHeight-chatMessages.scrollTop<=chatMessages.clientHeight+50;
  if(wasAtBottom){
    chatMessages.scrollTop=chatMessages.scrollHeight;
  }
}

// DOM内のメッセージを更新
function updateMessageInDOM(messageId,newData){
  const messageEl=document.querySelector(`[data-message-id="${messageId}"]`);
  if(!messageEl)return;
  
  const textEl=messageEl.querySelector('.message-text');
  if(textEl&&newData.text){
    textEl.innerHTML=escapeHtml(newData.text);
  }
  
  // 編集済みマークを追加
  if(!messageEl.querySelector('.message-edited')){
    const editedEl=document.createElement('div');
    editedEl.className='message-edited';
    editedEl.textContent='(編集済み)';
    messageEl.querySelector('.message-content').appendChild(editedEl);
  }
}

// DOM内のメッセージを削除
function removeMessageFromDOM(messageId){
  const messageEl=document.querySelector(`[data-message-id="${messageId}"]`);
  if(messageEl){
    messageEl.remove();
  }
}

// メッセージを送信
export async function sendMessage(){
  if(state.isSending)return;
  
  const chatInput=document.getElementById('chat-input');
  const sendBtn=document.getElementById('send-btn');
  const text=chatInput.value.trim();
  
  if(!text&&!state.selectedImage)return;
  if(!state.selectedUserId&&!state.selectedChannelId)return;
  
  // 即座にフラグを立てる
  updateState('isSending',true);
  chatInput.disabled=true;
  sendBtn.disabled=true;
  
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
    
    // 画像をアップロード
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
      
      imageUrl=urlData.publicUrl;
    }
    
    const messageData={
      sender_id:state.currentProfile.id,
      text:messageText,
      image_url:imageUrl,
      created_at:new Date().toISOString()
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
    chatInput.focus();
  }
}