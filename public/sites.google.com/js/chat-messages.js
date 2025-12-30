// メッセージ表示・送信関連（Supabase版）

import{supabase}from'../common/core.js';
import{state,updateState,resetMessageState}from'./chat-state.js';
import{getDmId,formatMessageTime,escapeHtml,showNotification}from'./chat-utils.js';

// メッセージを読み込み（DM）
export function loadMessages(userId){
  alert('loadMessages開始: '+userId);
  
  // 既存の購読を解除
  if(state.messageSubscription){
    supabase.removeChannel(state.messageSubscription);
  }
  
  const dmId=getDmId(state.currentUserId,userId);
  alert('dmId生成: '+dmId);
  
  // 初回ロード
  alert('loadDMMessagesOnce呼び出し前');
  loadDMMessagesOnce(dmId,userId);
  alert('loadDMMessagesOnce呼び出し後');
  
  // リアルタイム購読（フィルターなしで全体を監視）
  const subscription=supabase
    .channel(`dm-${dmId}`)
    .on('postgres_changes',{
      event:'*',
      schema:'public',
      table:'dm_messages'
    },(payload)=>{
      // このDMに関連するメッセージのみ処理
      if(payload.new&&payload.new.dm_id===dmId){
        loadDMMessagesOnce(dmId,userId);
      }
    })
    .subscribe();
  
  updateState('messageSubscription',subscription);
  
  // 入力中状態を購読
  subscribeToTyping(userId);
}

// DMメッセージを一度だけ読み込み
async function loadDMMessagesOnce(dmId,userId){
  try{
    const{data:messages,error}=await supabase
      .from('dm_messages')
      .select('*')
      .eq('dm_id',dmId)
      .order('created_at',{ascending:true});
    
    // デバッグ用
    console.log('DM読み込み:',{dmId,messages,error});
    
    if(error){
      console.error('DM読み込みエラー:',error);
      alert('メッセージ読み込みエラー: '+JSON.stringify(error));
      throw error;
    }
    
    const chatMessages=document.getElementById('chat-messages');
    if(!chatMessages){
      alert('chat-messages要素が見つかりません');
      return;
    }
    
    const wasAtBottom=chatMessages.scrollHeight-chatMessages.scrollTop<=chatMessages.clientHeight+50;
    
    chatMessages.innerHTML='';
    
    if(messages&&messages.length>0){
      alert(`${messages.length}件のメッセージを表示します`);
      for(const msg of messages){
        try{
          await displayDMMessage(msg,userId);
        }catch(displayError){
          console.error('メッセージ表示エラー:',displayError);
          alert('表示エラー: '+displayError.message);
        }
      }
      
      if(wasAtBottom){
        setTimeout(()=>{
          chatMessages.scrollTop=chatMessages.scrollHeight;
        },10);
      }
      
      // 既読を更新
      await supabase
        .from('read_status')
        .upsert({
          user_id:state.currentUserId,
          target_id:userId,
          last_read_at:new Date().toISOString()
        });
    }else{
      chatMessages.innerHTML='<div style="display:flex;align-items:center;justify-content:center;padding:40px;color:var(--text-tertiary);font-size:14px;">まだメッセージがありません</div>';
    }
  }catch(error){
    console.error('DM読み込みエラー:',error);
    alert('DM読み込み例外: '+error.message);
  }
}

// チャンネルメッセージを読み込み
export function loadChannelMessages(channelId){
  // 既存の購読を解除
  if(state.messageSubscription){
    supabase.removeChannel(state.messageSubscription);
  }
  
  // 初回ロード
  loadChannelMessagesOnce(channelId);
  
  // リアルタイム購読（フィルターなしで全体を監視）
  const subscription=supabase
    .channel(`channel-${channelId}`)
    .on('postgres_changes',{
      event:'*',
      schema:'public',
      table:'channel_messages'
    },(payload)=>{
      // このチャンネルに関連するメッセージのみ処理
      if(payload.new&&payload.new.channel_id===channelId){
        loadChannelMessagesOnce(channelId);
      }
    })
    .subscribe();
  
  updateState('messageSubscription',subscription);
  
  // 入力中状態を購読
  subscribeToTyping(channelId);
}

// チャンネルメッセージを一度だけ読み込み
async function loadChannelMessagesOnce(channelId){
  try{
    const{data:messages,error}=await supabase
      .from('channel_messages')
      .select('*')
      .eq('channel_id',channelId)
      .order('created_at',{ascending:true});
    
    if(error)throw error;
    
    const chatMessages=document.getElementById('chat-messages');
    if(!chatMessages)return;
    
    const wasAtBottom=chatMessages.scrollHeight-chatMessages.scrollTop<=chatMessages.clientHeight+50;
    
    chatMessages.innerHTML='';
    
    if(messages&&messages.length>0){
      for(const msg of messages){
        await displayChannelMessage(msg);
      }
      
      if(wasAtBottom){
        setTimeout(()=>{
          chatMessages.scrollTop=chatMessages.scrollHeight;
        },10);
      }
      
      // 既読を更新
      await supabase
        .from('read_status')
        .upsert({
          user_id:state.currentUserId,
          target_id:channelId,
          last_read_at:new Date().toISOString()
        });
    }
  }catch(error){
    console.error('チャンネル読み込みエラー:',error);
  }
}

