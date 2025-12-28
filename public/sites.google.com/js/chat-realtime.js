// リアルタイム機能（Supabase版）

import{supabase}from'../common/core.js';
import{state,updateState}from'./chat-state.js';
import{loadDMMessages,loadChannelMessages}from'./chat-messages.js';
import{formatLastOnline}from'./chat-ui.js';

// DM メッセージのリアルタイム監視
export function subscribeDMMessages(dmId){
  const subscription=supabase
    .channel(`dm:${dmId}`)
    .on('postgres_changes',{
      event:'*',
      schema:'public',
      table:'dm_messages',
      filter:`dm_id=eq.${dmId}`
    },payload=>{
      if(payload.eventType==='INSERT'){
        // 新しいメッセージが追加された
        if(state.selectedUserId){
          loadDMMessages(state.selectedUserId);
        }
      }else if(payload.eventType==='UPDATE'){
        // メッセージが編集された
        if(state.selectedUserId){
          loadDMMessages(state.selectedUserId);
        }
      }else if(payload.eventType==='DELETE'){
        // メッセージが削除された
        if(state.selectedUserId){
          loadDMMessages(state.selectedUserId);
        }
      }
    })
    .subscribe();
  
  state.subscriptions.push(subscription);
}

// チャンネルメッセージのリアルタイム監視
export function subscribeChannelMessages(channelId){
  const subscription=supabase
    .channel(`channel:${channelId}`)
    .on('postgres_changes',{
      event:'*',
      schema:'public',
      table:'channel_messages',
      filter:`channel_id=eq.${channelId}`
    },payload=>{
      if(payload.eventType==='INSERT'){
        // 新しいメッセージが追加された
        if(state.selectedChannelId===channelId){
          loadChannelMessages(channelId);
        }
      }else if(payload.eventType==='UPDATE'){
        // メッセージが編集された
        if(state.selectedChannelId===channelId){
          loadChannelMessages(channelId);
        }
      }else if(payload.eventType==='DELETE'){
        // メッセージが削除された
        if(state.selectedChannelId===channelId){
          loadChannelMessages(channelId);
        }
      }
    })
    .subscribe();
  
  state.subscriptions.push(subscription);
}

// プロフィール変更のリアルタイム監視
export function subscribeProfiles(){
  const subscription=supabase
    .channel('profiles-changes')
    .on('postgres_changes',{
      event:'UPDATE',
      schema:'public',
      table:'profiles'
    },payload=>{
      // プロフィールが更新された
      const updatedProfile=payload.new;
      const index=state.allProfiles.findIndex(p=>p.id===updatedProfile.id);
      if(index!==-1){
        state.allProfiles[index]=updatedProfile;
      }
      
      // オンライン状態やステータスを更新
      if(state.selectedUserId===updatedProfile.id){
        updateHeaderStatus(updatedProfile);
      }
    })
    .subscribe();
  
  state.subscriptions.push(subscription);
}

// 入力中ステータスを送信
let typingTimeout=null;
export async function sendTypingStatus(isTyping){
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
      });
    
    // 3秒後に自動でfalseにする
    if(isTyping){
      clearTimeout(typingTimeout);
      typingTimeout=setTimeout(()=>{
        sendTypingStatus(false);
      },3000);
    }
  }catch(error){
    console.error('入力中ステータス送信エラー:',error);
  }
}

// 入力中ステータスの監視
export function subscribeTypingStatus(){
  const targetId=state.selectedUserId||state.selectedChannelId;
  if(!targetId)return;
  
  const subscription=supabase
    .channel(`typing:${targetId}`)
    .on('postgres_changes',{
      event:'*',
      schema:'public',
      table:'typing_status',
      filter:`target_id=eq.${targetId}`
    },payload=>{
      if(payload.eventType==='INSERT'||payload.eventType==='UPDATE'){
        const typingData=payload.new;
        
        // 自分以外の入力中ステータスを表示
        if(typingData.user_id!==state.currentProfile.id&&typingData.is_typing){
          const profile=state.allProfiles.find(p=>p.id===typingData.user_id);
          if(profile){
            showTypingIndicator(profile.display_name);
          }
        }else if(typingData.user_id!==state.currentProfile.id&&!typingData.is_typing){
          hideTypingIndicator();
        }
      }
    })
    .subscribe();
  
  state.subscriptions.push(subscription);
}

