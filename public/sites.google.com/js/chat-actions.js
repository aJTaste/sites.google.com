// チャットアクション（送信、編集、削除など）

import{supabase}from'../common/core.js';
import{state,setState,resetMessageState,getDmId,CHANNELS}from'./chat-state.js';
import{displayUserList,createDmChatHtml,createChannelChatHtml}from'./chat-ui.js';
import{subscribeDmMessages,subscribeChannelMessages}from'./chat-realtime.js';
import{handleImageFile,canAccessChannel}from'./chat-utils.js';

// ユーザーを選択（DM）
export async function selectUser(userId){
  setState('selectedUserId',userId);
  setState('selectedChannelId',null);
  
  // 既読を更新
  await supabase
    .from('read_status')
    .upsert({
      user_id:state.currentProfile.id,
      target_id:userId,
      last_read_at:new Date().toISOString()
    });
  
  state.unreadCounts[userId]=0;
  displayUserList();
  
  const targetProfile=state.allProfiles.find(p=>p.id===userId);
  if(!targetProfile)return;
  
  const chatMain=document.getElementById('chat-main');
  chatMain.innerHTML=createDmChatHtml(targetProfile);
  
  setupInputHandlers();
  subscribeDmMessages(userId);
}

// チャンネルを選択
export async function selectChannel(channelId){
  const channel=CHANNELS.find(c=>c.id===channelId);
  if(!channel)return;
  
  // 権限チェック
  if(!canAccessChannel(state.currentProfile.role,channel.requiredRole)){
    alert('このチャンネルへのアクセス権限がありません');
    return;
  }
  
  setState('selectedChannelId',channelId);
  setState('selectedUserId',null);
  
  // 既読を更新
  await supabase
    .from('read_status')
    .upsert({
      user_id:state.currentProfile.id,
      target_id:channelId,
      last_read_at:new Date().toISOString()
    });
  
  state.unreadCounts[channelId]=0;
  displayUserList();
  
  const chatMain=document.getElementById('chat-main');
  chatMain.innerHTML=createChannelChatHtml(channel);
  
  setupInputHandlers();
  subscribeChannelMessages(channelId);
}

// 入力エリアのイベントハンドラー設定
function setupInputHandlers(){
  const chatInput=document.getElementById('chat-input');
  const sendBtn=document.getElementById('send-btn');
  const attachImageBtn=document.getElementById('attach-image-btn');
  const imageFileInput=document.getElementById('image-file-input');
  const imagePreviewClose=document.getElementById('image-preview-close');
  const replyPreviewClose=document.getElementById('reply-preview-close');
  
  if(!chatInput)return;
  
  // テキストエリア自動リサイズ
  chatInput.addEventListener('input',()=>{
    chatInput.style.height='auto';
    chatInput.style.height=Math.min(chatInput.scrollHeight,120)+'px';
  });
  
  // Enterで送信（Shift+Enterで改行）
  chatInput.addEventListener('keydown',(e)=>{
    if(e.key==='Enter'&&!e.shiftKey){
      e.preventDefault();
      if(!state.isSending)sendMessage();
    }
  });
  
  // クリップボード画像の貼り付け
  chatInput.addEventListener('paste',(e)=>{
    const items=e.clipboardData.items;
    for(let i=0;i<items.length;i++){
      if(items[i].type.indexOf('image')!==-1){
        const file=items[i].getAsFile();
        handleImageFile(file,(base64)=>{
          setState('selectedImage',base64);
          document.getElementById('image-preview').src=base64;
          document.getElementById('image-preview-container').classList.add('show');
        });
        e.preventDefault();
        break;
      }
    }
  });
  
  if(sendBtn){
    sendBtn.addEventListener('click',()=>{
      if(!state.isSending)sendMessage();
    });
  }
  
  if(attachImageBtn&&imageFileInput){
    attachImageBtn.addEventListener('click',()=>imageFileInput.click());
    
    imageFileInput.addEventListener('change',(e)=>{
      const file=e.target.files[0];
      if(file){
        handleImageFile(file,(base64)=>{
          setState('selectedImage',base64);
          document.getElementById('image-preview').src=base64;
          document.getElementById('image-preview-container').classList.add('show');
        });
      }
    });
  }
  
  if(imagePreviewClose){
    imagePreviewClose.addEventListener('click',()=>{
      setState('selectedImage',null);
      document.getElementById('image-preview-container').classList.remove('show');
    });
  }
  
  if(replyPreviewClose){
    replyPreviewClose.addEventListener('click',()=>{
      setState('replyToMessage',null);
      document.getElementById('reply-preview').classList.remove('show');
    });
  }
}

