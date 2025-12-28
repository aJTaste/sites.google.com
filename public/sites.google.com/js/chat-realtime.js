// Supabaseリアルタイム購読管理

import{supabase}from'../common/core.js';
import{state,setState,getDmId}from'./chat-state.js';
import{displayMessage}from'./chat-ui.js';
import{showNotification}from'./chat-utils.js';

// プロフィールのリアルタイム購読
export function subscribeProfiles(callback){
  if(state.profilesSubscription){
    supabase.removeChannel(state.profilesSubscription);
  }
  
  const subscription=supabase
    .channel('profiles-changes')
    .on('postgres_changes',{event:'*',schema:'public',table:'profiles'},(payload)=>{
      if(callback)callback(payload);
    })
    .subscribe();
  
  setState('profilesSubscription',subscription);
}

// DMメッセージのリアルタイム購読
export async function subscribeDmMessages(targetUserId){
  // 既存の購読を解除
  if(state.messagesSubscription){
    supabase.removeChannel(state.messagesSubscription);
  }
  
  const dmId=getDmId(state.currentProfile.id,targetUserId);
  
  // 既存メッセージを読み込み
  const{data:messages,error}=await supabase
    .from('dm_messages')
    .select('*')
    .eq('dm_id',dmId)
    .order('created_at',{ascending:true});
  
  if(error){
    console.error('メッセージ読み込みエラー:',error);
    return;
  }
  
  // 画面に表示
  const chatMessages=document.getElementById('chat-messages');
  if(chatMessages){
    chatMessages.innerHTML='';
    messages.forEach(msg=>displayMessage(msg,true));
    chatMessages.scrollTop=chatMessages.scrollHeight;
  }
  
  // 既読を更新
  await supabase
    .from('read_status')
    .upsert({
      user_id:state.currentProfile.id,
      target_id:targetUserId,
      last_read_at:new Date().toISOString()
    });
  
  // リアルタイム購読開始
  const subscription=supabase
    .channel(`dm:${dmId}`)
    .on('postgres_changes',{
      event:'INSERT',
      schema:'public',
      table:'dm_messages',
      filter:`dm_id=eq.${dmId}`
    },(payload)=>{
      const newMsg=payload.new;
      displayMessage(newMsg,true);
      
      const chatMessages=document.getElementById('chat-messages');
      if(chatMessages){
        chatMessages.scrollTop=chatMessages.scrollHeight;
      }
      
      // 通知
      if(newMsg.sender_id!==state.currentProfile.id){
        const sender=state.allProfiles.find(p=>p.id===newMsg.sender_id);
        if(sender){
          showNotification(
            `${sender.display_name}からのメッセージ`,
            newMsg.text||'画像を送信しました',
            sender.avatar_url||null
          );
        }
      }
      
      // 既読を更新
      supabase
        .from('read_status')
        .upsert({
          user_id:state.currentProfile.id,
          target_id:targetUserId,
          last_read_at:new Date().toISOString()
        });
    })
    .on('postgres_changes',{
      event:'UPDATE',
      schema:'public',
      table:'dm_messages',
      filter:`dm_id=eq.${dmId}`
    },(payload)=>{
      const updatedMsg=payload.new;
      const msgEl=document.querySelector(`[data-message-id="${updatedMsg.id}"]`);
      if(msgEl){
        const textEl=msgEl.querySelector('.message-text');
        if(textEl)textEl.innerHTML=escapeHtml(updatedMsg.text);
        
        let editedEl=msgEl.querySelector('.message-edited');
        if(!editedEl){
          editedEl=document.createElement('div');
          editedEl.className='message-edited';
          editedEl.textContent='(編集済み)';
          msgEl.querySelector('.message-content').appendChild(editedEl);
        }
      }
    })
    .on('postgres_changes',{
      event:'DELETE',
      schema:'public',
      table:'dm_messages',
      filter:`dm_id=eq.${dmId}`
    },(payload)=>{
      const deletedId=payload.old.id;
      const msgEl=document.querySelector(`[data-message-id="${deletedId}"]`);
      if(msgEl)msgEl.remove();
    })
    .subscribe();
  
  setState('messagesSubscription',subscription);
}

