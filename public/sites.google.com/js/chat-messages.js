// メッセージ表示・送信関連（同期処理修正版）

import{database}from'../common/firebase-config.js';
import{ref,get,set,push,onValue,off}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import{state,updateState,resetMessageState}from'./chat-state.js';
import{getDmId,formatMessageTime,escapeHtml,showNotification}from'./chat-utils.js';

// メッセージを読み込み（DM）
export function loadMessages(userId){
  if(state.messageListener){
    off(state.messageListener);
  }
  
  const dmId=getDmId(state.currentUser.uid,userId);
  const messagesRef=ref(database,`dms/${dmId}/messages`);
  
  updateState('messageListener',messagesRef);
  
  let isFirstLoad=true;
  
  onValue(messagesRef,async(snapshot)=>{
    const chatMessages=document.getElementById('chat-messages');
    if(!chatMessages)return;
    
    const wasAtBottom=chatMessages.scrollHeight-chatMessages.scrollTop<=chatMessages.clientHeight+50;
    
    chatMessages.innerHTML='';
    
    if(snapshot.exists()){
      const messages=snapshot.val();
      const messageArray=Object.keys(messages).map(key=>({
        id:key,
        ...messages[key]
      }));
      
      // タイムスタンプで昇順ソート（古いメッセージが上）
      messageArray.sort((a,b)=>a.timestamp-b.timestamp);
      
      // 新着メッセージ通知
      if(!isFirstLoad&&messageArray.length>0){
        const latestMsg=messageArray[messageArray.length-1];
        if(latestMsg.senderId===userId){
          const sender=state.allUsers.find(u=>u.uid===userId);
          if(sender){
            showNotification(
              `${sender.username}からのメッセージ`,
              latestMsg.text||'画像を送信しました',
              sender.iconUrl&&sender.iconUrl!=='default'?sender.iconUrl:'assets/school.png'
            );
          }
        }
      }
      
      // 全メッセージを順番に表示（awaitを使って順番に処理）
      for(const msg of messageArray){
        await displayMessage(msg,userId);
      }
      
      // スクロール位置を調整
      if(isFirstLoad||wasAtBottom){
        setTimeout(()=>{
          chatMessages.scrollTop=chatMessages.scrollHeight;
        },10);
      }
      
      isFirstLoad=false;
    }
  });
}

// メッセージを読み込み（チャンネル）
export function loadChannelMessages(channelId){
  if(state.messageListener){
    off(state.messageListener);
  }
  
  const messagesRef=ref(database,`channels/${channelId}/messages`);
  
  updateState('messageListener',messagesRef);
  
  let isFirstLoad=true;
  
  onValue(messagesRef,(snapshot)=>{
    const chatMessages=document.getElementById('chat-messages');
    if(!chatMessages)return;
    
    const wasAtBottom=chatMessages.scrollHeight-chatMessages.scrollTop<=chatMessages.clientHeight+50;
    
    chatMessages.innerHTML='';
    
    if(snapshot.exists()){
      const messages=snapshot.val();
      const messageArray=Object.keys(messages).map(key=>({
        id:key,
        ...messages[key]
      }));
      
      // タイムスタンプで昇順ソート（古いメッセージが上）
      messageArray.sort((a,b)=>a.timestamp-b.timestamp);
      
      // 新着メッセージ通知
      if(!isFirstLoad&&messageArray.length>0){
        const latestMsg=messageArray[messageArray.length-1];
        if(latestMsg.senderId!==state.currentUser.uid){
          const sender=state.allUsers.find(u=>u.uid===latestMsg.senderId);
          const senderName=sender?sender.username:'誰か';
          const channel={name:channelId};
          showNotification(
            `${channel.name}: ${senderName}`,
            latestMsg.text||'画像を送信しました',
            sender&&sender.iconUrl&&sender.iconUrl!=='default'?sender.iconUrl:'assets/school.png'
          );
        }
      }
      
      // 全メッセージを順番に表示
      messageArray.forEach(msg=>{
        displayChannelMessage(msg);
      });
      
      // スクロール位置を調整
      if(isFirstLoad||wasAtBottom){
        setTimeout(()=>{
          chatMessages.scrollTop=chatMessages.scrollHeight;
        },10);
      }
      
      isFirstLoad=false;
    }
  });
}

