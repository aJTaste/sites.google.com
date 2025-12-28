// イベントハンドラー（Supabase版）

import{supabase}from'../common/core.js';
import{state,updateState,resetMessageState,CHANNELS}from'./chat-state.js';
import{displayUsers,createChatHTML,createChannelChatHTML}from'./chat-ui.js';
import{loadDMMessages,loadChannelMessages,sendMessage}from'./chat-messages.js';
import{subscribeDMMessages,subscribeChannelMessages,subscribeTypingStatus,unsubscribeAll,updateReadStatus,sendTypingStatus}from'./chat-realtime.js';
import{canAccessChannel}from'../common/permissions.js';

// ユーザーを選択
export async function selectUser(userId){
  updateState('selectedUserId',userId);
  updateState('selectedChannelId',null);
  
  // 既読を更新
  await updateReadStatus(userId);
  state.unreadCounts[userId]=0;
  
  displayUsers();
  
  const chatMain=document.getElementById('chat-main');
  const selectedProfile=state.allProfiles.find(u=>u.id===userId);
  
  if(!selectedProfile){
    console.error('選択されたユーザーが見つかりません:',userId);
    return;
  }
  
  chatMain.innerHTML=createChatHTML(selectedProfile);
  setupChatInput();
  
  // リアルタイム監視を開始
  unsubscribeAll();
  const dmId=[state.currentProfile.id,userId].sort().join('_');
  subscribeDMMessages(dmId);
  subscribeTypingStatus();
  
  // メッセージ読み込み
  await loadDMMessages(userId);
}

// チャンネルを選択
export async function selectChannel(channelId){
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
  
  // 既読を更新
  await updateReadStatus(channelId);
  state.unreadCounts[channelId]=0;
  
  displayUsers();
  
  const chatMain=document.getElementById('chat-main');
  chatMain.innerHTML=createChannelChatHTML(channel);
  setupChatInput();
  
  // リアルタイム監視を開始
  unsubscribeAll();
  subscribeChannelMessages(channelId);
  subscribeTypingStatus();
  
  // メッセージ読み込み
  await loadChannelMessages(channelId);
}

// window経由で関数を公開
window.selectUser=selectUser;
window.selectChannel=selectChannel;

// チャット入力のセットアップ
function setupChatInput(){
  const chatInput=document.getElementById('chat-input');
  if(!chatInput)return;
  
  // 自動リサイズ
  chatInput.addEventListener('input',()=>{
    chatInput.style.height='auto';
    chatInput.style.height=Math.min(chatInput.scrollHeight,120)+'px';
    
    // 入力中ステータスを送信
    if(chatInput.value.trim()){
      sendTypingStatus(true);
    }else{
      sendTypingStatus(false);
    }
  });
  
  // Enterキーで送信
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
        handleImageFile(file);
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

// 画像ファイルを処理
function handleImageFile(file){
  if(!file.type.startsWith('image/')){
    alert('画像ファイルを選択してください');
    return;
  }
  
  if(file.size>2*1024*1024){
    alert('画像サイズは2MB以下にしてください');
    return;
  }
  
  const reader=new FileReader();
  reader.onload=(e)=>{
    updateState('selectedImage',e.target.result);
    document.getElementById('image-preview').src=e.target.result;
    document.getElementById('image-preview-container').classList.add('show');
  };
  reader.readAsDataURL(file);
}

// グローバル関数（メッセージ操作）
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

window.editMessage=async function(messageId,messageType,text,isDM){
  const newText=prompt('新しいメッセージを入力:',text);
  if(!newText||newText===text)return;
  
  try{
    const table=isDM?'dm_messages':'channel_messages';
    const{error}=await supabase
      .from(table)
      .update({
        text:newText,
        edited_at:new Date().toISOString()
      })
      .eq('id',messageId);
    
    if(error)throw error;
    
    // メッセージを再読み込み
    if(state.selectedUserId){
      await loadDMMessages(state.selectedUserId);
    }else if(state.selectedChannelId){
      await loadChannelMessages(state.selectedChannelId);
    }
  }catch(error){
    console.error('編集エラー:',error);
    alert('編集に失敗しました');
  }
}

window.deleteMessage=async function(messageId,messageType,isDM){
  if(!confirm('このメッセージを削除しますか？'))return;
  
  try{
    const table=isDM?'dm_messages':'channel_messages';
    const{error}=await supabase
      .from(table)
      .delete()
      .eq('id',messageId);
    
    if(error)throw error;
    
    // メッセージを再読み込み
    if(state.selectedUserId){
      await loadDMMessages(state.selectedUserId);
    }else if(state.selectedChannelId){
      await loadChannelMessages(state.selectedChannelId);
    }
  }catch(error){
    console.error('削除エラー:',error);
    alert('削除に失敗しました');
  }
}

// モーダル閉じる
document.addEventListener('DOMContentLoaded',()=>{
  const imageModal=document.getElementById('image-modal');
  const imageModalClose=document.getElementById('image-modal-close');
  
  if(imageModalClose){
    imageModalClose.addEventListener('click',()=>{
      imageModal.classList.remove('show');
    });
  }
  
  if(imageModal){
    imageModal.addEventListener('click',(e)=>{
      if(e.target===imageModal){
        imageModal.classList.remove('show');
      }
    });
  }
});