// メッセージ送信
async function sendMessage(){
  if(state.isSending)return;
  
  const chatInput=document.getElementById('chat-input');
  const text=chatInput.value.trim();
  
  if(!text&&!state.selectedImage)return;
  if(!state.selectedUserId&&!state.selectedChannelId)return;
  
  setState('isSending',true);
  chatInput.disabled=true;
  
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
    
    // 画像をSupabase Storageにアップロード
    if(messageImage){
      const blob=await fetch(messageImage).then(r=>r.blob());
      const fileName=`${Date.now()}_${state.currentProfile.id}.png`;
      
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
      sender_id:state.currentProfile.id,
      text:messageText,
      image_url:imageUrl,
      reply_to:messageReply?{
        message_id:messageReply.id,
        text:messageReply.text,
        sender_id:messageReply.sender_id
      }:null
    };
    
    if(state.selectedUserId){
      // DM送信
      const dmId=getDmId(state.currentProfile.id,state.selectedUserId);
      messageData.dm_id=dmId;
      
      const{error}=await supabase
        .from('dm_messages')
        .insert(messageData);
      
      if(error)throw error;
    }else if(state.selectedChannelId){
      // チャンネル送信
      messageData.channel_id=state.selectedChannelId;
      
      const{error}=await supabase
        .from('channel_messages')
        .insert(messageData);
      
      if(error)throw error;
    }
  }catch(error){
    console.error('送信エラー:',error);
    alert('送信に失敗しました');
    chatInput.value=messageText;
  }finally{
    setState('isSending',false);
    chatInput.disabled=false;
    chatInput.focus();
  }
}

// グローバル関数として公開
window.selectUser=selectUser;
window.selectChannel=selectChannel;

window.replyMessage=function(messageId,text,senderId){
  setState('replyToMessage',{id:messageId,text:text,sender_id:senderId});
  document.getElementById('reply-preview-text').textContent=text.substring(0,100);
  document.getElementById('reply-preview').classList.add('show');
  document.getElementById('chat-input').focus();
};

window.editMessage=async function(messageId,targetId,text,isDm){
  const newText=prompt('メッセージを編集:',text);
  if(!newText||newText.trim()===text)return;
  
  try{
    const table=isDm?'dm_messages':'channel_messages';
    const{error}=await supabase
      .from(table)
      .update({
        text:newText.trim(),
        edited_at:new Date().toISOString()
      })
      .eq('id',messageId);
    
    if(error)throw error;
  }catch(error){
    console.error('編集エラー:',error);
    alert('編集に失敗しました');
  }
};

window.deleteMessage=async function(messageId,isDm){
  if(!confirm('このメッセージを削除しますか？'))return;
  
  try{
    const table=isDm?'dm_messages':'channel_messages';
    const{error}=await supabase
      .from(table)
      .delete()
      .eq('id',messageId);
    
    if(error)throw error;
  }catch(error){
    console.error('削除エラー:',error);
    alert('削除に失敗しました');
  }
};

window.openImageModal=function(imageUrl){
  document.getElementById('image-modal-img').src=imageUrl;
  document.getElementById('image-modal').classList.add('show');
};