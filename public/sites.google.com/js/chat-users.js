// ユーザー管理とオンライン状態（Supabase版）
import{supabase}from'../common/core.js';
import{state,updateState,CHANNELS}from'./chat-state.js';
import{displayUsers}from'./chat-ui.js';

// ユーザー一覧を読み込み
export async function loadUsers(){
  // 全ユーザーを取得（自分以外）
  const{data:users,error}=await supabase
    .from('profiles')
    .select('*')
    .neq('id',state.currentProfile.id)
    .order('is_online',{ascending:false})
    .order('last_online',{ascending:false});
  
  if(error){
    console.error('ユーザー読み込みエラー:',error);
    return;
  }
  
  updateState('allUsers',users);
  
  // リアルタイム購読
  if(state.profileSubscription){
    state.profileSubscription.unsubscribe();
  }
  
  const subscription=supabase
    .channel('profiles-changes')
    .on('postgres_changes',{
      event:'*',
      schema:'public',
      table:'profiles'
    },async(payload)=>{
      // ユーザー情報が更新されたら再読み込み
      await loadUsers();
      await calculateUnreadCounts();
      displayUsers();
    })
    .subscribe();
  
  updateState('profileSubscription',subscription);
  
  // 未読件数を計算
  await calculateUnreadCounts();
  
  // 表示
  displayUsers();
}

// 未読件数を計算
async function calculateUnreadCounts(){
  const unreadCounts={};
  
  // 自分の既読状態を取得
  const{data:readStatuses}=await supabase
    .from('read_status')
    .select('*')
    .eq('user_id',state.currentProfile.id);
  
  const readMap={};
  if(readStatuses){
    readStatuses.forEach(r=>{
      readMap[r.target_id]=new Date(r.last_read_at).getTime();
    });
  }
  
  // DMの未読
  for(const user of state.allUsers){
    const dmId=[state.currentProfile.user_id,user.user_id].sort().join('_');
    
    const{data:messages}=await supabase
      .from('dm_messages')
      .select('*')
      .eq('dm_id',dmId)
      .neq('sender_id',state.currentProfile.id);
    
    if(messages){
      const lastRead=readMap[user.user_id]||0;
      const unread=messages.filter(m=>new Date(m.created_at).getTime()>lastRead).length;
      unreadCounts[user.user_id]=unread;
    }else{
      unreadCounts[user.user_id]=0;
    }
  }
  
  // チャンネルの未読
  for(const channel of CHANNELS){
    const{data:messages}=await supabase
      .from('channel_messages')
      .select('*')
      .eq('channel_id',channel.id)
      .neq('sender_id',state.currentProfile.id);
    
    if(messages){
      const lastRead=readMap[channel.id]||0;
      const unread=messages.filter(m=>new Date(m.created_at).getTime()>lastRead).length;
      unreadCounts[channel.id]=unread;
    }else{
      unreadCounts[channel.id]=0;
    }
  }
  
  state.unreadCounts=unreadCounts;
}

// アクティビティ監視を開始
export function startActivityMonitor(){
  // 最後のアクティビティ時刻を更新
  const updateActivity=()=>{
    state.lastActivity=Date.now();
  };
  
  // クリック・キー入力でアクティビティを記録
  document.addEventListener('click',updateActivity);
  document.addEventListener('keydown',updateActivity);
  document.addEventListener('mousemove',updateActivity);
  
  // 1分ごとにオンライン状態をチェック
  if(state.activityCheckInterval){
    clearInterval(state.activityCheckInterval);
  }
  
  const checkInterval=setInterval(async()=>{
    const now=Date.now();
    const timeSinceActivity=now-state.lastActivity;
    
    // 10分以上アクティビティがない場合はオフライン
    const isOnline=timeSinceActivity<10*60*1000;
    
    // Supabaseを更新
    await supabase
      .from('profiles')
      .update({
        is_online:isOnline,
        last_online:new Date().toISOString()
      })
      .eq('id',state.currentProfile.id);
  },60000); // 1分ごと
  
  updateState('activityCheckInterval',checkInterval);
  
  // ページを閉じるときはオフライン
  window.addEventListener('beforeunload',async()=>{
    await supabase
      .from('profiles')
      .update({
        is_online:false,
        last_online:new Date().toISOString()
      })
      .eq('id',state.currentProfile.id);
  });
}