// チャンネルメッセージのリアルタイム購読
export async function subscribeChannelMessages(channelId){
  // 既存の購読を解除
  if(state.messagesSubscription){
    supabase.removeChannel(state.messagesSubscription);
  }
  
  // 既存メッセージを読み込み
  const{data:messages,error}=await supabase
    .from('channel_messages')
    .select('*')
    .eq('channel_id',channelId)
    .order('created_at',{ascending:true});
  
  if(error){
    console.error('メッセージ読み込みエラー:',error);
    return;
  }
  
  // 画面に表示
  const chatMessages=document.getElementById('chat-messages');
  if(chatMessages){
    chatMessages.innerHTML='';
    messages.forEach(msg=>displayMessage(msg,false));
    chatMessages.scrollTop=chatMessages.scrollHeight;
  }
  
  // 既読を更新
  await supabase
    .from('read_status')
    .upsert({
      user_id:state.currentProfile.id,
      target_id:channelId,
      last_read_at:new Date().toISOString()
    });
  
  // リアルタイム購読開始
  const subscription=supabase
    .channel(`channel:${channelId}`)
    .on('postgres_changes',{
      event:'INSERT',
      schema:'public',
      table:'channel_messages',
      filter:`channel_id=eq.${channelId}`
    },(payload)=>{
      const newMsg=payload.new;
      displayMessage(newMsg,false);
      
      const chatMessages=document.getElementById('chat-messages');
      if(chatMessages){
        chatMessages.scrollTop=chatMessages.scrollHeight;
      }
      
      // 通知
      if(newMsg.sender_id!==state.currentProfile.id){
        const sender=state.allProfiles.find(p=>p.id===newMsg.sender_id);
        const senderName=sender?sender.display_name:'誰か';
        showNotification(
          `${channelId}: ${senderName}`,
          newMsg.text||'画像を送信しました',
          sender?.avatar_url||null
        );
      }
      
      // 既読を更新
      supabase
        .from('read_status')
        .upsert({
          user_id:state.currentProfile.id,
          target_id:channelId,
          last_read_at:new Date().toISOString()
        });
    })
    .on('postgres_changes',{
      event:'UPDATE',
      schema:'public',
      table:'channel_messages',
      filter:`channel_id=eq.${channelId}`
    },(payload)=>{
      const updatedMsg=payload.new;
      const msgEl=document.querySelector(`[data-message-id="${updatedMsg.id}"]`);
      if(msgEl){
        const textEl=msgEl.querySelector('.message-text');
        if(textEl)textEl.innerHTML=escapeHtml(updatedMsg.text);
        
        let editedEl=msgEl.querySelector('.message-edited');
        if(!editedEl){
          editedEl=document.createElement('div');
          editedEl.className='message-edited';
          editedEl.textContent='(編集済み)';
          msgEl.querySelector('.message-content').appendChild(editedEl);
        }
      }
    })
    .on('postgres_changes',{
      event:'DELETE',
      schema:'public',
      table:'channel_messages',
      filter:`channel_id=eq.${channelId}`
    },(payload)=>{
      const deletedId=payload.old.id;
      const msgEl=document.querySelector(`[data-message-id="${deletedId}"]`);
      if(msgEl)msgEl.remove();
    })
    .subscribe();
  
  setState('messagesSubscription',subscription);
}

// 入力中ステータスの購読
export function subscribeTypingStatus(targetId){
  if(state.typingSubscription){
    supabase.removeChannel(state.typingSubscription);
  }
  
  const subscription=supabase
    .channel(`typing:${targetId}`)
    .on('postgres_changes',{
      event:'*',
      schema:'public',
      table:'typing_status',
      filter:`target_id=eq.${targetId}`
    },(payload)=>{
      // 入力中表示の更新処理
      // TODO: UI実装
    })
    .subscribe();
  
  setState('typingSubscription',subscription);
}

// HTMLエスケープ（重複を避けるため内部関数）
function escapeHtml(text){
  if(!text)return '';
  const div=document.createElement('div');
  div.textContent=text;
  return div.innerHTML;
}