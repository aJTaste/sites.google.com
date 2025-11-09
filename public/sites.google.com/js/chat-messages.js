// メッセージ表示・送信関連（デバッグ版）

import{database}from'../common/firebase-config.js';
import{ref,get,set,push,onValue,off}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import{state,updateState,resetMessageState}from'./chat-state.js';
import{getDmId,formatMessageTime,escapeHtml,showNotification}from'./chat-utils.js';

// デバッグ用：画面にメッセージ順を表示
function showDebugInfo(messages){
  const debugInfo=document.createElement('div');
  debugInfo.style.cssText='position:fixed;bottom:10px;left:10px;background:rgba(0,0,0,0.9);color:#0f0;padding:10px;font-family:monospace;font-size:11px;z-index:9999;border-radius:5px;max-width:400px;';
  debugInfo.innerHTML='<strong>メッセージ順序:</strong><br>';
  messages.forEach((msg,index)=>{
    const time=new Date(msg.timestamp).toLocaleTimeString();
    const sender=msg.senderId===state.currentUser.uid?'自分':'相手';
    debugInfo.innerHTML+=`${index+1}. ${sender} ${time} - ${msg.text.substring(0,20)}<br>`;
  });
  
  const oldDebug=document.querySelector('[data-debug-info]');
  if(oldDebug)oldDebug.remove();
  debugInfo.setAttribute('data-debug-info','true');
  document.body.appendChild(debugInfo);
}

// メッセージを読み込み（DM）
export function loadMessages(userId){
  if(state.messageListener){
    off(state.messageListener);
  }
  
  const dmId=getDmId(state.currentUser.uid,userId);
  const messagesRef=ref(database,`dms/${dmId}/messages`);
  
  updateState('messageListener',messagesRef);
  
  let isFirstLoad=true;
  
  onValue(messagesRef,(snapshot)=>{
    const chatMessages=document.getElementById('chat-messages');
    if(!chatMessages)return;
    
    const wasAtBottom=chatMessages.scrollHeight-chatMessages.scrollTop<=chatMessages.clientHeight+50;
    
    chatMessages.innerHTML='';
    
    if(snapshot.exists()){
      const messages=snapshot.val();
      
      console.log('===== Firebaseから取得した生データ =====');
      console.log(messages);
      
      const messageArray=Object.keys(messages).map(key=>({
        id:key,
        ...messages[key]
      }));
      
      console.log('===== ソート前のメッセージ配列 =====');
      messageArray.forEach((msg,i)=>{
        console.log(`${i}: ${new Date(msg.timestamp).toLocaleTimeString()} - ${msg.senderId===state.currentUser.uid?'自分':'相手'} - ${msg.text}`);
      });
      
      // タイムスタンプで昇順ソート（古いメッセージが上）
      messageArray.sort((a,b)=>{
        console.log(`比較: ${a.timestamp} vs ${b.timestamp} = ${a.timestamp-b.timestamp}`);
        return a.timestamp-b.timestamp;
      });
      
      console.log('===== ソート後のメッセージ配列 =====');
      messageArray.forEach((msg,i)=>{
        console.log(`${i}: ${new Date(msg.timestamp).toLocaleTimeString()} - ${msg.senderId===state.currentUser.uid?'自分':'相手'} - ${msg.text}`);
      });
      
      // デバッグ情報を画面に表示
      showDebugInfo(messageArray);
      
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
      
      console.log('===== メッセージをDOMに追加開始 =====');
      // 全メッセージを順番に表示
      messageArray.forEach((msg,index)=>{
        console.log(`${index}番目のメッセージを追加: ${msg.text}`);
        displayMessage(msg,userId);
      });
      console.log('===== メッセージをDOMに追加完了 =====');
      
      // スクロール位置を調整
      if(isFirstLoad||wasAtBottom){
        setTimeout(()=>{
          chatMessages.scrollTop=chatMessages.scrollHeight;
        },0);
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
      
      // デバッグ情報を画面に表示
      showDebugInfo(messageArray);
      
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
        },0);
      }
      
      isFirstLoad=false;
    }
  });
}

// メッセージを表示（DM）
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
  
  // 既読状態を取得
  let readStatus='';
  if(isCurrentUser){
    try{
      const otherUserRef=ref(database,`users/${otherUserId}/lastRead/${state.currentUser.uid}`);
      const readSnapshot=await get(otherUserRef);
      if(readSnapshot.exists()){
        const lastReadTime=readSnapshot.val();
        if(msg.timestamp<=lastReadTime){
          readStatus='<span class="message-read">✓ 既読</span>';
        }
      }
    }catch(error){
      console.error('既読状態取得エラー:',error);
    }
  }
  
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
        ${readStatus}
      </div>
      ${msg.replyTo?`<div class="message-reply">返信: ${escapeHtml(msg.replyTo.text).substring(0,50)}...</div>`:''}
      <div class="message-text">${escapeHtml(msg.text)}</div>
      ${msg.imageUrl?`<img class="message-image" src="${msg.imageUrl}" alt="画像" onclick="window.openImageModal('${msg.imageUrl}')">`:''}
      ${msg.editedAt?`<div class="message-edited">(編集済み)</div>`:''}
    </div>
    ${actionsHtml}
  `;
  
  console.log(`appendChild実行: ${msg.text} (timestamp: ${msg.timestamp})`);
  chatMessages.appendChild(messageEl);
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
    
    console.log('送信するメッセージ:',messageData);
    
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
