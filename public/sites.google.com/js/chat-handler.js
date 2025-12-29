// イベントハンドラー関連（シンプル版）

import{supabase}from'../common/core.js';
import{state,updateState}from'./chat-state.js';
import{displayUsers,createChatHTML,createChannelChatHTML}from'./chat-ui.js';

console.log('chat-handlers.js読み込み成功');

// ユーザーを選択
export async function selectUser(userId){
  console.log('selectUser:',userId);
  updateState('selectedUserId',userId);
  updateState('selectedChannelId',null);
  
  const chatMain=document.getElementById('chat-main');
  const selectedUser=state.allUsers.find(u=>u.id===userId);
  
  if(!selectedUser){
    alert('ユーザーが見つかりません');
    return;
  }
  
  chatMain.innerHTML=createChatHTML(selectedUser);
  alert('チャット画面を表示しました（メッセージ機能は未実装）');
}

// チャンネルを選択
export async function selectChannel(channelId){
  console.log('selectChannel:',channelId);
  alert('チャンネル選択（未実装）');
}

// グローバル関数として公開
window.selectUser=selectUser;
window.selectChannel=selectChannel;

// グローバル関数（モーダル用）
window.openImageModal=function(imageUrl){
  alert('画像モーダル（未実装）');
}

window.replyMessage=function(messageId,text,senderId){
  alert('返信機能（未実装）');
}

window.editMessage=function(messageId,text,isDM){
  alert('編集機能（未実装）');
}

window.deleteMessage=function(messageId,isDM){
  alert('削除機能（未実装）');
}