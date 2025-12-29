// チャットアプリのメインファイル（シンプル版）

import{initPage,supabase}from'../common/core.js';
import{state,updateState,CHANNELS}from'./chat-state.js';
import{displayUsers}from'./chat-ui.js';
import'./chat-handlers.js';
import'./chat-modals.js';

console.log('chat.js読み込み開始');

// ページ初期化
const profile=await initPage('chat','チャット');

if(profile){
  console.log('プロフィール取得成功:',profile.display_name);
  
  updateState('currentUserId',profile.id);
  updateState('currentProfile',profile);
  
  // ユーザー一覧を読み込み
  await loadUsers();
}

// ユーザー一覧を読み込み
async function loadUsers(){
  try{
    const{data:users,error}=await supabase
      .from('profiles')
      .select('*')
      .neq('id',state.currentUserId)
      .order('last_online',{ascending:false});
    
    if(error)throw error;
    
    console.log('ユーザー読み込み成功:',users.length,'人');
    
    updateState('allUsers',users||[]);
    state.unreadCounts={};
    
    // 表示
    displayUsers();
    
    console.log('表示完了');
  }catch(error){
    console.error('ユーザー読み込みエラー:',error);
    alert('ユーザー読み込みエラー: '+error.message);
  }
}