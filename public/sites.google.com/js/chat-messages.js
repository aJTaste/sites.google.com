// メッセージ表示・送信関連（アカウントIDベース）

import{database}from'../common/firebase-config.js';
import{ref,get,set,push,onValue,off,update}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import{state,updateState,resetMessageState}from'./chat-state.js';
import{getDmId,formatMessageTime,escapeHtml,showNotification}from'./chat-utils.js';

// メッセージを読み込み（DM）
export function loadMessages(accountId){
  if(state.messageListener){
    off(state.messageListener);
  }
  
  const dmId=getDmId(state.currentAccountId,accountId);
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
        if(latestMsg.senderId===accountId){
          const sender=state.allUsers.find(u=>u.accountId===accountId);
          if(sender){
            showNotification(
              `${sender.username}からのメッセージ`,
              latestMsg.text||'画像を送信しました',
              sender.iconUrl&&sender.iconUrl!=='default'?sender.iconUrl:'assets/github-mark.svg'
            );
          }
        }
      }
      
      // 全メッセージを順番に表示（awaitを使って順番に処理）
      for(const msg of messageArray){
        await displayMessage(msg,accountId);
      }
      
      // スクロール位置を調整
      if(isFirstLoad||wasAtBottom){
        setTimeout(()=>{
          chatMessages.scrollTop=chatMessages.scrollHeight;
        },10);
      }
      
      // 既読を更新（チャットを開いている間は常に既読にする）
      if(!isFirstLoad){
        await update(ref(database,`users/${state.currentAccountId}/lastRead`),{
          [accountId]:Date.now()
        });
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
        if(latestMsg.senderId!==state.currentAccountId){
          const sender=state.allUsers.find(u=>u.accountId===latestMsg.senderId);
          const senderName=sender?sender.username:'誰か';
          const channel={name:channelId};
          showNotification(
            `${channel.name}: ${senderName}`,
            latestMsg.text||'画像を送信しました',
            sender&&sender.iconUrl&&sender.iconUrl!=='default'?sender.iconUrl:'assets/github-mark.svg'
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
      
      // 既読を更新（チャットを開いている間は常に既読にする）
      if(!isFirstLoad){
        await update(ref(database,`users/${state.currentAccountId}/lastRead`),{
          [channelId]:Date.now()
        });
      }
      
      isFirstLoad=false;
    }
  });
}

// メッセージを表示（DM）- 既読状態を後から更新
async function displayMessage(msg,otherAccountId){
  const chatMessages=document.getElementById('chat-messages');
  if(!chatMessages)return;
  
  const isCurrentUser=msg.senderId===state.currentAccountId;
  
  let senderData;
  if(isCurrentUser){
    senderData=state.currentUserData;
  }else{
    senderData=state.allUsers.find(u=>u.accountId===msg.senderId);
  }
  
  if(!senderData)return;
  
  const iconUrl=senderData.iconUrl&&senderData.iconUrl!=='default'?senderData.iconUrl:'assets/github-mark.svg';
  
  // 操作ボタン（全てのメッセージにリプライ可能、自分のメッセージは編集・削除も）
  const dmId=getDmId(state.currentAccountId,otherAccountId);
  let actionsHtml=`
    <div class="message-actions">
      <button class="message-action-btn" onclick="window.replyMessage('${msg.id}','${escapeHtml(msg.text).replace(/'/g,"\\'")}','${msg.senderId}')" title="返信">
        <span class="material-symbols-outlined">reply</span>
      </button>
  `;
  
  if(isCurrentUser){
    actionsHtml+=`
      <button class="message-action-btn" onclick="window.editMessage('${msg.id}','${dmId}','${escapeHtml(msg.text).replace(/'/g,"\\'")}',true)" title="編集">
        <span class="material-symbols-outlined">edit</span>
      </button>
      <button class="message-action-btn delete" onclick="window.deleteMessage('${msg.id}','${dmId}',true)" title="削除">
        <span class="material-symbols-outlined">delete</span>
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
    updateReadStatus(msg.id,msg.timestamp,otherAccountId);
  }
}

// 既読状態を更新（非同期・DOM追加後）
async function updateReadStatus(messageId,timestamp,otherAccountId){
  try{
    const otherUserRef=ref(database,`users/${otherAccountId}/lastRead/${state.currentAccountId}`);
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
  if(msg.senderId===state.currentAccountId){
    senderData=state.currentUserData;
  }else{
    senderData=state.allUsers.find(u=>u.accountId===msg.senderId);
  }
  
  if(!senderData)return;
  
  const iconUrl=senderData.iconUrl&&senderData.iconUrl!=='default'?senderData.iconUrl:'assets/github-mark.svg';
  
  // 操作ボタン（全てのメッセージにリプライ可能、自分のメッセージは編集・削除も）
  const isCurrentUser=msg.senderId===state.currentAccountId;
  let actionsHtml=`
    <div class="message-actions">
      <button class="message-action-btn" onclick="window.replyMessage('${msg.id}','${escapeHtml(msg.text).replace(/'/g,"\\'")}','${msg.senderId}')" title="返信">
        <span class="material-symbols-outlined">reply</span>
      </button>
  `;
  
  if(isCurrentUser){
    actionsHtml+=`
      <button class="message-action-btn" onclick="window.editMessage('${msg.id}','${state.selectedChannelId}','${escapeHtml(msg.text).replace(/'/g,"\\'")}',false)" title="編集">
        <span class="material-symbols-outlined">edit</span>
      </button>
      <button class="message-action-btn delete" onclick="window.deleteMessage('${msg.id}','${state.selectedChannelId}',false)" title="削除">
        <span class="material-symbols-outlined">delete</span>
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
  if(!state.selectedAccountId&&!state.selectedChannelId)return;
  
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
      senderId:state.currentAccountId,
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
    
    if(state.selectedAccountId){
      const dmId=getDmId(state.currentAccountId,state.selectedAccountId);
      const messagesRef=ref(database,`dms/${dmId}/messages`);
      const newMessageRef=push(messagesRef);
      
      await set(newMessageRef,messageData);
      
      const participantsRef=ref(database,`dms/${dmId}/participants`);
      const participantsSnapshot=await get(participantsRef);
      
      if(!participantsSnapshot.exists()){
        await set(participantsRef,{
          [state.currentAccountId]:true,
          [state.selectedAccountId]:true
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