// 入力中インジケーターを表示
function showTypingIndicator(displayName){
  const statusEl=document.getElementById('chat-header-status');
  if(statusEl){
    statusEl.textContent=`${displayName} が入力中...`;
    statusEl.style.color='var(--main)';
  }
}

// 入力中インジケーターを非表示
function hideTypingIndicator(){
  const statusEl=document.getElementById('chat-header-status');
  if(statusEl&&state.selectedUserId){
    const profile=state.allProfiles.find(p=>p.id===state.selectedUserId);
    if(profile){
      const isOnline=profile.is_online||false;
      const statusText=isOnline?'オンライン':`最終: ${formatLastOnline(profile.last_online||profile.created_at)}`;
      statusEl.textContent=statusText;
      statusEl.style.color='';
    }
  }
}

// ヘッダーのステータス更新
function updateHeaderStatus(profile){
  const statusEl=document.getElementById('chat-header-status');
  if(statusEl){
    const isOnline=profile.is_online||false;
    const statusText=isOnline?'オンライン':`最終: ${formatLastOnline(profile.last_online||profile.created_at)}`;
    statusEl.textContent=statusText;
  }
}

// すべての購読を解除
export function unsubscribeAll(){
  state.subscriptions.forEach(sub=>{
    supabase.removeChannel(sub);
  });
  state.subscriptions=[];
}

// 既読ステータスを更新
export async function updateReadStatus(targetId){
  try{
    await supabase
      .from('read_status')
      .upsert({
        user_id:state.currentProfile.id,
        target_id:targetId,
        last_read_at:new Date().toISOString()
      });
  }catch(error){
    console.error('既読ステータス更新エラー:',error);
  }
}

// 未読件数を計算
export async function calculateUnreadCounts(){
  try{
    // 自分の既読状態を取得
    const{data:readData,error:readError}=await supabase
      .from('read_status')
      .select('*')
      .eq('user_id',state.currentProfile.id);
    
    if(readError)throw readError;
    
    const readMap={};
    if(readData){
      readData.forEach(r=>{
        readMap[r.target_id]=new Date(r.last_read_at).getTime();
      });
    }
    
    const unreadCounts={};
    
    // DM の未読
    for(const profile of state.allProfiles){
      const lastRead=readMap[profile.id]||0;
      
      const dmId=[state.currentProfile.id,profile.id].sort().join('_');
      
      const{data:messages,error:msgError}=await supabase
        .from('dm_messages')
        .select('*')
        .eq('dm_id',dmId)
        .neq('sender_id',state.currentProfile.id)
        .gt('created_at',new Date(lastRead).toISOString());
      
      if(msgError)throw msgError;
      
      unreadCounts[profile.id]=messages?messages.length:0;
    }
    
    // チャンネルの未読
    const{data:channels}=await supabase
      .from('channel_messages')
      .select('channel_id');
    
    if(channels){
      const uniqueChannels=[...new Set(channels.map(c=>c.channel_id))];
      
      for(const channelId of uniqueChannels){
        const lastRead=readMap[channelId]||0;
        
        const{data:messages,error:msgError}=await supabase
          .from('channel_messages')
          .select('*')
          .eq('channel_id',channelId)
          .neq('sender_id',state.currentProfile.id)
          .gt('created_at',new Date(lastRead).toISOString());
        
        if(msgError)throw msgError;
        
        unreadCounts[channelId]=messages?messages.length:0;
      }
    }
    
    state.unreadCounts=unreadCounts;
    
  }catch(error){
    console.error('未読件数計算エラー:',error);
  }
}