// 入力中表示機能
import{supabase}from'../common/supabase-config.js';

let typingTimer=null;
let typingChannel=null;

// 入力中状態を送信
export async function setTypingStatus(userId,targetId,isTyping){
  const{error}=await supabase
    .from('typing_status')
    .upsert({
      user_id:userId,
      target_id:targetId,
      is_typing:isTyping,
      updated_at:new Date().toISOString()
    });
  
  if(error){
    console.error('入力中状態更新エラー:',error);
  }
}

// 入力中状態をリアルタイム購読
export function subscribeToTypingStatus(targetId,callback){
  if(typingChannel){
    typingChannel.unsubscribe();
  }
  
  typingChannel=supabase
    .channel(`typing:${targetId}`)
    .on('postgres_changes',{
      event:'*',
      schema:'public',
      table:'typing_status',
      filter:`target_id=eq.${targetId}`
    },callback)
    .subscribe();
  
  return typingChannel;
}

// 入力開始時の処理
export function onTypingStart(userId,targetId){
  if(typingTimer){
    clearTimeout(typingTimer);
  }
  
  setTypingStatus(userId,targetId,true);
  
  // 3秒後に自動的にfalseにする
  typingTimer=setTimeout(()=>{
    setTypingStatus(userId,targetId,false);
  },3000);
}

// 入力停止時の処理
export function onTypingStop(userId,targetId){
  if(typingTimer){
    clearTimeout(typingTimer);
  }
  
  setTypingStatus(userId,targetId,false);
}

// 購読をクリーンアップ
export function cleanupTypingSubscription(){
  if(typingChannel){
    typingChannel.unsubscribe();
    typingChannel=null;
  }
}