// メッセージを表示（DM）- 既読状態を後から更新
async function displayMessage(msg,otherUserId){
  const chatMessages=document.getElementById('chat-messages');
  if(!chatMessages)return;
  
  const isCurrentUser=msg.senderId===state.currentUser.uid;
  
  let senderData;
  if(isCurrentUser){
    senderData=state.currentUserData;
  }else{
    senderData=state.allUsers.find(u=>u.uid===msg.senderId);
  }
  
  if(!senderData)return;
  
  const iconUrl=senderData.iconUrl&&senderData.iconUrl!=='default'?senderData.iconUrl:'assets/school.png';
  
  // 操作ボタン（全てのメッセージにリプライ可能、自分のメッセージは編集・削除も）
  const dmId=getDmId(state.currentUser.uid,otherUserId);
  let actionsHtml=`
    <div class="message-actions">
      <button class="message-action-btn" onclick="window.replyMessage('${msg.id}','${escapeHtml(msg.text).replace(/'/g,"\\'")}','${msg.senderId}')" title="返信">
        <span class="material-icons">reply</span>
      </button>
  `;
  
  if(isCurrentUser){
    actionsHtml+=`
      <button class="message-action-btn" onclick="window.editMessage('${msg.id}','${dmId}','${escapeHtml(msg.text).replace(/'/g,"\\'")}',true)" title="編集">
        <span class="material-icons">edit</span>
      </button>
      <button class="message-action-btn delete" onclick="window.deleteMessage('${msg.id}','${dmId}',true)" title="削除">
        <span class="material-icons">delete</span>
      </button>
    `;
  }
  
  actionsHtml+=`</div>`;
  
  const messageEl=document.createElement('div');
  messageEl.className='message';
  messageEl.setAttribute('data-message-id',msg.id);
  messageEl.setAttribute('data-timestamp',msg.timestamp);
  messageEl.innerHTML=`
    <div class="message-avatar">
      <img src="${iconUrl}" alt="${senderData.username}">
    </div>
    <div class="message-content">
      <div class="message-header">
        <span class="message-author">${senderData.username}</span>
        <span class="message-time">${formatMessageTime(msg.timestamp)}</span>
        <span class="message-read-status" data-msg-id="${msg.id}"></span>
      </div>
      ${msg.replyTo?`<div class="message-reply">返信: ${escapeHtml(msg.replyTo.text).substring(0,50)}...</div>`:''}
      <div class="message-text">${escapeHtml(msg.text)}</div>
      ${msg.imageUrl?`<img class="message-image" src="${msg.imageUrl}" alt="画像" onclick="window.openImageModal('${msg.imageUrl}')">`:''}
      ${msg.editedAt?`<div class="message-edited">(編集済み)</div>`:''}
    </div>
    ${actionsHtml}
  `;
  
  // DOMに追加してから既読状態を取得
  chatMessages.appendChild(messageEl);
  
  // 既読状態を非同期で取得して更新（DOM追加後なので順序に影響しない）
  if(isCurrentUser){
    updateReadStatus(msg.id,msg.timestamp,otherUserId);
  }
}

// 既読状態を更新（非同期・DOM追加後）
async function updateReadStatus(messageId,timestamp,otherUserId){
  try{
    const otherUserRef=ref(database,`users/${otherUserId}/lastRead/${state.currentUser.uid}`);
    const readSnapshot=await get(otherUserRef);
    if(readSnapshot.exists()){
      const lastReadTime=readSnapshot.val();
      if(timestamp<=lastReadTime){
        const statusEl=document.querySelector(`[data-msg-id="${messageId}"]`);
        if(statusEl){
          statusEl.innerHTML='<span class="message-read">✓ 既読</span>';
        }
      }
    }
  }catch(error){
    console.error('既読状態取得エラー:',error);
  }
}

