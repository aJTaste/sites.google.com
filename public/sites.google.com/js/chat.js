// チャットアプリメイン
import{initPage,supabase}from'../common/core.js';
import{getAllUsers,getDmMessages,getChannelMessages,getDmId,updateReadStatus,getUnreadCounts,subscribeToDmMessages,subscribeToChannelMessages,subscribeToProfiles,CHANNELS}from'./chat-supabase.js';
import{displayUserList,createChatHeaderHtml,createChannelHeaderHtml,createInputAreaHtml,displayMessage}from'./chat-ui.js';
import{setupChatInput,setupMessageActions,setupImageModal}from'./chat-handlers.js';
import{subscribeToTypingStatus,cleanupTypingSubscription}from'./chat-typing.js';
import{requestNotificationPermission,showNotification}from'./chat-utils.js';

// グローバル状態
let state={
  currentProfile:null,
  allUsers:[],
  selectedUserId:null,
  selectedChannelId:null,
  unreadCounts:{},
  messageSubscription:null,
  profileSubscription:null,
  typingSubscription:null
};

// ページ初期化
await initPage('chat','チャット',{
  onUserLoaded:async(profile)=>{
    state.currentProfile=profile;
    
    // オンライン状態を更新
    await supabase
      .from('profiles')
      .update({is_online:true})
      .eq('id',profile.id);
    
    // オフライン時の処理
    window.addEventListener('beforeunload',async()=>{
      await supabase
        .from('profiles')
        .update({is_online:false})
        .eq('id',profile.id);
    });
    
    // 通知権限をリクエスト
    await requestNotificationPermission();
    
    // 初期データ読み込み
    await loadInitialData();
    
    // リアルタイム購読を開始
    startProfileSubscription();
    
    // イベントリスナー設定
    setupEventListeners();
  }
});

// 初期データ読み込み
async function loadInitialData(){
  state.allUsers=await getAllUsers();
  state.unreadCounts=await getUnreadCounts(state.currentProfile.id,state.allUsers);
  
  displayUserList(
    state.allUsers,
    state.unreadCounts,
    state.currentProfile,
    state.selectedUserId,
    state.selectedChannelId
  );
}

// イベントリスナー設定
function setupEventListeners(){
  const dmList=document.getElementById('dm-list');
  
  // ユーザー/チャンネル選択
  dmList.addEventListener('click',(e)=>{
    const dmItem=e.target.closest('.dm-item');
    const channelItem=e.target.closest('.channel-item');
    
    if(dmItem){
      const userId=dmItem.dataset.userId;
      selectUser(userId);
    }else if(channelItem){
      const channelId=channelItem.dataset.channelId;
      selectChannel(channelId);
    }
  });
  
  // 画像モーダル
  setupImageModal();
}

// ユーザーを選択
async function selectUser(userId){
  state.selectedUserId=userId;
  state.selectedChannelId=null;
  
  // メッセージ購読をクリーンアップ
  if(state.messageSubscription){
    state.messageSubscription.unsubscribe();
  }
  if(state.typingSubscription){
    cleanupTypingSubscription();
  }
  
  // 既読状態を更新
  await updateReadStatus(state.currentProfile.id,userId);
  state.unreadCounts[userId]=0;
  
  // UI更新
  displayUserList(
    state.allUsers,
    state.unreadCounts,
    state.currentProfile,
    state.selectedUserId,
    state.selectedChannelId
  );
  
  // チャット画面を表示
  const selectedUser=state.allUsers.find(u=>u.id===userId);
  if(!selectedUser)return;
  
  const chatMain=document.getElementById('chat-main');
  chatMain.innerHTML=
    createChatHeaderHtml(selectedUser)+
    '<div class="chat-messages" id="chat-messages"></div>'+
    createInputAreaHtml(`${selectedUser.display_name} にメッセージを送信`);
  
  // イベントリスナー設定
  const dmId=getDmId(state.currentProfile.id,userId);
  setupChatInput(state.currentProfile.id,dmId,true);
  setupMessageActions();
  
  // メッセージを読み込み
  await loadDmMessages(dmId);
  
  // リアルタイム購読を開始
  state.messageSubscription=subscribeToDmMessages(dmId,handleMessageUpdate);
  
  // 入力中表示の購読
  state.typingSubscription=subscribeToTypingStatus(dmId,handleTypingUpdate);
}

// チャンネルを選択
async function selectChannel(channelId){
  state.selectedUserId=null;
  state.selectedChannelId=channelId;
  
  // メッセージ購読をクリーンアップ
  if(state.messageSubscription){
    state.messageSubscription.unsubscribe();
  }
  if(state.typingSubscription){
    cleanupTypingSubscription();
  }
  
  // 既読状態を更新
  await updateReadStatus(state.currentProfile.id,channelId);
  state.unreadCounts[channelId]=0;
  
  // UI更新
  displayUserList(
    state.allUsers,
    state.unreadCounts,
    state.currentProfile,
    state.selectedUserId,
    state.selectedChannelId
  );
  
  // チャット画面を表示
  const channel=CHANNELS.find(c=>c.id===channelId);
  if(!channel)return;
  
  const chatMain=document.getElementById('chat-main');
  chatMain.innerHTML=
    createChannelHeaderHtml(channel)+
    '<div class="chat-messages" id="chat-messages"></div>'+
    createInputAreaHtml(`${channel.name} にメッセージを送信`);
  
  // イベントリスナー設定
  setupChatInput(state.currentProfile.id,channelId,false);
  setupMessageActions();
  
  // メッセージを読み込み
  await loadChannelMessages(channelId);
  
  // リアルタイム購読を開始
  state.messageSubscription=subscribeToChannelMessages(channelId,handleMessageUpdate);
  
  // 入力中表示の購読
  state.typingSubscription=subscribeToTypingStatus(channelId,handleTypingUpdate);
}

