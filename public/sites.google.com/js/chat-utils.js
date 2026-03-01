// チャット機能のユーティリティ関数

// DM IDを生成
export function getDmId(userId1,userId2){
  return[userId1,userId2].sort().join('_');
}

// 通知権限をリクエスト
export async function requestNotificationPermission(){
  if('Notification'in window){
    if(Notification.permission==='default'){
      const permission=await Notification.requestPermission();
      console.log('通知権限:',permission);
    }
  }else{
    console.warn('このブラウザは通知をサポートしていません');
  }
}

// ========================================
// 通知音（Web Audio API）
// ========================================

let _audioCtx=null;
function getAudioCtx(){
  if(!_audioCtx||_audioCtx.state==='closed'){
    _audioCtx=new(window.AudioContext||window.webkitAudioContext)();
  }
  if(_audioCtx.state==='suspended'){
    _audioCtx.resume();
  }
  return _audioCtx;
}

// 通常の通知音（ポン）
export function playNotificationSound(){
  try{
    const ctx=getAudioCtx();
    const beep=(freq,startTime,dur,vol=0.25)=>{
      const osc=ctx.createOscillator();
      const gain=ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type='sine';
      osc.frequency.value=freq;
      gain.gain.setValueAtTime(vol,ctx.currentTime+startTime);
      gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+startTime+dur);
      osc.start(ctx.currentTime+startTime);
      osc.stop(ctx.currentTime+startTime+dur+0.01);
    };
    beep(880,0,0.12);
    beep(1100,0.13,0.1);
  }catch(e){
    console.warn('通知音エラー:',e);
  }
}

// 呼び出し音（強力・繰り返し）
export function playCallSound(){
  try{
    const ctx=getAudioCtx();
    const pattern=[
      [440,0,0.15,0.5],[660,0.18,0.15,0.5],[880,0.36,0.15,0.5],
      [440,0.6,0.15,0.5],[660,0.78,0.15,0.5],[880,0.96,0.15,0.5],
    ];
    pattern.forEach(([freq,start,dur,vol])=>{
      const osc=ctx.createOscillator();
      const gain=ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type='square';
      osc.frequency.value=freq;
      gain.gain.setValueAtTime(vol,ctx.currentTime+start);
      gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+start+dur);
      osc.start(ctx.currentTime+start);
      osc.stop(ctx.currentTime+start+dur+0.01);
    });
  }catch(e){
    console.warn('呼び出し音エラー:',e);
  }
}

// ========================================
// アプリ内トースト通知
// ========================================

