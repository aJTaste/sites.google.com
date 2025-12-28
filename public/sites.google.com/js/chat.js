// チャットアプリのメインファイル（Supabase版）

import{initPage,supabase}from'../common/core.js';
import{state,updateState}from'./chat-state.js';
import{displayUsers}from'./chat-ui.js';
import{subscribeProfiles,calculateUnreadCounts}from'./chat-realtime.js';
import'./chat-handlers.js';

// ページ初期化
await initPage('chat','チャット',{
  onUserLoaded:async(profile)=>{
    updateState('currentProfile',profile);
    
    // オンライン状態を更新（既にcore.jsで実行されているが念のため）
    await supabase
      .from('profiles')
      .update({
        is_online:true,
        last_online:new Date().toISOString()
      })
      .eq('id',profile.id);
    
    // オフライン時の処理
    window.addEventListener('beforeunload',async()=>{
      await supabase
        .from('profiles')
        .update({
          is_online:false,
          last_online:new Date().toISOString()
        })
        .eq('id',profile.id);
    });
    
    // 全ユーザーを読み込み
    await loadAllProfiles();
    
    // プロフィールのリアルタイム監視
    subscribeProfiles();
    
    // 未読件数を計算
    await calculateUnreadCounts();
    
    // ユーザー一覧を表示
    displayUsers();
    
    // 定期的に最終ログイン時刻を更新（表示用）
    setInterval(()=>{
      displayUsers();
    },10000);
  }
});

// 全ユーザーを読み込み
async function loadAllProfiles(){
  try{
    const{data,error}=await supabase
      .from('profiles')
      .select('*')
      .neq('id',state.currentProfile.id)
      .order('last_online',{ascending:false});
    
    if(error)throw error;
    
    updateState('allProfiles',data||[]);
  }catch(error){
    console.error('ユーザー読み込みエラー:',error);
  }
}

console.log('チャットアプリ準備完了！');