// DMメッセージを読み込み
async function loadDmMessages(dmId){
  const messages=await getDmMessages(dmId);
  displayMessages(messages,true);
}

// チャンネルメッセージを読み込み
async function loadChannelMessages(channelId){
  const messages=await getChannelMessages(channelId);
  displayMessages(messages,false);
}

// メッセージを表示
function displayMessages(messages,isDm){
  const chatMessages=document.getElementById('chat-messages');
  if(!chatMessages)return;
  
  const wasAtBottom=chatMessages.scrollHeight-chatMessages.scrollTop<=chatMessages.clientHeight+50;
  
  chatMessages.innerHTML='';
  
  messages.forEach(message=>{
    const messageEl=displayMessage(message,state.allUsers,state.currentProfile.id,isDm);
    if(messageEl){
      chatMessages.appendChild(messageEl);
    }
  });
  
  if(wasAtBottom){
    setTimeout(()=>{
      chatMessages.scrollTop=chatMessages.scrollHeight;
    },10);
  }
}

// メッセージ更新時の処理
function handleMessageUpdate(payload){
  if(payload.eventType==='INSERT'){
    // 新しいメッセージが追加された
    const isDm=state.selectedUserId!==null;
    const messageEl=displayMessage(payload.new,state.allUsers,state.currentProfile.id,isDm);
    if(messageEl){
      const chatMessages=document.getElementById('chat-messages');
      chatMessages.appendChild(messageEl);
      
      const wasAtBottom=chatMessages.scrollHeight-chatMessages.scrollTop<=chatMessages.clientHeight+50;
      if(wasAtBottom){
        chatMessages.scrollTop=chatMessages.scrollHeight;
      }
      
      // 通知
      if(payload.new.sender_id!==state.currentProfile.id){
        const sender=state.allUsers.find(u=>u.id===payload.new.sender_id);
        if(sender){
          showNotification(
            sender.display_name,
            payload.new.text||'画像を送信しました',
            sender.avatar_url
          );
        }
      }
    }
  }else if(payload.eventType==='UPDATE'){
    // メッセージが編集された
    const messageEl=document.querySelector(`[data-message-id="${payload.new.id}"]`);
    if(messageEl){
      const isDm=state.selectedUserId!==null;
      const newMessageEl=displayMessage(payload.new,state.allUsers,state.currentProfile.id,isDm);
      if(newMessageEl){
        messageEl.replaceWith(newMessageEl);
      }
    }
  }else if(payload.eventType==='DELETE'){
    // メッセージが削除された
    const messageEl=document.querySelector(`[data-message-id="${payload.old.id}"]`);
    if(messageEl){
      messageEl.remove();
    }
  }
}

// プロフィール更新時の処理
function handleProfileUpdate(payload){
  const userId=payload.new.id;
  const userIndex=state.allUsers.findIndex(u=>u.id===userId);
  
  if(userIndex!==-1){
    state.allUsers[userIndex]=payload.new;
    
    displayUserList(
      state.allUsers,
      state.unreadCounts,
      state.currentProfile,
      state.selectedUserId,
      state.selectedChannelId
    );
    
    // 選択中のユーザーの場合、ヘッダーも更新
    if(state.selectedUserId===userId){
      const chatHeader=document.querySelector('.chat-header');
      if(chatHeader){
        const selectedUser=state.allUsers.find(u=>u.id===userId);
        if(selectedUser){
          chatHeader.outerHTML=createChatHeaderHtml(selectedUser);
        }
      }
    }
  }
}

// 入力中表示の更新
function handleTypingUpdate(payload){
  const typingIndicator=document.getElementById('typing-indicator');
  if(!typingIndicator)return;
  
  if(payload.new.is_typing&&payload.new.user_id!==state.currentProfile.id){
    const typingUser=state.allUsers.find(u=>u.id===payload.new.user_id);
    if(typingUser){
      typingIndicator.textContent=`${typingUser.display_name} が入力中...`;
      typingIndicator.style.color='var(--main)';
    }
  }else{
    // 元の説明文に戻す
    if(state.selectedChannelId){
      const channel=CHANNELS.find(c=>c.id===state.selectedChannelId);
      if(channel){
        typingIndicator.textContent=channel.desc;
        typingIndicator.style.color='var(--text-secondary)';
      }
    }else if(state.selectedUserId){
      const selectedUser=state.allUsers.find(u=>u.id===state.selectedUserId);
      if(selectedUser){
        const statusText=selectedUser.is_online?'オンライン':`最終: ${formatLastOnline(selectedUser.last_online)}`;
        typingIndicator.textContent=statusText;
        typingIndicator.style.color='var(--text-secondary)';
      }
    }
  }
}

// プロフィールのリアルタイム購読
function startProfileSubscription(){
  state.profileSubscription=subscribeToProfiles(handleProfileUpdate);
}ｇ