// 入力中状態を購読
function subscribeToTyping(targetId){
  if(state.typingSubscription){
    supabase.removeChannel(state.typingSubscription);
  }
  
  const subscription=supabase
    .channel(`typing-${targetId}`)
    .on('postgres_changes',{
      event:'*',
      schema:'public',
      table:'typing_status'
    },(payload)=>{
      if(payload.new&&payload.new.target_id===targetId){
        updateTypingDisplay(targetId);
      }
    })
    .subscribe();
  
  updateState('typingSubscription',subscription);
}

// 入力中表示を更新
async function updateTypingDisplay(targetId){
  try{
    const{data:typingUsers,error}=await supabase
      .from('typing_status')
      .select('user_id,is_typing')
      .eq('target_id',targetId)
      .eq('is_typing',true)
      .neq('user_id',state.currentUserId);
    
    if(error)throw error;
    
    const statusEl=document.getElementById('chat-header-status');
    if(!statusEl)return;
    
    if(typingUsers&&typingUsers.length>0){
      // ユーザー名を取得
      const userIds=typingUsers.map(t=>t.user_id);
      const{data:profiles}=await supabase
        .from('profiles')
        .select('id,display_name')
        .in('id',userIds);
      
      const names=(profiles||[]).map(p=>p.display_name).join(', ');
      statusEl.textContent=`${names} が入力中...`;
    }else{
      // 元の状態に戻す
      if(state.selectedUserId){
        const user=state.allUsers.find(u=>u.id===state.selectedUserId);
        if(user){
          const isOnline=user.is_online||false;
          statusEl.textContent=isOnline?'オンライン':`最終: ${formatLastOnline(user.last_online)}`;
        }
      }
    }
  }catch(error){
    console.error('入力中表示エラー:',error);
  }
}

// DMメッセージを表示
async function displayDMMessage(msg,otherUserId){
  const chatMessages=document.getElementById('chat-messages');
  if(!chatMessages)return;
  
  const isCurrentUser=msg.sender_id===state.currentUserId;
  
  let senderData;
  if(isCurrentUser){
    senderData=state.currentProfile;
  }else{
    senderData=state.allUsers.find(u=>u.id===msg.sender_id);
  }
  
  if(!senderData)return;
  
  // アイコン表示
  let avatarHtml='';
  if(senderData.avatar_url){
    avatarHtml=`<img src="${senderData.avatar_url}" alt="${senderData.display_name}">`;
  }else{
    const initial=senderData.display_name.charAt(0).toUpperCase();
    const color=senderData.avatar_color||'#FF6B35';
    avatarHtml=`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${color};color:#fff;font-weight:600;font-size:16px;border-radius:50%;">${initial}</div>`;
  }
  
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
  messageEl.innerHTML=`
    <div class="message-avatar">
      ${avatarHtml}
    </div>
    <div class="message-content">
      <div class="message-header">
        <span class="message-author">${senderData.display_name}</span>
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

// チャンネルメッセージを表示
async function displayChannelMessage(msg){
  const chatMessages=document.getElementById('chat-messages');
  if(!chatMessages)return;
  
  let senderData;
  if(msg.sender_id===state.currentUserId){
    senderData=state.currentProfile;
  }else{
    senderData=state.allUsers.find(u=>u.id===msg.sender_id);
  }
  
  if(!senderData)return;
  
  // アイコン表示
  let avatarHtml='';
  if(senderData.avatar_url){
    avatarHtml=`<img src="${senderData.avatar_url}" alt="${senderData.display_name}">`;
  }else{
    const initial=senderData.display_name.charAt(0).toUpperCase();
    const color=senderData.avatar_color||'#FF6B35';
    avatarHtml=`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${color};color:#fff;font-weight:600;font-size:16px;border-radius:50%;">${initial}</div>`;
  }
  
  const isCurrentUser=msg.sender_id===state.currentUserId;
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
  messageEl.innerHTML=`
    <div class="message-avatar">
      ${avatarHtml}
    </div>
    <div class="message-content">
      <div class="message-header">
        <span class="message-author">${senderData.display_name}</span>
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
      const base64Data=messageImage.split(',')[1];
      const binary=atob(base64Data);
      const array=new Uint8Array(binary.length);
      for(let i=0;i<binary.length;i++){
        array[i]=binary.charCodeAt(i);
      }
      const blob=new Blob([array],{type:'image/png'});
      
      const fileName=`${Date.now()}.png`;
      
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
      sender_id:state.currentUserId,
      text:messageText,
      image_url:imageUrl,
      created_at:new Date().toISOString()
    };
    
    if(messageReply){
      messageData.reply_to={
        message_id:messageReply.id,
        text:messageReply.text,
        sender_id:messageReply.senderId
      };
    }
    
    if(state.selectedUserId){
      const dmId=getDmId(state.currentUserId,state.selectedUserId);
      messageData.dm_id=dmId;
      
      const{error}=await supabase
        .from('dm_messages')
        .insert([messageData]);
      
      if(error)throw error;
    }else if(state.selectedChannelId){
      messageData.channel_id=state.selectedChannelId;
      
      const{error}=await supabase
        .from('channel_messages')
        .insert([messageData]);
      
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