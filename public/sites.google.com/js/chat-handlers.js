// イベントハンドラー関連

import{database}from'../common/firebase-config.js';
import{ref,update}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import{state,updateState,CHANNELS}from'./chat-state.js';
import{displayUsers,createChatHTML,createChannelChatHTML}from'./chat-ui.js';
import{loadMessages,loadChannelMessages,sendMessage}from'./chat-messages.js';
import{handleImageFile}from'./chat-utils.js';
import{canAccessChannel}from'../common/permissions.js';

console.log('chat-handlers.js読み込み開始');

// ユーザーを選択
export async function selectUser(accountId){
  console.log('selectUser()実行:',accountId);
  updateState('selectedAccountId',accountId);
  updateState('selectedChannelId',null);
  
  await update(ref(database,`users/${state.currentAccountId}/lastRead`),{
    [accountId]:Date.now()
  });
  
  state.unreadCounts[accountId]=0;
  
  displayUsers();
  
  const chatMain=document.getElementById('chat-main');
  const selectedUser=state.allUsers.find(u=>u.accountId===accountId);
  
  if(!selectedUser){
    console.error('選択されたユーザーが見つかりません:',accountId);
    return;
  }
  
  chatMain.innerHTML=createChatHTML(selectedUser);
  setupChatInput();
  loadMessages(accountId);
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
  if(!canAccessChannel(state.currentUserData.role,channel.requiredRole)){
    alert('このチャンネルへのアクセス権限がありません');
    return;
  }
  
  updateState('selectedChannelId',channelId);
  updateState('selectedAccountId',null);
  
  await update(ref(database,`users/${state.currentAccountId}/lastRead`),{
    [channelId]:Date.now()
  });
  
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

// チャット入力のセットアップ
function setupChatInput(){
  const chatInput=document.getElementById('chat-input');
  if(!chatInput){
    console.error('chat-inputが見つかりません');
    return;
  }
  
  chatInput.addEventListener('input',()=>{
    chatInput.style.height='auto';
    chatInput.style.height=Math.min(chatInput.scrollHeight,120)+'px';
  });
  
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

// エスケープ処理を改善（HTMLエンティティを正しく処理）
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

// グローバル関数（window経由で呼び出し）
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

window.editMessage=function(messageId,path,text,isDM){
  updateState('editingMessageId',messageId);
  updateState('editingMessagePath',isDM?`dms/${path}/messages/${messageId}`:`channels/${path}/messages/${messageId}`);
  document.getElementById('edit-textarea').value=unescapeFromAttribute(text);
  document.getElementById('edit-modal').classList.add('show');
}

window.deleteMessage=function(messageId,path,isDM){
  updateState('editingMessageId',messageId);
  updateState('editingMessagePath',isDM?`dms/${path}/messages/${messageId}`:`channels/${path}/messages/${messageId}`);
  document.getElementById('delete-modal').classList.add('show');
}

console.log('chat-handlers.js読み込み完了');