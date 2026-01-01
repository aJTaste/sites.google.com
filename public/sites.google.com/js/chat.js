// チャットメイン（Supabase版）
import{initPage,supabase}from'../common/core.js';
import{state,updateState,CHANNELS}from'./chat-state.js';
import{requestNotificationPermission}from'./chat-utils.js';
import{loadUsers,startActivityMonitor}from'./chat-users.js';
import{selectUser,selectChannel}from'./chat-handlers.js';

// ページ初期化
await initPage('chat','チャット',{
  onUserLoaded:async(profile)=>{
    updateState('currentProfile',profile);
    
    // 通知権限をリクエスト
    await requestNotificationPermission();
    
    // ユーザー一覧を読み込み
    await loadUsers();
    
    // アクティビティ監視を開始
    startActivityMonitor();
  }
});

// グローバル関数として公開
window.selectUser=selectUser;
window.selectChannel=selectChannel;