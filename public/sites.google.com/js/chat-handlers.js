// チャットイベント処理（Supabase版）
import{supabase}from'../common/core.js';
import{state,updateState,CHANNELS}from'./chat-state.js';
import{displayUsers,createChatHTML,createChannelChatHTML}from'./chat-ui.js';
import{loadMessages,loadChannelMessages,sendMessage}from'./chat-messages.js';
import{canAccessChannel}from'../common/permissions.js';

// ユーザーを選択
export async function selectUser(userId){
  updateState('selectedUserId',userId);
  updateState('selectedChannelId',null);
  
  // 既読を更新
  await supabase
    .from('read_status')
    .upsert({
      user_id:state.currentProfile.id,
      target_id:state.allUsers.find(u=>u.id===userId).user_id,
      last_read_at:new Date().toISOString()
    });
  
  // 未読をリセット
  const targetUser=state.allUsers.find(u=>u.id===userId);
  if(targetUser){
    state.unreadCounts[targetUser.user_id]=0;
  }
  
  displayUsers();
  
  const chatMain=document.getElementById('chat-main');
  const selectedUser=state.allUsers.find(u=>u.id===userId);
  
  if(!selectedUser){
    console.error('選択されたユーザーが見つかりません');
    return;
  }
  
  chatMain.innerHTML=createChatHTML(selectedUser);
  setupChatInput();
  loadMessages(userId);
}

// チャンネルを選択
export async function selectChannel(channelId){
  const channel=CHANNELS.find(c=>c.id===channelId);
  
  if(!channel){
    console.error('選択されたチャンネルが見つかりません');
    return;
  }
  
  // 権限チェック
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
      user_id:state.currentProfile.id,
      target_id:channelId,
      last_read_at:new Date().toISOString()
    });
  
  // 未読をリセット
  state.unreadCounts[channelId]=0;
  
  displayUsers();
  
  const chatMain=document.getElementById('chat-main');
  chatMain.innerHTML=createChannelChatHTML(channel);
  setupChatInput();
  loadChannelMessages(channelId);
}

// チャット入力のセットアップ
function setupChatInput(){
  const chatInput=document.getElementById('chat-input');
  if(!chatInput)return;
  
  // 自動リサイズ
  chatInput.addEventListener('input',()=>{
    chatInput.style.height='auto';
    chatInput.style.height=Math.min(chatInput.scrollHeight,120)+'px';
    
    // 入力中状態を送信
    sendTypingStatus(true);
    
    // 3秒後に入力中を解除
    if(state.typingTimeout){
      clearTimeout(state.typingTimeout);
    }
    state.typingTimeout=setTimeout(()=>{
      sendTypingStatus(false);
    },3000);
  });
  
  // Enterで送信
  chatInput.addEventListener('keydown',(e)=>{
    if(e.key==='Enter'&&!e.shiftKey){
      e.preventDefault();
      if(!state.isSending){
        sendMessage();
        sendTypingStatus(false);
      }
    }
  });
  
  // クリップボードから画像貼り付け
  chatInput.addEventListener('paste',(e)=>{
    const items=e.clipboardData.items;
    for(let i=0;i<items.length;i++){
      if(items[i].type.indexOf('image')!==-1){
        const file=items[i].getAsFile();
        handleImageFile(file);
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
        sendTypingStatus(false);
      }
    });
  }
  
  // 画像添付
  const attachImageBtn=document.getElementById('attach-image-btn');
  const imageFileInput=document.getElementById('image-file-input');
  
  if(attachImageBtn&&imageFileInput){
    attachImageBtn.addEventListener('click',()=>{
      imageFileInput.click();
    });
    
    imageFileInput.addEventListener('change',(e)=>{
      const file=e.target.files[0];
      if(file){
        handleImageFile(file);
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

// 画像ファイル処理
function handleImageFile(file){
  if(!file.type.startsWith('image/')){
    alert('画像ファイルを選択してください');
    return;
  }
  
  if(file.size>2*1024*1024){
    alert('画像サイズは2MB以下にしてください');
    return;
  }
  
  updateState('selectedImage',file);
  
  const reader=new FileReader();
  reader.onload=(e)=>{
    document.getElementById('image-preview').src=e.target.result;
    document.getElementById('image-preview-container').classList.add('show');
  };
  reader.readAsDataURL(file);
}

// 入力中状態を送信
async function sendTypingStatus(isTyping){
  if(!state.selectedUserId&&!state.selectedChannelId)return;
  
  const targetId=state.selectedChannelId||state.allUsers.find(u=>u.id===state.selectedUserId)?.user_id;
  if(!targetId)return;
  
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
    console.error('入力中状態の送信エラー:',error);
  }
}

// グローバル関数
window.replyMessage=function(messageId,text,senderId){
  updateState('replyToMessage',{id:messageId,text:text,senderId:senderId});
  document.getElementById('reply-preview-text').textContent=text.substring(0,100);
  document.getElementById('reply-preview').classList.add('show');
  document.getElementById('chat-input').focus();
}

window.editMessage=function(messageId,isDM){
  // 編集機能は一旦簡易実装（モーダルなし、プロンプトで編集）
  const newText=prompt('新しいメッセージを入力してください:');
  if(!newText||!newText.trim())return;
  
  const table=isDM?'dm_messages':'channel_messages';
  
  supabase
    .from(table)
    .update({
      text:newText.trim(),
      edited_at:new Date().toISOString()
    })
    .eq('id',messageId)
    .then(({error})=>{
      if(error){
        console.error('編集エラー:',error);
        alert('編集に失敗しました');
      }
    });
}

window.deleteMessage=function(messageId,isDM){
  if(!confirm('このメッセージを削除しますか？'))return;
  
  const table=isDM?'dm_messages':'channel_messages';
  
  supabase
    .from(table)
    .delete()
    .eq('id',messageId)
    .then(({error})=>{
      if(error){
        console.error('削除エラー:',error);
        alert('削除に失敗しました');
      }
    });
}

window.openImageModal=function(imageUrl){
  document.getElementById('image-modal-img').src=imageUrl;
  document.getElementById('image-modal').classList.add('show');
}