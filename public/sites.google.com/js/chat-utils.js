// チャット機能のユーティリティ関数

// DM IDを生成
export function getDmId(userId1,userId2){
  return[userId1,userId2].sort().join('_');
}

// 通知権限をリクエスト
export async function requestNotificationPermission(){
  if(!('Notification'in window))return;
  if(Notification.permission==='default'){
    await Notification.requestPermission();
  }
}

// ========================================
// 通知音（Web Audio API）
// ========================================

let _audioCtx=null;

function getAudioCtx(){
  try{
    if(!_audioCtx||_audioCtx.state==='closed'){
      _audioCtx=new(window.AudioContext||window.webkitAudioContext)();
    }
    if(_audioCtx.state==='suspended')_audioCtx.resume();
    return _audioCtx;
  }catch(e){return null;}
}

function playBeep(freq,startTime,dur,vol,type='sine'){
  const ctx=getAudioCtx();
  if(!ctx)return;
  try{
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type=type;
    osc.frequency.value=freq;
    gain.gain.setValueAtTime(vol,ctx.currentTime+startTime);
    gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+startTime+dur);
    osc.start(ctx.currentTime+startTime);
    osc.stop(ctx.currentTime+startTime+dur+0.02);
  }catch(e){}
}

// 通常通知音（ポンポン）
function playNotifSound(){
  try{
    playBeep(880,0,0.12,0.25,'sine');
    playBeep(1100,0.14,0.1,0.2,'sine');
  }catch(e){}
}

// 呼び出し音（強力・連続ビープ）
function playCallSnd(){
  try{
    const pattern=[
      [440,0,0.13,0.5],[660,0.16,0.13,0.5],[880,0.32,0.13,0.5],
      [440,0.55,0.13,0.5],[660,0.71,0.13,0.5],[880,0.87,0.13,0.5]
    ];
    pattern.forEach(([f,s,d,v])=>playBeep(f,s,d,v,'square'));
  }catch(e){}
}

// ========================================
// アプリ内トースト通知
// ========================================

function injectToastStyle(){
  if(document.querySelector('style[data-chtast]'))return;
  const s=document.createElement('style');
  s.setAttribute('data-chtast','');
  s.textContent=`
    #ch-toast-wrap{position:fixed;top:16px;right:16px;z-index:99999;display:flex;flex-direction:column;gap:8px;pointer-events:none;}
    .ch-toast{background:var(--bg-primary,#fff);border:1.5px solid var(--border,#e0e0e0);border-radius:12px;padding:10px 12px;display:flex;align-items:center;gap:10px;box-shadow:0 4px 20px rgba(0,0,0,0.18);pointer-events:auto;cursor:pointer;min-width:230px;max-width:300px;animation:cht-in .25s ease;}
    .ch-toast.call{border-color:#f59e0b;}
    @keyframes cht-in{from{transform:translateX(120%);opacity:0}to{transform:translateX(0);opacity:1}}
    @keyframes cht-out{from{transform:translateX(0);opacity:1}to{transform:translateX(120%);opacity:0}}
    .ch-toast-icon{width:38px;height:38px;border-radius:50%;overflow:hidden;flex-shrink:0;background:var(--bg-secondary,#f5f5f5);display:flex;align-items:center;justify-content:center;font-size:18px;}
    .ch-toast-icon img{width:100%;height:100%;object-fit:cover;border-radius:50%;}
    .ch-toast-body{flex:1;min-width:0;}
    .ch-toast-title{font-size:13px;font-weight:700;color:var(--text-primary,#111);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
    .ch-toast-title.call{color:#f59e0b;}
    .ch-toast-msg{font-size:12px;color:var(--text-secondary,#666);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px;}
  `;
  document.head.appendChild(s);
}

function getToastContainer(){
  let c=document.getElementById('ch-toast-wrap');
  if(!c){
    c=document.createElement('div');
    c.id='ch-toast-wrap';
    document.body.appendChild(c);
  }
  return c;
}

function showInAppToast(title,body,icon,isCall){
  injectToastStyle();
  const wrap=getToastContainer();

  const t=document.createElement('div');
  t.className='ch-toast'+(isCall?' call':'');

  const esc=(s)=>{const d=document.createElement('div');d.textContent=s||'';return d.innerHTML;};

  t.innerHTML=`
    <div class="ch-toast-icon">${icon?`<img src="${esc(icon)}">`:(isCall?'📞':'💬')}</div>
    <div class="ch-toast-body">
      <div class="ch-toast-title${isCall?' call':''}">${isCall?'📞 呼び出し: ':''}${esc(title)}</div>
      ${body?`<div class="ch-toast-msg">${esc(body)}</div>`:''}
    </div>
  `;

  t.addEventListener('click',()=>dismissToast(t));
  wrap.appendChild(t);
  setTimeout(()=>dismissToast(t),isCall?8000:5000);
}

function dismissToast(t){
  if(!t.isConnected)return;
  t.style.animation='cht-out .25s ease forwards';
  setTimeout(()=>{if(t.isConnected)t.remove();},250);
}

// ========================================
// 通知表示（改善版）
// ========================================

export function showNotification(title,body,icon,isCall=false){
  // ページがアクティブ → アプリ内トースト ＋ 音
  if(!document.hidden){
    showInAppToast(title,body,icon,isCall);
    if(isCall)playCallSnd();
    else playNotifSound();
    return;
  }

  // ページが非表示 → ブラウザ通知 ＋ 音
  if(!('Notification'in window)||Notification.permission!=='granted')return;

  try{
    const n=new Notification(title,{
      body:body||'',
      icon:icon||'/sites.google.com/assets/favicon1.svg',
      tag:isCall?'ch-call':'ch-msg',
      requireInteraction:isCall,
      silent:false
    });
    n.onclick=()=>{window.focus();n.close();};
    if(!isCall)setTimeout(()=>n.close(),6000);
  }catch(e){
    console.error('通知エラー:',e);
  }

  // ブラウザ通知でも音を鳴らす
  if(isCall)playCallSnd();
  else playNotifSound();
}

// ========================================
// 時刻フォーマット
// ========================================

export function formatMessageTime(timestamp){
  const date=new Date(timestamp);
  const now=new Date();
  const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const msgDate=new Date(date.getFullYear(),date.getMonth(),date.getDate());

  if(msgDate.getTime()===today.getTime()){
    return date.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }else if(msgDate.getTime()===today.getTime()-86400000){
    return'昨日 '+date.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }else{
    return date.toLocaleDateString('ja-JP',{month:'short',day:'numeric'})+' '+
      date.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }
}

export function formatLastOnline(timestamp){
  if(!timestamp)return'不明';
  const diff=Date.now()-new Date(timestamp).getTime();
  const s=Math.floor(diff/1000);
  const m=Math.floor(diff/60000);
  const h=Math.floor(diff/3600000);
  const d=Math.floor(diff/86400000);
  if(s<10)return'たった今';
  if(s<60)return`${s}秒前`;
  if(m<60)return`${m}分前`;
  if(h<24)return`${h}時間前`;
  if(d<7)return`${d}日前`;
  return new Date(timestamp).toLocaleDateString('ja-JP',{month:'short',day:'numeric'});
}

export function escapeHtml(text){
  const div=document.createElement('div');
  div.textContent=text;
  let escaped=div.innerHTML;
  const urlRegex=/(https?:\/\/[^\s]+)/g;
  escaped=escaped.replace(urlRegex,'<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  return escaped;
}

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
  reader.onload=(e)=>callback(e.target.result);
  reader.readAsDataURL(file);
}