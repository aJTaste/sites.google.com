// メッセージ送受信（Supabase版）
import{supabase}from'../common/core.js';
import{state,updateState}from'./chat-state.js';
import{getDmId,formatMessageTime,escapeHtml,showNotification}from'./chat-utils.js';

// DMメッセージを読み込み
export function loadMessages(userId){
  // 既存の購読を解除
  if(state.messageSubscription){
    state.messageSubscription.unsubscribe();
  }
  if(state.typingSubscription){
    state.typingSubscription.unsubscribe();
  }
  
  const selectedUser=state.allUsers.find(u=>u.id===userId);
  if(!selectedUser)return;
  
  const dmId=getDmId(state.currentProfile.user_id,selectedUser.user_id);
  
  // メッセージをリアルタイム購読
  const messageChannel=supabase
    .channel(`dm-${dmId}`)
    .on('postgres_changes',{
      event:'*',
      schema:'public',
      table:'dm_messages',
      filter:`dm_id=eq.${dmId}`
    },async(payload)=>{
      await displayDMMessages(selectedUser);
      
      // 新着メッセージ通知
      if(payload.eventType==='INSERT'&&payload.new.sender_id!==state.currentProfile.id){
        const sender=state.allUsers.find(u=>u.id===payload.new.sender_id);
        if(sender){
          let avatarUrl='assets/favicon1.svg';
          if(sender.avatar_url){
            avatarUrl=sender.avatar_url;
          }
          showNotification(
            `${sender.display_name}からのメッセージ`,
            payload.new.text||'画像を送信しました',
            avatarUrl
          );
        }
      }
    })
    .subscribe();
  
  updateState('messageSubscription',messageChannel);
  
  // 入力中状態を購読
  const typingChannel=supabase
    .channel(`typing-dm-${selectedUser.user_id}`)
    .on('postgres_changes',{
      event:'*',
      schema:'public',
      table:'typing_status',
      filter:`target_id=eq.${state.currentProfile.user_id}`
    },(payload)=>{
      updateTypingStatus(selectedUser,payload.new?.is_typing);
    })
    .subscribe();
  
  updateState('typingSubscription',typingChannel);
  
  // 初回表示
  displayDMMessages(selectedUser);
}

// チャンネルメッセージを読み込み
export function loadChannelMessages(channelId){
  // 既存の購読を解除
  if(state.messageSubscription){
    state.messageSubscription.unsubscribe();
  }
  if(state.typingSubscription){
    state.typingSubscription.unsubscribe();
  }
  
  // メッセージをリアルタイム購読
  const messageChannel=supabase
    .channel(`channel-${channelId}`)
    .on('postgres_changes',{
      event:'*',
      schema:'public',
      table:'channel_messages',
      filter:`channel_id=eq.${channelId}`
    },async(payload)=>{
      await displayChannelMessages(channelId);
      
      // 新着メッセージ通知
      if(payload.eventType==='INSERT'&&payload.new.sender_id!==state.currentProfile.id){
        const sender=state.allUsers.find(u=>u.id===payload.new.sender_id);
        const senderName=sender?sender.display_name:'誰か';
        let avatarUrl='assets/favicon1.svg';
        if(sender&&sender.avatar_url){
          avatarUrl=sender.avatar_url;
        }
        showNotification(
          `${channelId}: ${senderName}`,
          payload.new.text||'画像を送信しました',
          avatarUrl
        );
      }
    })
    .subscribe();
  
  updateState('messageSubscription',messageChannel);
  
  // 入力中状態を購読
  const typingChannel=supabase
    .channel(`typing-channel-${channelId}`)
    .on('postgres_changes',{
      event:'*',
      schema:'public',
      table:'typing_status',
      filter:`target_id=eq.${channelId}`
    },(payload)=>{
      updateChannelTypingStatus(payload.new);
    })
    .subscribe();
  
  updateState('typingSubscription',typingChannel);
  
  // 初回表示
  displayChannelMessages(channelId);
}

