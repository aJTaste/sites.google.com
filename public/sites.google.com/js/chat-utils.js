// チャット機能のユーティリティ関数

// DM IDを生成
export function getDmId(uid1,uid2){
  return[uid1,uid2].sort().join('_');
}

// 通知権限をリクエスト
export async function requestNotificationPermission(){
  if('Notification'in window&&Notification.permission==='default'){
    await Notification.requestPermission();
  }
}

// 時刻フォーマット（秒単位）
export function formatMessageTime(timestamp){
  const date=new Date(timestamp);
  const now=new Date();
  const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const messageDate=new Date(date.getFullYear(),date.getMonth(),date.getDate());
  
  if(messageDate.getTime()===today.getTime()){
    return date.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }else if(messageDate.getTime()===today.getTime()-86400000){
    return '昨日 '+date.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }else{
    return date.toLocaleDateString('ja-JP',{month:'short',day:'numeric'})+' '+date.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }
}

// 最終ログイン時刻フォーマット（リアルタイム更新対応）
export function formatLastOnline(timestamp){
  if(!timestamp)return '不明';
  
  const date=new Date(timestamp);
  const now=new Date();
  const diff=now-date;
  const seconds=Math.floor(diff/1000);
  const minutes=Math.floor(diff/60000);
  const hours=Math.floor(diff/3600000);
  const days=Math.floor(diff/86400000);
  
  if(seconds<10)return 'たった今';
  if(seconds<60)return `${seconds}秒前`;
  if(minutes<60)return `${minutes}分前`;
  if(hours<24)return `${hours}時間前`;
  if(days<7)return `${days}日前`;
  
  return date.toLocaleDateString('ja-JP',{month:'short',day:'numeric'});
}

// HTMLエスケープ + URLリンク化
export function escapeHtml(text){
  const div=document.createElement('div');
  div.textContent=text;
  let escaped=div.innerHTML;
  
  // URLをリンク化
  const urlRegex=/(https?:\/\/[^\s]+)/g;
  escaped=escaped.replace(urlRegex,'<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  
  return escaped;
}

// 通知を表示
export function showNotification(title,body,icon){
  if('Notification'in window&&Notification.permission==='granted'&&document.hidden){
    new Notification(title,{
      body:body,
      icon:icon||'assets/favicon-main.png',
      tag:'chat-message'
    });
  }
}

// タブタイトルに未読件数を表示（今はなし）
// export function updatePageTitle(unreadCounts){
//   const totalUnread=Object.values(unreadCounts).reduce((sum,count)=>sum+count,0);
//   if(totalUnread>0){
//     document.title=`(${totalUnread}) チャット | AppHub`;
//   }else{
//     document.title='チャット | AppHub';
//   }
// }

// 画像ファイルを処理
export function handleImageFile(file,callback){
  if(!file.type.startsWith('image/')){
    alert('画像ファイルを選択してください');
    return;
  }
  
  if(file.size>2*1024*1024){
    alert('画像サイズは2MB以下にしてください');
    return;
  }
  
  const reader=new FileReader();
  reader.onload=(e)=>{
    callback(e.target.result);
  };
  reader.readAsDataURL(file);
}