function showInAppToast(title,body,icon,isCall=false){
  const existing=document.getElementById('chat-toast-container');
  const container=existing||document.createElement('div');
  if(!existing){
    container.id='chat-toast-container';
    container.style.cssText='position:fixed;top:16px;right:16px;z-index:99999;display:flex;flex-direction:column;gap:8px;max-width:320px;';
    document.body.appendChild(container);
  }

  const toast=document.createElement('div');
  toast.style.cssText=`
    background:var(--bg-primary,#fff);
    border:1.5px solid ${isCall?'#f59e0b':'var(--border,#e0e0e0)'};
    border-radius:12px;
    padding:12px;
    display:flex;
    align-items:center;
    gap:10px;
    box-shadow:0 4px 20px rgba(0,0,0,0.18);
    animation:toastIn 0.25s ease;
    cursor:pointer;
    min-width:240px;
  `;

  if(!document.querySelector('style[data-toast]')){
    const s=document.createElement('style');
    s.setAttribute('data-toast','');
    s.textContent='@keyframes toastIn{from{transform:translateX(110%);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes toastOut{from{transform:translateX(0);opacity:1}to{transform:translateX(110%);opacity:0}}';
    document.head.appendChild(s);
  }

  const iconEl=document.createElement('div');
  iconEl.style.cssText='width:40px;height:40px;border-radius:50%;overflow:hidden;flex-shrink:0;background:var(--bg-secondary,#f5f5f5);display:flex;align-items:center;justify-content:center;';
  if(icon){
    iconEl.innerHTML=`<img src="${icon}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  }else{
    iconEl.innerHTML=isCall?'<span style="font-size:20px;">📞</span>':'<span style="font-size:20px;">💬</span>';
  }

  const textEl=document.createElement('div');
  textEl.style.cssText='flex:1;min-width:0;';
  textEl.innerHTML=`
    <div style="font-size:13px;font-weight:700;color:${isCall?'#f59e0b':'var(--text-primary,#222)'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${isCall?'📞 呼び出し: ':''}<span>${escapeToastText(title)}</span></div>
    <div style="font-size:12px;color:var(--text-secondary,#666);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px;">${escapeToastText(body||'')}</div>
  `;

  toast.appendChild(iconEl);
  toast.appendChild(textEl);
  container.appendChild(toast);

  toast.addEventListener('click',()=>dismissToast(toast));

  setTimeout(()=>dismissToast(toast),isCall?8000:5000);
}

function dismissToast(toast){
  toast.style.animation='toastOut 0.25s ease forwards';
  setTimeout(()=>toast.remove(),250);
}

function escapeToastText(text){
  const d=document.createElement('div');
  d.textContent=text;
  return d.innerHTML;
}

// ========================================
// 通知表示（改善版）
// ========================================

export function showNotification(title,body,icon,isCall=false){
  // ページが見えている → アプリ内トースト + 音
  if(!document.hidden){
    showInAppToast(title,body,icon,isCall);
    if(isCall){
      playCallSound();
    }else{
      playNotificationSound();
    }
    return;
  }

  // ページが非表示 → ブラウザ通知
  if(!('Notification'in window)||Notification.permission!=='granted')return;

  try{
    const notification=new Notification(title,{
      body:body||'',
      icon:icon||'/sites.google.com/assets/favicon1.svg',
      tag:isCall?'chat-call':'chat-message',
      requireInteraction:isCall,
      silent:false,
      vibrate:isCall?[200,100,200,100,200]:[100]
    });
    notification.onclick=()=>{
      window.focus();
      notification.close();
    };
    if(!isCall){
      setTimeout(()=>notification.close(),6000);
    }
  }catch(error){
    console.error('通知エラー:',error);
  }
}

// ========================================
// 時刻フォーマット
// ========================================

export function formatMessageTime(timestamp){
  const date=new Date(timestamp);
  const now=new Date();
  const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const messageDate=new Date(date.getFullYear(),date.getMonth(),date.getDate());

  if(messageDate.getTime()===today.getTime()){
    return date.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }else if(messageDate.getTime()===today.getTime()-86400000){
    return'昨日 '+date.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }else{
    return date.toLocaleDateString('ja-JP',{month:'short',day:'numeric'})+' '+date.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }
}

// 最終ログイン時刻フォーマット
export function formatLastOnline(timestamp){
  if(!timestamp)return'不明';
  const date=new Date(timestamp);
  const now=new Date();
  const diff=now-date;
  const seconds=Math.floor(diff/1000);
  const minutes=Math.floor(diff/60000);
  const hours=Math.floor(diff/3600000);
  const days=Math.floor(diff/86400000);
  if(seconds<10)return'たった今';
  if(seconds<60)return`${seconds}秒前`;
  if(minutes<60)return`${minutes}分前`;
  if(hours<24)return`${hours}時間前`;
  if(days<7)return`${days}日前`;
  return date.toLocaleDateString('ja-JP',{month:'short',day:'numeric'});
}

// HTMLエスケープ + URLリンク化
export function escapeHtml(text){
  const div=document.createElement('div');
  div.textContent=text;
  let escaped=div.innerHTML;
  const urlRegex=/(https?:\/\/[^\s]+)/g;
  escaped=escaped.replace(urlRegex,'<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  return escaped;
}

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