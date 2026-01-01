// メッセージ表示・送信関連（Supabase版）

import{supabase}from'../common/core.js';
import{state,updateState,resetMessageState}from'./chat-state.js';
import{getDmId,formatMessageTime,escapeHtml,showNotification}from'./chat-utils.js';

// メッセージを読み込み（DM）
export async function loadMessages(targetUserId){
  // 既存の購読を解除
  if(state.messageSubscription){
    await supabase.removeChannel(state.messageSubscription);
  }
  if(state.typingSubscription){
    await supabase.removeChannel(state.typingSubscription);
  }
  
  const dmId=getDmId(state.currentProfile.user_id,targetUserId);
  
  try{
    // メッセージ取得
    const{data:messages,error}=await supabase
      .from('dm_messages')
      .select(`
        *,
        sender:sender_id(id,user_id,display_name,avatar_url,avatar_color)
      `)
      .eq('dm_id',dmId)
      .order('created_at',{ascending:true});
    
    if(error)throw error;
    
    // 表示
    displayMessages(messages||[],targetUserId,true);
    
    // リアルタイム購読
    subscribeToMessages(dmId,targetUserId,true);
    subscribeToTyping(targetUserId);
    
    // 既読を更新
    await updateReadStatus(targetUserId);
    
  }catch(error){
    console.error('メッセージ読み込みエラー:',error);
  }
}

// メッセージを読み込み（チャンネル）
export async function loadChannelMessages(channelId){
  // 既存の購読を解除
  if(state.messageSubscription){
    await supabase.removeChannel(state.messageSubscription);
  }
  if(state.typingSubscription){
    await supabase.removeChannel(state.typingSubscription);
  }
  
  try{
    // メッセージ取得
    const{data:messages,error}=await supabase
      .from('channel_messages')
      .select(`
        *,
        sender:sender_id(id,user_id,display_name,avatar_url,avatar_color)
      `)
      .eq('channel_id',channelId)
      .order('created_at',{ascending:true});
    
    if(error)throw error;
    
    // 表示
    displayMessages(messages||[],channelId,false);
    
    // リアルタイム購読
    subscribeToMessages(channelId,channelId,false);
    subscribeToTyping(channelId);
    
    // 既読を更新
    await updateReadStatus(channelId);
    
  }catch(error){
    console.error('メッセージ読み込みエラー:',error);
  }
}

// メッセージ表示
function displayMessages(messages,targetId,isDM){
  const chatMessages=document.getElementById('chat-messages');
  if(!chatMessages)return;
  
  chatMessages.innerHTML='';
  
  messages.forEach(msg=>{
    displayMessage(msg,targetId,isDM);
  });
  
  // スクロール
  setTimeout(()=>{
    chatMessages.scrollTop=chatMessages.scrollHeight;
  },10);
}

