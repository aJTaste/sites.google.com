// イベントハンドラー関連
import{sendDmMessage,sendChannelMessage,editMessage,deleteMessage,uploadChatImage}from'./chat-supabase.js';
import{handleImageFile}from'./chat-utils.js';
import{onTypingStart,onTypingStop}from'./chat-typing.js';

// グローバル状態
let currentState={
  selectedImage:null,
  replyToMessage:null,
  isSending:false
};

// 入力欄のイベントリスナーを設定
export function setupChatInput(currentUserId,targetId,isDm){
  const chatInput=document.getElementById('chat-input');
  const sendBtn=document.getElementById('send-btn');
  const attachImageBtn=document.getElementById('attach-image-btn');
  const imageFileInput=document.getElementById('image-file-input');
  const imagePreviewClose=document.getElementById('image-preview-close');
  const replyPreviewClose=document.getElementById('reply-preview-close');
  
  if(!chatInput)return;
  
  // 高さ自動調整
  chatInput.addEventListener('input',()=>{
    chatInput.style.height='auto';
    chatInput.style.height=Math.min(chatInput.scrollHeight,120)+'px';
    
    // 入力中状態を送信
    if(chatInput.value.trim()){
      onTypingStart(currentUserId,targetId);
    }else{
      onTypingStop(currentUserId,targetId);
    }
  });
  
  // Enter送信
  chatInput.addEventListener('keydown',(e)=>{
    if(e.key==='Enter'&&!e.shiftKey){
      e.preventDefault();
      if(!currentState.isSending){
        sendMessage(currentUserId,targetId,isDm);
      }
    }
  });
  
  // クリップボードから画像貼り付け
  chatInput.addEventListener('paste',(e)=>{
    const items=e.clipboardData.items;
    for(let i=0;i<items.length;i++){
      if(items[i].type.indexOf('image')!==-1){
        const file=items[i].getAsFile();
        handleImageFile(file,(f)=>{
          currentState.selectedImage=f;
          const reader=new FileReader();
          reader.onload=(e)=>{
            document.getElementById('image-preview').src=e.target.result;
            document.getElementById('image-preview-container').classList.add('show');
          };
          reader.readAsDataURL(f);
        });
        e.preventDefault();
        break;
      }
    }
  });
  
  // 送信ボタン
  if(sendBtn){
    sendBtn.addEventListener('click',()=>{
      if(!currentState.isSending){
        sendMessage(currentUserId,targetId,isDm);
      }
    });
  }
  
  // 画像添付
  if(attachImageBtn&&imageFileInput){
    attachImageBtn.addEventListener('click',()=>{
      imageFileInput.click();
    });
    
    imageFileInput.addEventListener('change',(e)=>{
      const file=e.target.files[0];
      if(file){
        handleImageFile(file,(f)=>{
          currentState.selectedImage=f;
          const reader=new FileReader();
          reader.onload=(e)=>{
            document.getElementById('image-preview').src=e.target.result;
            document.getElementById('image-preview-container').classList.add('show');
          };
          reader.readAsDataURL(f);
        });
      }
    });
  }
  
  // 画像プレビュー削除
  if(imagePreviewClose){
    imagePreviewClose.addEventListener('click',()=>{
      currentState.selectedImage=null;
      document.getElementById('image-preview-container').classList.remove('show');
    });
  }
  
  // リプライプレビュー削除
  if(replyPreviewClose){
    replyPreviewClose.addEventListener('click',()=>{
      currentState.replyToMessage=null;
      document.getElementById('reply-preview').classList.remove('show');
    });
  }
}

// メッセージを送信
async function sendMessage(currentUserId,targetId,isDm){
  if(currentState.isSending)return;
  
  const chatInput=document.getElementById('chat-input');
  const sendBtn=document.getElementById('send-btn');
  const text=chatInput.value.trim();
  
  if(!text&&!currentState.selectedImage)return;
  
  currentState.isSending=true;
  chatInput.disabled=true;
  sendBtn.disabled=true;
  
  const messageText=text;
  const messageImage=currentState.selectedImage;
  const messageReply=currentState.replyToMessage;
  
  chatInput.value='';
  chatInput.style.height='auto';
  currentState.selectedImage=null;
  currentState.replyToMessage=null;
  
  const imagePreviewContainer=document.getElementById('image-preview-container');
  const replyPreview=document.getElementById('reply-preview');
  if(imagePreviewContainer)imagePreviewContainer.classList.remove('show');
  if(replyPreview)replyPreview.classList.remove('show');
  
  // 入力中状態を解除
  onTypingStop(currentUserId,targetId);
  
  try{
    let imageUrl=null;
    if(messageImage){
      imageUrl=await uploadChatImage(messageImage,currentUserId);
    }
    
    if(isDm){
      await sendDmMessage(targetId,currentUserId,messageText,imageUrl,messageReply?.id||null);
    }else{
      await sendChannelMessage(targetId,currentUserId,messageText,imageUrl,messageReply?.id||null);
    }
  }catch(error){
    console.error('送信エラー:',error);
    alert('送信に失敗しました');
    chatInput.value=messageText;
  }finally{
    currentState.isSending=false;
    chatInput.disabled=false;
    sendBtn.disabled=false;
    chatInput.focus();
  }
}

// メッセージアクションボタンのイベントリスナーを設定
export function setupMessageActions(){
  const chatMessages=document.getElementById('chat-messages');
  if(!chatMessages)return;
  
  chatMessages.addEventListener('click',(e)=>{
    const target=e.target.closest('button');
    if(!target)return;
    
    // 返信ボタン
    if(target.classList.contains('reply-btn')){
      const messageId=target.dataset.messageId;
      const text=target.dataset.text;
      
      currentState.replyToMessage={id:messageId,text:text};
      document.getElementById('reply-preview-text').textContent=text.substring(0,100);
      document.getElementById('reply-preview').classList.add('show');
      document.getElementById('chat-input').focus();
    }
    
    // 編集ボタン
    if(target.classList.contains('edit-btn')){
      const messageId=target.dataset.messageId;
      const text=target.dataset.text;
      const isDm=target.dataset.isDm==='true';
      
      const newText=prompt('メッセージを編集:',text);
      if(newText&&newText.trim()!==text){
        editMessage(messageId,newText.trim(),isDm).catch(err=>{
          console.error('編集エラー:',err);
          alert('編集に失敗しました');
        });
      }
    }
    
    // 削除ボタン
    if(target.classList.contains('delete-btn')){
      const messageId=target.dataset.messageId;
      const isDm=target.dataset.isDm==='true';
      
      if(confirm('このメッセージを削除しますか？')){
        deleteMessage(messageId,isDm).catch(err=>{
          console.error('削除エラー:',err);
          alert('削除に失敗しました');
        });
      }
    }
    
    // 画像クリック
    const imageTarget=e.target.closest('.message-image');
    if(imageTarget){
      const imageUrl=imageTarget.dataset.imageUrl;
      document.getElementById('image-modal-img').src=imageUrl;
      document.getElementById('image-modal').classList.add('show');
    }
  });
}

// 画像モーダルのイベントリスナーを設定
export function setupImageModal(){
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
}