// イベントハンドラー関連（Supabase版）

import{supabase}from'../common/core.js';
import{state,updateState,CHANNELS}from'./chat-state.js';
import{displayUsers,createChatHTML,createChannelChatHTML}from'./chat-ui.js';
import{loadMessages,loadChannelMessages,sendMessage,sendTypingStatus}from'./chat-messages.js';
import{handleImageFile}from'./chat-utils.js';
import{canAccessChannel}from'../common/permissions.js';

console.log('chat-handlers.js読み込み開始');

// ユーザーを選択
export async function selectUser(targetUserId){
  console.log('selectUser()実行:',targetUserId);
  updateState('selectedUserId',targetUserId);
  updateState('selectedChannelId',null);
  
  displayUsers();
  
  const chatMain=document.getElementById('chat-main');
  const selectedUser=state.allUsers.find(u=>u.user_id===targetUserId);
  
  if(!selectedUser){
    console.error('選択されたユーザーが見つかりません:',targetUserId);
    return;
  }
  
  chatMain.innerHTML=createChatHTML(selectedUser);
  setupChatInput();
  loadMessages(targetUserId);
}

// チャンネルを選択
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
  
  displayUsers();
  
  const chatMain=document.getElementById('chat-main');
  chatMain.innerHTML=createChannelChatHTML(channel);
  setupChatInput();
  loadChannelMessages(channelId);
}

// window経由で関数を公開
window.selectUser=selectUser;
window.selectChannel=selectChannel;

// チャット入力のセットアップ
function setupChatInput(){
  const chatInput=document.getElementById('chat-input');
  if(!chatInput){
    console.error('chat-inputが見つかりません');
    return;
  }
  
  // 高さ自動調整
  chatInput.addEventListener('input',()=>{
    chatInput.style.height='auto';
    chatInput.style.height=Math.min(chatInput.scrollHeight,120)+'px';
    
    // 入力中状態を送信
    handleTyping();
  });
  
  // Enterで送信
  chatInput.addEventListener('keydown',(e)=>{
    if(e.key==='Enter'&&!e.shiftKey){
      e.preventDefault();
      if(!state.isSending){
        sendMessage();
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
  
  // 送信ボタン
  const sendBtn=document.getElementById('send-btn');
  if(sendBtn){
    sendBtn.addEventListener('click',()=>{
      if(!state.isSending){
        sendMessage();
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

// 入力中状態を処理
function handleTyping(){
  const targetId=state.selectedUserId||state.selectedChannelId;
  if(!targetId)return;
  
  // 既存のタイムアウトをクリア
  if(state.typingTimeout){
    clearTimeout(state.typingTimeout);
  }
  
  // 入力中状態を送信
  sendTypingStatus(targetId,true);
  
  // 3秒後に入力中状態をクリア
  const timeout=setTimeout(()=>{
    sendTypingStatus(targetId,false);
  },3000);
  
  updateState('typingTimeout',timeout);
}

// グローバル関数
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

window.editMessage=async function(messageId,pathId,text,isDM){
  const newText=prompt('メッセージを編集',text);
  if(!newText||newText===text)return;
  
  try{
    const tableName=isDM?'dm_messages':'channel_messages';
    const filterColumn=isDM?'dm_id':'channel_id';
    
    await supabase
      .from(tableName)
      .update({
        text:newText,
        edited_at:new Date().toISOString()
      })
      .eq('id',messageId);
    
  }catch(error){
    console.error('編集エラー:',error);
    alert('編集に失敗しました');
  }
}

window.deleteMessage=async function(messageId,pathId,isDM){
  if(!confirm('このメッセージを削除しますか？'))return;
  
  try{
    const tableName=isDM?'dm_messages':'channel_messages';
    
    await supabase
      .from(tableName)
      .delete()
      .eq('id',messageId);
    
  }catch(error){
    console.error('削除エラー:',error);
    alert('削除に失敗しました');
  }
}

console.log('chat-handlers.js読み込み完了');