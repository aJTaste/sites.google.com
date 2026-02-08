// イベントハンドラー関連（Supabase版）- 入力中表示機能追加

import{supabase}from'../common/supabase-config.js';
import{state,updateState,CHANNELS}from'./chat-state.js';
import{displayUsers,createChatHTML,createChannelChatHTML}from'./chat-ui.js';
import{loadMessages,loadChannelMessages,sendMessage}from'./chat-messages.js';
import{handleImageFile}from'./chat-utils.js';
import{canAccessChannel}from'../common/permissions.js';

console.log('chat-handlers.js読み込み開始');

// ========================================
// 入力中表示の管理
// ========================================

let typingTimeout=null;
let typingCheckInterval=null;

// 入力中状態を送信
async function sendTypingStatus(isTyping){
  const targetId=state.selectedUserId||state.selectedChannelId;
  if(!targetId)return;
  
  try{
    await supabase
      .from('typing_status')
      .upsert({
        user_id:state.currentProfile.id,
        target_id:targetId,
        is_typing:isTyping,
        updated_at:new Date().toISOString()
      },{onConflict:'user_id,target_id'});
  }catch(error){
    console.error('入力中ステータス送信エラー:',error);
  }
}

// 入力中状態を監視
function startTypingMonitor(targetId){
  // 既存の監視を停止
  if(typingCheckInterval){
    clearInterval(typingCheckInterval);
  }
  
  // 3秒ごとに入力中状態をチェック
  typingCheckInterval=setInterval(async()=>{
    try{
      const{data:typingUsers,error}=await supabase
        .from('typing_status')
        .select('user_id,is_typing,updated_at')
        .eq('target_id',targetId)
        .eq('is_typing',true)
        .neq('user_id',state.currentProfile.id);
      
      if(error)throw error;
      
      // 古い入力中ステータスを除外（10秒以上前）
      const now=Date.now();
      const activeTyping=(typingUsers||[]).filter(t=>{
        const updatedAt=new Date(t.updated_at).getTime();
        return now-updatedAt<10000;
      });
      
      displayTypingIndicator(activeTyping);
    }catch(error){
      console.error('入力中状態チェックエラー:',error);
    }
  },3000);
}

// 入力中インジケーターを表示
function displayTypingIndicator(typingUsers){
  const chatMessages=document.getElementById('chat-messages');
  if(!chatMessages)return;
  
  // 既存のインジケーターを削除
  const existing=chatMessages.querySelector('.typing-indicator');
  if(existing){
    existing.remove();
  }
  
  if(typingUsers.length===0)return;
  
  // ユーザー名を取得
  const names=typingUsers.map(t=>{
    const user=state.allUsers.find(u=>u.id===t.user_id);
    return user?user.display_name:'誰か';
  });
  
  // インジケーターを作成
  const indicator=document.createElement('div');
  indicator.className='typing-indicator';
  
  if(names.length===1){
    indicator.innerHTML=`
      <span class="typing-text">${names[0]} が入力中</span>
      <span class="typing-dots">
        <span>.</span><span>.</span><span>.</span>
      </span>
    `;
  }else{
    indicator.innerHTML=`
      <span class="typing-text">${names.length} 人が入力中</span>
      <span class="typing-dots">
        <span>.</span><span>.</span><span>.</span>
      </span>
    `;
  }
  
  chatMessages.appendChild(indicator);
  
  // スクロールを最下部に
  chatMessages.scrollTop=chatMessages.scrollHeight;
}

// ========================================
// ユーザーを選択
// ========================================

export async function selectUser(userId){
  console.log('selectUser()実行:',userId);
  updateState('selectedUserId',userId);
  updateState('selectedChannelId',null);
  
  // 入力中モニター開始
  startTypingMonitor(userId);
  
  // 既読を更新
  await supabase
    .from('read_status')
    .upsert({
      user_id:state.currentProfile.id,
      target_id:userId,
      last_read_at:new Date().toISOString()
    },{onConflict:'user_id,target_id'});
  
  state.unreadCounts[userId]=0;
  
  displayUsers();
  
  const chatMain=document.getElementById('chat-main');
  const selectedUser=state.allUsers.find(u=>u.user_id===userId);
  
  if(!selectedUser){
    console.error('選択されたユーザーが見つかりません:',userId);
    return;
  }
  
  chatMain.innerHTML=createChatHTML(selectedUser);
  setupChatInput();
  loadMessages(userId);
}

// ========================================
// チャンネルを選択
// ========================================