// DMメッセージを表示
async function displayDMMessages(selectedUser){
  const chatMessages=document.getElementById('chat-messages');
  if(!chatMessages)return;
  
  const dmId=getDmId(state.currentProfile.user_id,selectedUser.user_id);
  
  // メッセージ取得
  const{data:messages,error}=await supabase
    .from('dm_messages')
    .select('*')
    .eq('dm_id',dmId)
    .order('created_at',{ascending:true});
  
  if(error){
    console.error('メッセージ取得エラー:',error);
    return;
  }
  
  // 既読状態を取得
  const{data:readStatus}=await supabase
    .from('read_status')
    .select('*')
    .eq('user_id',selectedUser.id)
    .eq('target_id',state.currentProfile.user_id)
    .single();
  
  const otherUserLastRead=readStatus?new Date(readStatus.last_read_at).getTime():0;
  
  const wasAtBottom=chatMessages.scrollHeight-chatMessages.scrollTop<=chatMessages.clientHeight+50;
  
  chatMessages.innerHTML='';
  
  if(!messages||messages.length===0){
    chatMessages.innerHTML='<div style="display:flex;align-items:center;justify-content:center;padding:40px;color:var(--text-tertiary);font-size:14px;">メッセージはまだありません</div>';
    return;
  }
  
  messages.forEach(msg=>{
    displayMessage(msg,selectedUser,otherUserLastRead,true);
  });
  
  if(wasAtBottom){
    setTimeout(()=>{
      chatMessages.scrollTop=chatMessages.scrollHeight;
    },10);
  }
}

// チャンネルメッセージを表示
async function displayChannelMessages(channelId){
  const chatMessages=document.getElementById('chat-messages');
  if(!chatMessages)return;
  
  // メッセージ取得
  const{data:messages,error}=await supabase
    .from('channel_messages')
    .select('*')
    .eq('channel_id',channelId)
    .order('created_at',{ascending:true});
  
  if(error){
    console.error('メッセージ取得エラー:',error);
    return;
  }
  
  const wasAtBottom=chatMessages.scrollHeight-chatMessages.scrollTop<=chatMessages.clientHeight+50;
  
  chatMessages.innerHTML='';
  
  if(!messages||messages.length===0){
    chatMessages.innerHTML='<div style="display:flex;align-items:center;justify-content:center;padding:40px;color:var(--text-tertiary);font-size:14px;">メッセージはまだありません</div>';
    return;
  }
  
  messages.forEach(msg=>{
    displayMessage(msg,null,0,false);
  });
  
  if(wasAtBottom){
    setTimeout(()=>{
      chatMessages.scrollTop=chatMessages.scrollHeight;
    },10);
  }
}

// メッセージを表示
function displayMessage(msg,otherUser,otherUserLastRead,isDM){
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
  
  // アバター表示
  let avatarHtml='';
  if(senderData.avatar_url){
    avatarHtml=`<img src="${senderData.avatar_url}" alt="${senderData.display_name}">`;
  }else{
    const initial=senderData.display_name.charAt(0).toUpperCase();
    const color=senderData.avatar_color||'#FF6B35';
    avatarHtml=`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${color};color:#fff;font-weight:600;font-size:16px;">${initial}</div>`;
  }
  
  // 操作ボタン
  let actionsHtml=`<div class="message-actions">`;
  
  // リプライは全員可能
  actionsHtml+=`<button class="message-action-btn" onclick="window.replyMessage('${msg.id}','${escapeHtml(msg.text||'').replace(/'/g,"\\'")}','${msg.sender_id}')" title="返信"><span class="material-symbols-outlined">reply</span></button>`;
  
  // 編集・削除は自分のメッセージのみ
  if(isCurrentUser){
    actionsHtml+=`<button class="message-action-btn" onclick="window.editMessage('${msg.id}',${isDM})" title="編集"><span class="material-symbols-outlined">edit</span></button>`;
    actionsHtml+=`<button class="message-action-btn delete" onclick="window.deleteMessage('${msg.id}',${isDM})" title="削除"><span class="material-symbols-outlined">delete</span></button>`;
  }
  
  actionsHtml+=`</div>`;
  
  // 既読表示（DMのみ、自分のメッセージのみ）
  let readStatusHtml='';
  if(isDM&&isCurrentUser&&otherUserLastRead>0){
    const msgTime=new Date(msg.created_at).getTime();
    if(msgTime<=otherUserLastRead){
      readStatusHtml='<span class="message-read">既読</span>';
    }
  }
  
  const messageEl=document.createElement('div');
  messageEl.className='message';
  messageEl.innerHTML=`
    <div class="message-avatar">
      ${avatarHtml}
    </div>
    <div class="message-content">
      <div class="message-header">
        <span class="message-author">${senderData.display_name}</span>
        <span class="message-time">${formatMessageTime(msg.created_at)}</span>
        ${readStatusHtml}
      </div>
      ${msg.reply_to_text?`<div class="message-reply">返信: ${escapeHtml(msg.reply_to_text).substring(0,50)}...</div>`:''}
      ${msg.text?`<div class="message-text">${escapeHtml(msg.text)}</div>`:''}
      ${msg.image_url?`<img class="message-image" src="${msg.image_url}" alt="画像" onclick="window.openImageModal('${msg.image_url}')">`:''}
    </div>
    ${actionsHtml}
  `;
  
  chatMessages.appendChild(messageEl);
}

