// メッセージ送受信・表示（Supabase版）

import{supabase}from'../common/core.js';
import{state,updateState,resetMessageState}from'./chat-state.js';
import{formatMessageTime,escapeHtml}from'./chat-ui.js';

// DM IDを生成
function getDmId(uid1,uid2){
  return[uid1,uid2].sort().join('_');
}

// メッセージを読み込み（DM）
export async function loadDMMessages(targetUserId){
  const dmId=getDmId(state.currentProfile.id,targetUserId);
  
  try{
    const{data,error}=await supabase
      .from('dm_messages')
      .select('*')
      .eq('dm_id',dmId)
      .order('created_at',{ascending:true});
    
    if(error)throw error;
    
    const chatMessages=document.getElementById('chat-messages');
    if(!chatMessages)return;
    
    chatMessages.innerHTML='';
    
    if(data&&data.length>0){
      for(const msg of data){
        await displayDMMessage(msg,targetUserId);
      }
      
      setTimeout(()=>{
        chatMessages.scrollTop=chatMessages.scrollHeight;
      },10);
    }else{
      chatMessages.innerHTML='<div style="display:flex;align-items:center;justify-content:center;padding:40px;color:var(--text-tertiary);font-size:14px;">メッセージはまだありません</div>';
    }
    
    // 既読を更新
    await supabase
      .from('read_status')
      .upsert({
        user_id:state.currentProfile.id,
        target_id:targetUserId,
        last_read_at:new Date().toISOString()
      });
    
  }catch(error){
    console.error('メッセージ読み込みエラー:',error);
  }
}

// メッセージを読み込み（チャンネル）
export async function loadChannelMessages(channelId){
  try{
    const{data,error}=await supabase
      .from('channel_messages')
      .select('*')
      .eq('channel_id',channelId)
      .order('created_at',{ascending:true});
    
    if(error)throw error;
    
    const chatMessages=document.getElementById('chat-messages');
    if(!chatMessages)return;
    
    chatMessages.innerHTML='';
    
    if(data&&data.length>0){
      for(const msg of data){
        await displayChannelMessage(msg);
      }
      
      setTimeout(()=>{
        chatMessages.scrollTop=chatMessages.scrollHeight;
      },10);
    }else{
      chatMessages.innerHTML='<div style="display:flex;align-items:center;justify-content:center;padding:40px;color:var(--text-tertiary);font-size:14px;">メッセージはまだありません</div>';
    }
    
    // 既読を更新
    await supabase
      .from('read_status')
      .upsert({
        user_id:state.currentProfile.id,
        target_id:channelId,
        last_read_at:new Date().toISOString()
      });
    
  }catch(error){
    console.error('メッセージ読み込みエラー:',error);
  }
}

// メッセージを表示（DM）
async function displayDMMessage(msg,targetUserId){
  const chatMessages=document.getElementById('chat-messages');
  if(!chatMessages)return;
  
  const isCurrentUser=msg.sender_id===state.currentProfile.id;
  
  let senderProfile;
  if(isCurrentUser){
    senderProfile=state.currentProfile;
  }else{
    senderProfile=state.allProfiles.find(p=>p.id===msg.sender_id);
  }
  
  if(!senderProfile)return;
  
  const avatarHtml=senderProfile.avatar_url
    ?`<img src="${senderProfile.avatar_url}" alt="${senderProfile.display_name}">`
    :`<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:${senderProfile.avatar_color};color:#fff;font-weight:600;font-size:14px;">${senderProfile.display_name.charAt(0).toUpperCase()}</div>`;
  
  const dmId=getDmId(state.currentProfile.id,targetUserId);
  let actionsHtml=`
    <div class="message-actions">
      <button class="message-action-btn" onclick="window.replyMessage('${msg.id}','${escapeHtml(msg.text||'').replace(/'/g,"\\'")}','${msg.sender_id}')" title="返信">
        <span class="material-symbols-outlined">reply</span>
      </button>
  `;
  
  if(isCurrentUser){
    actionsHtml+=`
      <button class="message-action-btn" onclick="window.editMessage('${msg.id}','dm','${escapeHtml(msg.text||'').replace(/'/g,"\\'")}',true)" title="編集">
        <span class="material-symbols-outlined">edit</span>
      </button>
      <button class="message-action-btn delete" onclick="window.deleteMessage('${msg.id}','dm',true)" title="削除">
        <span class="material-symbols-outlined">delete</span>
      </button>
    `;
  }
  
  actionsHtml+=`</div>`;
  
  const messageEl=document.createElement('div');
  messageEl.className='message';
  messageEl.innerHTML=`
    <div class="message-avatar">
      ${avatarHtml}
    </div>
    <div class="message-content">
      <div class="message-header">
        <span class="message-author">${senderProfile.display_name}</span>
        <span class="message-time">${formatMessageTime(msg.created_at)}</span>
      </div>
      ${msg.reply_to?`<div class="message-reply">返信: ${escapeHtml(msg.reply_to.text||'').substring(0,100)}...</div>`:''}
      ${msg.text?`<div class="message-text">${escapeHtml(msg.text)}</div>`:''}
      ${msg.image_url?`<img class="message-image" src="${msg.image_url}" alt="画像" onclick="window.openImageModal('${msg.image_url}')">`:''}
      ${msg.edited_at?`<div class="message-edited">(編集済み)</div>`:''}
    </div>
    ${actionsHtml}
  `;
  
  chatMessages.appendChild(messageEl);
}