export async function selectChannel(channelId){
  console.log('selectChannel()実行:',channelId);
  
  const channel=CHANNELS.find(c=>c.id===channelId);
  
  if(!channel){
    console.error('選択されたチャンネルが見つかりません:',channelId);
    return;
  }
  
  // 権限チェック
  if(!canAccessChannel(state.currentProfile.role,channel.requiredRole)){
    alert('このチャンネルへのアクセス権限がありません');
    return;
  }
  
  updateState('selectedChannelId',channelId);
  updateState('selectedUserId',null);
  
  // 入力中モニター開始
  startTypingMonitor(channelId);
  
  // 既読を更新
  await supabase
    .from('read_status')
    .upsert({
      user_id:state.currentProfile.id,
      target_id:channelId,
      last_read_at:new Date().toISOString()
    },{onConflict:'user_id,target_id'});
  
  state.unreadCounts[channelId]=0;
  
  displayUsers();
  
  const chatMain=document.getElementById('chat-main');
  chatMain.innerHTML=createChannelChatHTML(channel);
  setupChatInput();
  loadChannelMessages(channelId);
}

// window経由で関数を公開（循環参照を避けるため）
window.selectUser=selectUser;
window.selectChannel=selectChannel;

// ========================================
// チャット入力のセットアップ
// ========================================

function setupChatInput(){
  const chatInput=document.getElementById('chat-input');
  if(!chatInput){
    console.error('chat-inputが見つかりません');
    return;
  }
  
  // 入力中ステータスの送信
  chatInput.addEventListener('input',async()=>{
    chatInput.style.height='auto';
    chatInput.style.height=Math.min(chatInput.scrollHeight,120)+'px';
    
    // 入力中ステータスを送信
    await sendTypingStatus(true);
    
    // 3秒後に入力中を解除
    if(typingTimeout)clearTimeout(typingTimeout);
    typingTimeout=setTimeout(async()=>{
      await sendTypingStatus(false);
    },3000);
  });
  
  chatInput.addEventListener('keydown',(e)=>{
    if(e.key==='Enter'&&!e.shiftKey){
      e.preventDefault();
      if(!state.isSending){
        sendMessage();
        // 入力中ステータスを解除
        sendTypingStatus(false);
      }
    }
  });
  
  // クリップボードから画像を貼り付け
  chatInput.addEventListener('paste',(e)=>{
    const items=e.clipboardData.items;
    for(let i=0;i<items.length;i++){
      if(items[i].type.indexOf('image')!==-1){
        const file=items[i].getAsFile();
        handleImageFile(file,(base64)=>{
          updateState('selectedImage',base64);
          document.getElementById('image-preview').src=base64;
          document.getElementById('image-preview-container').classList.add('show');
        });
        e.preventDefault();
        break;
      }
    }
  });
  
  const sendBtn=document.getElementById('send-btn');
  if(sendBtn){
    sendBtn.addEventListener('click',()=>{
      if(!state.isSending){
        sendMessage();
        // 入力中ステータスを解除
        sendTypingStatus(false);
      }
    });
  }
  
  // 画像添付ボタン
  const attachImageBtn=document.getElementById('attach-image-btn');
  const imageFileInput=document.getElementById('image-file-input');
  
  if(attachImageBtn&&imageFileInput){
    attachImageBtn.addEventListener('click',()=>{
      imageFileInput.click();
    });
    
    imageFileInput.addEventListener('change',(e)=>{
      const file=e.target.files[0];
      if(file){
        handleImageFile(file,(base64)=>{
          updateState('selectedImage',base64);
          document.getElementById('image-preview').src=base64;
          document.getElementById('image-preview-container').classList.add('show');
        });
      }
    });
  }
  
  // 画像プレビュー削除
  const imagePreviewClose=document.getElementById('image-preview-close');
  if(imagePreviewClose){
    imagePreviewClose.addEventListener('click',()=>{
      updateState('selectedImage',null);
      document.getElementById('image-preview-container').classList.remove('show');
    });
  }
  
  // リプライプレビュー削除
  const replyPreviewClose=document.getElementById('reply-preview-close');
  if(replyPreviewClose){
    replyPreviewClose.addEventListener('click',()=>{
      updateState('replyToMessage',null);
      document.getElementById('reply-preview').classList.remove('show');
    });
  }
}

// グローバル関数（window経由で呼び出し）
window.openImageModal=function(imageUrl){
  document.getElementById('image-modal-img').src=imageUrl;
  document.getElementById('image-modal').classList.add('show');
}

window.replyMessage=function(messageId,text,senderId){
  updateState('replyToMessage',{id:messageId,text:text,senderId:senderId});
  document.getElementById('reply-preview-text').textContent=text.substring(0,100);
  document.getElementById('reply-preview').classList.add('show');
  document.getElementById('chat-input').focus();
}

window.editMessage=function(messageId,text,isDM){
  updateState('editingMessageId',messageId);
  updateState('editingIsDM',isDM);
  document.getElementById('edit-textarea').value=text;
  document.getElementById('edit-modal').classList.add('show');
}

window.deleteMessage=function(messageId,isDM){
  updateState('editingMessageId',messageId);
  updateState('editingIsDM',isDM);
  document.getElementById('delete-modal').classList.add('show');
}

console.log('chat-handlers.js読み込み完了');