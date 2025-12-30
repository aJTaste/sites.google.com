// イベントハンドラー関連（Supabase版）

import{supabase}from'../common/core.js';
import{state,updateState,CHANNELS}from'./chat-state.js';
import{displayUsers,createChatHTML,createChannelChatHTML}from'./chat-ui.js';
import{loadMessages,loadChannelMessages,sendMessage}from'./chat-messages.js';
import{handleImageFile}from'./chat-utils.js';
import{canAccessChannel}from'../common/permissions.js';

// ユーザーを選択
export async function selectUser(userId){
  alert('selectUser呼び出し: '+userId);
  
  updateState('selectedUserId',userId);
  updateState('selectedChannelId',null);
  
  // 既読を更新
  await supabase
    .from('read_status')
    .upsert({
      user_id:state.currentUserId,
      target_id:userId,
      last_read_at:new Date().toISOString()
    });
  
  state.unreadCounts[userId]=0;
  displayUsers();
  
  const chatMain=document.getElementById('chat-main');
  const selectedUser=state.allUsers.find(u=>u.id===userId);
  
  if(!selectedUser){
    alert('エラー: ユーザーが見つかりません '+userId);
    console.error('選択されたユーザーが見つかりません:',userId);
    return;
  }
  
  alert('ユーザー情報取得成功: '+selectedUser.display_name);
  
  chatMain.innerHTML=createChatHTML(selectedUser);
  setupChatInput();
  
  alert('loadMessages呼び出し前');
  await loadMessages(userId);
  alert('loadMessages呼び出し後');
}

// チャンネルを選択
export async function selectChannel(channelId){
  const channel=CHANNELS.find(c=>c.id===channelId);
  
  if(!channel){
    console.error('選択されたチャンネルが見つかりません:',channelId);
    return;
  }
  
  if(!canAccessChannel(state.currentProfile.role,channel.requiredRole)){
    alert('このチャンネルへのアクセス権限がありません');
    return;
  }
  
  updateState('selectedChannelId',channelId);
  updateState('selectedUserId',null);
  
  // 既読を更新
  await supabase
    .from('read_status')
    .upsert({
      user_id:state.currentUserId,
      target_id:channelId,
      last_read_at:new Date().toISOString()
    });
  
  state.unreadCounts[channelId]=0;
  displayUsers();
  
  const chatMain=document.getElementById('chat-main');
  chatMain.innerHTML=createChannelChatHTML(channel);
  setupChatInput();
  await loadChannelMessages(channelId);
}

// window経由で関数を公開
window.selectUser=selectUser;
window.selectChannel=selectChannel;

// チャット入力のセットアップ
function setupChatInput(){
  const chatInput=document.getElementById('chat-input');
  if(!chatInput)return;
  
  chatInput.addEventListener('input',()=>{
    chatInput.style.height='auto';
    chatInput.style.height=Math.min(chatInput.scrollHeight,120)+'px';
    
    // 入力中状態を送信
    updateTypingStatus(true);
  });
  
  chatInput.addEventListener('keydown',(e)=>{
    if(e.key==='Enter'&&!e.shiftKey){
      e.preventDefault();
      if(!state.isSending){
        sendMessage();
        updateTypingStatus(false);
      }
    }
  });
  
  // 入力停止を検知
  chatInput.addEventListener('blur',()=>{
    updateTypingStatus(false);
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
        updateTypingStatus(false);
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

// 入力中状態を更新
async function updateTypingStatus(isTyping){
  if(state.typingTimeout){
    clearTimeout(state.typingTimeout);
  }
  
  const targetId=state.selectedUserId||state.selectedChannelId;
  if(!targetId)return;
  
  try{
    await supabase
      .from('typing_status')
      .upsert({
        user_id:state.currentUserId,
        target_id:targetId,
        is_typing:isTyping,
        updated_at:new Date().toISOString()
      });
    
    // 3秒後に自動的にfalseにする
    if(isTyping){
      state.typingTimeout=setTimeout(()=>{
        updateTypingStatus(false);
      },3000);
    }
  }catch(error){
    console.error('入力中状態更新エラー:',error);
  }
}

// エスケープ処理
function escapeForAttribute(text){
  if(!text)return'';
  return text
    .replace(/&/g,'&amp;')
    .replace(/'/g,'&apos;')
    .replace(/"/g,'&quot;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;');
}

function unescapeFromAttribute(text){
  if(!text)return'';
  return text
    .replace(/&apos;/g,"'")
    .replace(/&quot;/g,'"')
    .replace(/&lt;/g,'<')
    .replace(/&gt;/g,'>')
    .replace(/&amp;/g,'&');
}

// グローバル関数
window.openImageModal=function(imageUrl){
  document.getElementById('image-modal-img').src=imageUrl;
  document.getElementById('image-modal').classList.add('show');
}

window.replyMessage=function(messageId,text,senderId){
  updateState('replyToMessage',{id:messageId,text:unescapeFromAttribute(text),senderId:senderId});
  document.getElementById('reply-preview-text').textContent=unescapeFromAttribute(text).substring(0,100);
  document.getElementById('reply-preview').classList.add('show');
  document.getElementById('chat-input').focus();
}

window.editMessage=function(messageId,text,isDM){
  updateState('editingMessageId',messageId);
  updateState('editingIsDM',isDM);
  document.getElementById('edit-textarea').value=unescapeFromAttribute(text);
  document.getElementById('edit-modal').classList.add('show');
}

window.deleteMessage=function(messageId,isDM){
  updateState('editingMessageId',messageId);
  updateState('editingIsDM',isDM);
  document.getElementById('delete-modal').classList.add('show');
}