// 単一メッセージ表示
function displayMessage(msg,targetId,isDM){
  const chatMessages=document.getElementById('chat-messages');
  if(!chatMessages)return;
  
  const isCurrentUser=msg.sender_id===state.currentProfile.id;
  const sender=msg.sender||state.currentProfile;
  
  // アイコン表示
  let iconHtml='';
  if(sender.avatar_url){
    iconHtml=`<img src="${sender.avatar_url}" alt="${sender.display_name}">`;
  }else{
    const initial=sender.display_name.charAt(0).toUpperCase();
    const color=sender.avatar_color||'#FF6B35';
    iconHtml=`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${color};color:#fff;font-weight:600;font-size:16px;">${initial}</div>`;
  }
  
  // 操作ボタン
  const pathId=isDM?getDmId(state.currentProfile.user_id,targetId):targetId;
  let actionsHtml=`
    <div class="message-actions">
      <button class="message-action-btn" onclick="window.replyMessage('${msg.id}','${escapeHtml(msg.text).replace(/'/g,"\\'")}','${msg.sender_id}')" title="返信">
        <span class="material-symbols-outlined">reply</span>
      </button>
  `;
  
  if(isCurrentUser){
    actionsHtml+=`
      <button class="message-action-btn" onclick="window.editMessage('${msg.id}','${pathId}','${escapeHtml(msg.text).replace(/'/g,"\\'")}',${isDM})" title="編集">
        <span class="material-symbols-outlined">edit</span>
      </button>
      <button class="message-action-btn delete" onclick="window.deleteMessage('${msg.id}','${pathId}',${isDM})" title="削除">
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
        <span class="message-author">${sender.display_name}</span>
        <span class="message-time">${formatMessageTime(msg.created_at)}</span>
      </div>
      ${msg.reply_to_text?`<div class="message-reply">返信: ${escapeHtml(msg.reply_to_text).substring(0,100)}...</div>`:''}
      <div class="message-text">${escapeHtml(msg.text)}</div>
      ${msg.image_url?`<img class="message-image" src="${msg.image_url}" alt="画像" onclick="window.openImageModal('${msg.image_url}')">`:''}
      ${msg.edited_at?`<div class="message-edited">(編集済み)</div>`:''}
    </div>
    ${actionsHtml}
  `;
  
  chatMessages.appendChild(messageEl);
}

// リアルタイム購読（メッセージ）
function subscribeToMessages(id,targetId,isDM){
  const tableName=isDM?'dm_messages':'channel_messages';
  const filterColumn=isDM?'dm_id':'channel_id';
  
  const subscription=supabase
    .channel(`${tableName}-${id}`)
    .on('postgres_changes',{
      event:'INSERT',
      schema:'public',
      table:tableName,
      filter:`${filterColumn}=eq.${id}`
    },async(payload)=>{
      // 送信者情報を取得
      const{data:sender}=await supabase
        .from('profiles')
        .select('*')
        .eq('id',payload.new.sender_id)
        .single();
      
      payload.new.sender=sender;
      displayMessage(payload.new,targetId,isDM);
      
      // 通知
      if(payload.new.sender_id!==state.currentProfile.id){
        showNotification(
          sender.display_name,
          payload.new.text||'画像を送信しました',
          sender.avatar_url
        );
      }
      
      // スクロール
      const chatMessages=document.getElementById('chat-messages');
      if(chatMessages){
        chatMessages.scrollTop=chatMessages.scrollHeight;
      }
      
      // 既読更新
      await updateReadStatus(targetId);
    })
    .on('postgres_changes',{
      event:'UPDATE',
      schema:'public',
      table:tableName,
      filter:`${filterColumn}=eq.${id}`
    },async(payload)=>{
      const msgEl=document.querySelector(`[data-message-id="${payload.new.id}"]`);
      if(msgEl){
        const{data:sender}=await supabase
          .from('profiles')
          .select('*')
          .eq('id',payload.new.sender_id)
          .single();
        
        payload.new.sender=sender;
        msgEl.outerHTML='';
        displayMessage(payload.new,targetId,isDM);
      }
    })
    .on('postgres_changes',{
      event:'DELETE',
      schema:'public',
      table:tableName,
      filter:`${filterColumn}=eq.${id}`
    },(payload)=>{
      const msgEl=document.querySelector(`[data-message-id="${payload.old.id}"]`);
      if(msgEl)msgEl.remove();
    })
    .subscribe();
  
  updateState('messageSubscription',subscription);
}

// リアルタイム購読（入力中）
function subscribeToTyping(targetId){
  const subscription=supabase
    .channel(`typing-${targetId}`)
    .on('postgres_changes',{
      event:'*',
      schema:'public',
      table:'typing_status',
      filter:`target_id=eq.${targetId}`
    },async()=>{
      await updateTypingIndicator(targetId);
    })
    .subscribe();
  
  updateState('typingSubscription',subscription);
}

// 入力中表示を更新
async function updateTypingIndicator(targetId){
  try{
    const{data:typingUsers}=await supabase
      .from('typing_status')
      .select('user_id,profiles(display_name)')
      .eq('target_id',targetId)
      .eq('is_typing',true)
      .neq('user_id',state.currentProfile.id);
    
    const typingIndicator=document.getElementById('typing-indicator');
    const typingText=document.getElementById('typing-text');
    
    if(!typingIndicator||!typingText)return;
    
    if(typingUsers&&typingUsers.length>0){
      const names=typingUsers.map(u=>u.profiles.display_name).join(', ');
      typingText.textContent=`${names} が入力中...`;
      typingIndicator.style.display='block';
    }else{
      typingIndicator.style.display='none';
    }
  }catch(error){
    console.error('入力中表示エラー:',error);
  }
}

// 既読状態を更新
async function updateReadStatus(targetId){
  try{
    await supabase
      .from('read_status')
      .upsert({
        user_id:state.currentProfile.id,
        target_id:targetId,
        last_read_at:new Date().toISOString()
      });
  }catch(error){
    console.error('既読更新エラー:',error);
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
      const fileName=`${Date.now()}_${Math.random().toString(36).substr(2,9)}.png`;
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
      const targetUser=state.allUsers.find(u=>u.user_id===state.selectedUserId);
      const dmId=getDmId(state.currentProfile.user_id,state.selectedUserId);
      messageData.dm_id=dmId;
      
      await supabase
        .from('dm_messages')
        .insert(messageData);
    }else if(state.selectedChannelId){
      messageData.channel_id=state.selectedChannelId;
      
      await supabase
        .from('channel_messages')
        .insert(messageData);
    }
    
    // 入力中状態をクリア
    await clearTypingStatus();
    
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

// 入力中状態を送信
export async function sendTypingStatus(targetId,isTyping){
  try{
    await supabase
      .from('typing_status')
      .upsert({
        user_id:state.currentProfile.id,
        target_id:targetId,
        is_typing:isTyping,
        updated_at:new Date().toISOString()
      });
  }catch(error){
    console.error('入力中状態送信エラー:',error);
  }
}

// 入力中状態をクリア
async function clearTypingStatus(){
  const targetId=state.selectedUserId||state.selectedChannelId;
  if(!targetId)return;
  
  try{
    await supabase
      .from('typing_status')
      .delete()
      .eq('user_id',state.currentProfile.id)
      .eq('target_id',targetId);
  }catch(error){
    console.error('入力中状態クリアエラー:',error);
  }
}