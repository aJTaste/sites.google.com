// チャットアプリのメインファイル（段階的デバッグ）

alert('Step 1: chat.js読み込み開始');

try{
  // Step 2: core.jsインポート
  const{initPage,supabase}=await import('../common/core.js');
  alert('Step 2: core.js OK');
  
  // Step 3: chat-state.jsインポート
  const stateModule=await import('./chat-state.js');
  alert('Step 3: chat-state.js OK');
  const{state,updateState,CHANNELS}=stateModule;
  
  // Step 4: chat-ui.jsインポート
  const uiModule=await import('./chat-ui.js');
  alert('Step 4: chat-ui.js OK');
  const{displayUsers}=uiModule;
  
  // Step 5: chat-handlers.jsインポート
  await import('./chat-handlers.js');
  alert('Step 5: chat-handlers.js OK');
  
  // Step 6: chat-modals.jsインポート
  await import('./chat-modals.js');
  alert('Step 6: chat-modals.js OK');
  
  // Step 7: ページ初期化
  const profile=await initPage('chat','チャット');
  alert('Step 7: initPage OK - '+profile.display_name);
  
  if(profile){
    updateState('currentUserId',profile.id);
    updateState('currentProfile',profile);
    alert('Step 8: 状態更新 OK');
    
    // ユーザー一覧を読み込み
    const{data:users,error}=await supabase
      .from('profiles')
      .select('*')
      .neq('id',profile.id);
    
    if(error)throw error;
    
    updateState('allUsers',users||[]);
    alert('Step 9: ユーザー読み込み OK - '+users.length+'人');
    
    // 表示
    displayUsers();
    alert('Step 10: 表示完了！');
  }
  
}catch(error){
  alert('エラー: '+error.message);
  console.error(error);
}