// メッセージを表示（チャンネル）
async function displayChannelMessage(msg){
  const chatMessages=document.getElementById('chat-messages');
  if(!chatMessages)return;
  
  let senderProfile;
  if(msg.sender_id===state.currentProfile.id){
    senderProfile=state.currentProfile;
  }else{
    senderProfile=state.allProfiles.find(p=>p.id===msg.sender_id);
  }
  
  if(!senderProfile)return;
  
  const avatarHtml=senderProfile.avatar_url
    ?`<img src="${senderProfile.avatar_url}" alt="${senderProfile.display_name}">`
    :`<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:${senderProfile.avatar_color};color:#fff;font-weight:600;font-size:14px;">${senderProfile.display_name.charAt(0).toUpperCase()}</div>`;
  
  const isCurrentUser=msg.sender_id===state.currentProfile.id;
  let actionsHtml=`
    <div class="message-actions">
      <button class="message-action-btn" onclick="window.replyMessage('${msg.id}','${escapeHtml(msg.text||'').replace(/'/g,"\\'")}','${msg.sender_id}')" title="返信">
        <span class="material-symbols-outlined">reply</span>
      </button>
  `;
  
  if(isCurrentUser){
    actionsHtml+=`
      <button class="message-action-btn" onclick="window.editMessage('${msg.id}','channel','${escapeHtml(msg.text||'').replace(/'/g,"\\'")}',false)" title="編集">
        <span class="material-symbols-outlined">edit</span>
      </button>
      <button class="message-action-btn delete" onclick="window.deleteMessage('${msg.id}','channel',false)" title="削除">
        <span class="material-symbols-outlined">delete</span>
      </button>
    `;
  }
  
  actionsHtml+=`</div>`;
  
  const messageEl=document.createElement('div');
  messageEl.className='message';
  messageEl.innerHTML=`
    <div class="message-avatar">
      ${avatarHtml}
    </div>
    <div class="message-content">
      <div class="message-header">
        <span class="message-author">${senderProfile.display_name}</span>
        <span class="message-time">${formatMessageTime(msg.created_at)}</span>
      </div>
      ${msg.reply_to?`<div class="message-reply">返信: ${escapeHtml(msg.reply_to.text||'').substring(0,100)}...</div>`:''}
      ${msg.text?`<div class="message-text">${escapeHtml(msg.text)}</div>`:''}
      ${msg.image_url?`<img class="message-image" src="${msg.image_url}" alt="画像" onclick="window.openImageModal('${msg.image_url}')">`:''}
      ${msg.edited_at?`<div class="message-edited">(編集済み)</div>`:''}
    </div>
    ${actionsHtml}
  `;
  
  chatMessages.appendChild(messageEl);
}

// メッセージ送信
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
      const fileName=`${Date.now()}_${Math.random().toString(36).substring(7)}.png`;
      const blob=await fetch(messageImage).then(r=>r.blob());
      
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
      text:messageText||null,
      image_url:imageUrl,
      reply_to:messageReply||null,
      created_at:new Date().toISOString()
    };
    
    if(state.selectedUserId){
      // DM送信
      const dmId=getDmId(state.currentProfile.id,state.selectedUserId);
      messageData.dm_id=dmId;
      
      const{error}=await supabase
        .from('dm_messages')
        .insert(messageData);
      
      if(error)throw error;
      
      // メッセージを再読み込み
      await loadDMMessages(state.selectedUserId);
    }else if(state.selectedChannelId){
      // チャンネル送信
      messageData.channel_id=state.selectedChannelId;
      
      const{error}=await supabase
        .from('channel_messages')
        .insert(messageData);
      
      if(error)throw error;
      
      // メッセージを再読み込み
      await loadChannelMessages(state.selectedChannelId);
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