// メッセージを表示（チャンネル）
function displayChannelMessage(msg){
  const chatMessages=document.getElementById('chat-messages');
  if(!chatMessages)return;
  
  let senderData;
  if(msg.senderId===state.currentUser.uid){
    senderData=state.currentUserData;
  }else{
    senderData=state.allUsers.find(u=>u.uid===msg.senderId);
  }
  
  if(!senderData)return;
  
  const iconUrl=senderData.iconUrl&&senderData.iconUrl!=='default'?senderData.iconUrl:'assets/school.png';
  
  // 操作ボタン（全てのメッセージにリプライ可能、自分のメッセージは編集・削除も）
  const isCurrentUser=msg.senderId===state.currentUser.uid;
  let actionsHtml=`
    <div class="message-actions">
      <button class="message-action-btn" onclick="window.replyMessage('${msg.id}','${escapeHtml(msg.text).replace(/'/g,"\\'")}','${msg.senderId}')" title="返信">
        <span class="material-icons">reply</span>
      </button>
  `;
  
  if(isCurrentUser){
    actionsHtml+=`
      <button class="message-action-btn" onclick="window.editMessage('${msg.id}','${state.selectedChannelId}','${escapeHtml(msg.text).replace(/'/g,"\\'")}',false)" title="編集">
        <span class="material-icons">edit</span>
      </button>
      <button class="message-action-btn delete" onclick="window.deleteMessage('${msg.id}','${state.selectedChannelId}',false)" title="削除">
        <span class="material-icons">delete</span>
      </button>
    `;
  }
  
  actionsHtml+=`</div>`;
  
  const messageEl=document.createElement('div');
  messageEl.className='message';
  messageEl.setAttribute('data-message-id',msg.id);
  messageEl.setAttribute('data-timestamp',msg.timestamp);
  messageEl.innerHTML=`
    <div class="message-avatar">
      <img src="${iconUrl}" alt="${senderData.username}">
    </div>
    <div class="message-content">
      <div class="message-header">
        <span class="message-author">${senderData.username}</span>
        <span class="message-time">${formatMessageTime(msg.timestamp)}</span>
      </div>
      ${msg.replyTo?`<div class="message-reply">返信: ${escapeHtml(msg.replyTo.text).substring(0,50)}...</div>`:''}
      <div class="message-text">${escapeHtml(msg.text)}</div>
      ${msg.imageUrl?`<img class="message-image" src="${msg.imageUrl}" alt="画像" onclick="window.openImageModal('${msg.imageUrl}')">`:''}
      ${msg.editedAt?`<div class="message-edited">(編集済み)</div>`:''}
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
    const messageData={
      senderId:state.currentUser.uid,
      text:messageText,
      timestamp:Date.now()
    };
    
    if(messageImage){
      messageData.imageUrl=messageImage;
    }
    
    if(messageReply){
      messageData.replyTo={
        messageId:messageReply.id,
        text:messageReply.text,
        senderId:messageReply.senderId
      };
    }
    
    if(state.selectedUserId){
      const dmId=getDmId(state.currentUser.uid,state.selectedUserId);
      const messagesRef=ref(database,`dms/${dmId}/messages`);
      const newMessageRef=push(messagesRef);
      
      await set(newMessageRef,messageData);
      
      const participantsRef=ref(database,`dms/${dmId}/participants`);
      const participantsSnapshot=await get(participantsRef);
      
      if(!participantsSnapshot.exists()){
        await set(participantsRef,{
          [state.currentUser.uid]:true,
          [state.selectedUserId]:true
        });
      }
    }else if(state.selectedChannelId){
      const messagesRef=ref(database,`channels/${state.selectedChannelId}/messages`);
      const newMessageRef=push(messagesRef);
      
      await set(newMessageRef,messageData);
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
