// チャットアプリのメインファイル（デバッグ版）

// 即座に動作確認
alert('chat.js読み込み開始！');

try{
  // core.jsのインポート
  const coreModule=await import('../common/core.js');
  alert('core.js読み込み成功');
  
  const{initPage,supabase}=coreModule;
  
  // ページ初期化
  const profile=await initPage('chat','チャット');
  
  if(!profile){
    alert('プロフィール取得失敗');
  }else{
    alert('プロフィール取得成功: '+profile.display_name);
  }
  
}catch(error){
  alert('エラー発生: '+error.message);
  console.error(error);
}