// 入力中状態を更新（DM）
function updateTypingStatus(user,isTyping){
  const statusEl=document.getElementById('chat-header-status');
  if(!statusEl)return;
  
  if(isTyping){
    statusEl.textContent=`${user.display_name} が入力中...`;
    statusEl.style.color='var(--main)';
  }else{
    const isOnline=user.is_online||false;
    statusEl.textContent=isOnline?'オンライン':`最終: ${formatLastOnline(user.last_online)}`;
    statusEl.style.color='';
  }
}

// 入力中状態を更新（チャンネル）
function updateChannelTypingStatus(typingData){
  if(!typingData||!typingData.is_typing)return;
  
  const user=state.allUsers.find(u=>u.id===typingData.user_id);
  if(!user||user.id===state.currentProfile.id)return;
  
  const statusEl=document.getElementById('chat-header-status');
  if(!statusEl)return;
  
  statusEl.textContent=`${user.display_name} が入力中...`;
  statusEl.style.color='var(--main)';
  
  // 5秒後にリセット
  setTimeout(()=>{
    statusEl.style.color='';
  },5000);
}

// メッセージを送信
export async function sendMessage(){
  if(state.isSending)return;
  
  const chatInput=document.getElementById('chat-input');
  const text=chatInput.value.trim();
  
  if(!text&&!state.selectedImage)return;
  if(!state.selectedUserId&&!state.selectedChannelId)return;
  
  updateState('isSending',true);
  chatInput.disabled=true;
  
  const messageText=text;
  const messageImage=state.selectedImage;
  const messageReply=state.replyToMessage;
  
  chatInput.value='';
  chatInput.style.height='auto';
  updateState('selectedImage',null);
  updateState('replyToMessage',null);
  
  const imagePreviewContainer=document.getElementById('image-preview-container');
  const replyPreview=document.getElementById('reply-preview');
  if(imagePreviewContainer)imagePreviewContainer.classList.remove('show');
  if(replyPreview)replyPreview.classList.remove('show');
  
  try{
    const messageData={
      sender_id:state.currentProfile.id,
      text:messageText,
      created_at:new Date().toISOString()
    };
    
    // 画像をアップロード
    if(messageImage){
      const fileExt=messageImage.name.split('.').pop();
      const fileName=`${Date.now()}_${state.currentProfile.id}.${fileExt}`;
      
      const{error:uploadError}=await supabase.storage
        .from('chat-images')
        .upload(fileName,messageImage);
      
      if(uploadError)throw uploadError;
      
      const{data:urlData}=supabase.storage
        .from('chat-images')
        .getPublicUrl(fileName);
      
      messageData.image_url=urlData.publicUrl;
    }
    
    // リプライ情報
    if(messageReply){
      messageData.reply_to_id=messageReply.id;
      messageData.reply_to_text=messageReply.text;
      messageData.reply_to_sender_id=messageReply.senderId;
    }
    
    // DMまたはチャンネルに送信
    if(state.selectedUserId){
      const selectedUser=state.allUsers.find(u=>u.id===state.selectedUserId);
      const dmId=getDmId(state.currentProfile.user_id,selectedUser.user_id);
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
    chatInput.focus();
  }
}