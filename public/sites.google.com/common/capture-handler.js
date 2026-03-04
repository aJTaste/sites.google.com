// ========================================
// AppHub Capture Handler v2.0
// Alt+S : スクリーンショット
// Alt+R : 録画開始/停止
// ========================================

const CAPTURE_DB_NAME='AppHubCaptures';
const CAPTURE_DB_VERSION=1;
const CAPTURE_STORE_NAME='media';

let db=null;
let mediaRecorder=null;
let recordedChunks=[];
let isRecording=false;
let _recTimerEl=null;
let _recTimerInterval=null;
let _recStartTime=0;
let _recStream=null;

// ========================================
// IndexedDB 初期化
// ========================================

async function initDB(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(CAPTURE_DB_NAME,CAPTURE_DB_VERSION);
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{db=request.result;resolve(db);};
    request.onupgradeneeded=(e)=>{
      const d=e.target.result;
      if(!d.objectStoreNames.contains(CAPTURE_STORE_NAME)){
        const store=d.createObjectStore(CAPTURE_STORE_NAME,{keyPath:'id',autoIncrement:true});
        store.createIndex('timestamp','timestamp',{unique:false});
        store.createIndex('type','type',{unique:false});
      }
    };
  });
}

async function saveToIndexedDB(blob,type){
  if(!db)await initDB();
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction([CAPTURE_STORE_NAME],'readwrite');
    const store=transaction.objectStore(CAPTURE_STORE_NAME);
    const now=new Date();
    const data={blob,type,filename:formatFilename(now,type),timestamp:now.getTime(),size:blob.size};
    const req=store.add(data);
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}

function formatFilename(date,type){
  const pad=n=>String(n).padStart(2,'0');
  const y=date.getFullYear();
  const m=pad(date.getMonth()+1);
  const d=pad(date.getDate());
  const h=pad(date.getHours());
  const min=pad(date.getMinutes());
  const s=pad(date.getSeconds());
  return `${y}-${m}-${d}_${h}${min}${s}.${type==='image'?'png':'webm'}`;
}

// ========================================
// ダウンロード
// ========================================

async function downloadBlob(blob,filename){
  try{
    const ext=filename.endsWith('.png')?'.png':'.webm';
    const mimeType=ext==='.png'?'image/png':'video/webm';
    const handle=await window.showSaveFilePicker({
      suggestedName:filename,
      types:[{description:'Media File',accept:{[mimeType]:[ext]}}]
    });
    const writable=await handle.createWritable();
    await writable.write(blob);
    await writable.close();
  }catch(e){
    if(e.name!=='AbortError')console.error('DLエラー:',e);
  }
}

// ========================================
// スクリーンショット（ImageCapture + Canvas fallback）
// ========================================

async function takeScreenshot(){
  try{
    const stream=await navigator.mediaDevices.getDisplayMedia({video:{mediaSource:'screen'},audio:false});
    const track=stream.getVideoTracks()[0];

    let blob;
    // ImageCapture API が使えるか確認（Chromebookで未対応の場合あり）
    if(typeof ImageCapture!=='undefined'){
      try{
        const ic=new ImageCapture(track);
        const bitmap=await ic.grabFrame();
        const canvas=document.createElement('canvas');
        canvas.width=bitmap.width;canvas.height=bitmap.height;
        canvas.getContext('2d').drawImage(bitmap,0,0);
        track.stop();
        blob=await new Promise(r=>canvas.toBlob(r,'image/png'));
      }catch(icErr){
        // fallback
        blob=await _screenshotViaVideo(stream,track);
      }
    }else{
      blob=await _screenshotViaVideo(stream,track);
    }

    stream.getTracks().forEach(t=>{try{t.stop();}catch(e){}});
    await saveToIndexedDB(blob,'image');
    await downloadBlob(blob,formatFilename(new Date(),'image'));
    notifyMediaUpdate();
    showNotification('📸 スクリーンショットを保存しました','success');
  }catch(e){
    if(e.name!=='NotAllowedError'){
      console.error('スクショエラー:',e);
      showNotification('スクリーンショットに失敗しました','error');
    }
  }
}

async function _screenshotViaVideo(stream,track){
  return new Promise((resolve)=>{
    const video=document.createElement('video');
    video.srcObject=stream;
    video.muted=true;
    video.onloadedmetadata=async()=>{
      await video.play();
      const canvas=document.createElement('canvas');
      canvas.width=video.videoWidth||1280;
      canvas.height=video.videoHeight||720;
      canvas.getContext('2d').drawImage(video,0,0);
      video.pause();
      track.stop();
      canvas.toBlob(resolve,'image/png');
    };
  });
}

// ========================================
// 録画開始
// ========================================

async function startRecording(){
  if(isRecording)return;
  try{
    const stream=await navigator.mediaDevices.getDisplayMedia({video:{mediaSource:'screen'},audio:true});
    await new Promise(r=>setTimeout(r,100));

    // MIMEタイプのフォールバック
    const mimeTypes=['video/webm;codecs=vp8,opus','video/webm;codecs=vp9','video/webm','video/mp4'];
    const mimeType=mimeTypes.find(m=>MediaRecorder.isTypeSupported(m))||'';

    mediaRecorder=new MediaRecorder(stream,mimeType?{mimeType}:{});
    recordedChunks=[];
    _recStream=stream;

    mediaRecorder.ondataavailable=(e)=>{if(e.data.size>0)recordedChunks.push(e.data);};
    mediaRecorder.onstop=async()=>{
      _stopRecordingIndicator();
      const blob=new Blob(recordedChunks,{type:'video/webm'});
      await saveToIndexedDB(blob,'video');
      await downloadBlob(blob,formatFilename(new Date(),'video'));
      notifyMediaUpdate();
      showNotification('🎬 録画を保存しました','success');
      if(_recStream){_recStream.getTracks().forEach(t=>{try{t.stop();}catch(e){}});_recStream=null;}
      isRecording=false;
    };

    // ストリームが外部から停止されたとき（共有停止ボタン）
    stream.getVideoTracks()[0].addEventListener('ended',()=>{
      if(isRecording)stopRecording();
    });

    mediaRecorder.start(1000);// 1秒ごとにchunk
    isRecording=true;
    _recStartTime=Date.now();
    _startRecordingIndicator();
    showNotification('🔴 録画を開始しました（Alt+R で停止）','info');
  }catch(e){
    if(e.name!=='NotAllowedError'){
      console.error('録画エラー:',e);
      showNotification('録画に失敗しました','error');
    }
  }
}

function stopRecording(){
  if(mediaRecorder&&isRecording)mediaRecorder.stop();
}

// ========================================
// 録画インジケーター（画面右上に常駐）
// ========================================

function _startRecordingIndicator(){
  _stopRecordingIndicator();// 二重防止
  const el=document.createElement('div');
  el.id='capture-rec-indicator';
  el.innerHTML='<span class="rec-dot"></span><span class="rec-label">REC</span><span class="rec-time" id="rec-time-text">0:00</span><button class="rec-stop-btn" title="録画停止（Alt+R）">■ 停止</button>';

  const style=document.createElement('style');
  style.setAttribute('data-rec-indicator','true');
  style.textContent=`
    #capture-rec-indicator{
      position:fixed;top:72px;right:16px;
      display:flex;align-items:center;gap:8px;
      background:rgba(20,20,20,.92);backdrop-filter:blur(8px);
      color:#fff;padding:8px 14px;border-radius:24px;
      font-size:13px;font-weight:600;z-index:99998;
      box-shadow:0 4px 16px rgba(0,0,0,.4);
      border:1px solid rgba(255,255,255,.12);
    }
    .rec-dot{
      width:10px;height:10px;border-radius:50%;
      background:#ff3b30;
      animation:rec-blink 1s ease infinite;
      flex-shrink:0;
    }
    @keyframes rec-blink{0%,100%{opacity:1;}50%{opacity:.3;}}
    .rec-label{font-size:11px;letter-spacing:.08em;color:#ff3b30;}
    .rec-time{font-variant-numeric:tabular-nums;min-width:34px;}
    .rec-stop-btn{
      padding:3px 10px;border-radius:12px;border:none;
      background:#ff3b30;color:#fff;font-size:11px;font-weight:700;
      cursor:pointer;transition:background .12s;white-space:nowrap;
    }
    .rec-stop-btn:hover{background:#ff6b35;}
  `;
  if(!document.querySelector('style[data-rec-indicator]'))document.head.appendChild(style);
  document.body.appendChild(el);
  el.querySelector('.rec-stop-btn').addEventListener('click',stopRecording);
  _recTimerEl=document.getElementById('rec-time-text');
  _recTimerInterval=setInterval(()=>{
    if(!_recTimerEl)return;
    const elapsed=Math.floor((Date.now()-_recStartTime)/1000);
    const m=Math.floor(elapsed/60);
    const s=String(elapsed%60).padStart(2,'0');
    _recTimerEl.textContent=`${m}:${s}`;
  },1000);
  _recTimerEl=document.getElementById('rec-time-text');
}

function _stopRecordingIndicator(){
  if(_recTimerInterval){clearInterval(_recTimerInterval);_recTimerInterval=null;}
  document.getElementById('capture-rec-indicator')?.remove();
  _recTimerEl=null;
}

// ========================================
// 通知
// ========================================

function showNotification(message,type='info'){
  if(!document.querySelector('style[data-capture-notification]')){
    const s=document.createElement('style');
    s.setAttribute('data-capture-notification','true');
    s.textContent=`
      .capture-notification{
        position:fixed;top:72px;right:16px;
        padding:10px 16px;
        background:var(--bg-primary,#fff);
        border:1px solid var(--border,#d0d7de);
        border-radius:10px;
        box-shadow:0 4px 16px rgba(0,0,0,.12);
        font-size:13px;font-weight:600;
        z-index:99997;
        animation:ch-notif-in .25s ease both;
        display:flex;align-items:center;gap:8px;
        max-width:320px;
      }
      .capture-notification.success{border-left:3px solid #2da44e;color:var(--text-primary,#24292f);}
      .capture-notification.error{border-left:3px solid #cf222e;color:#cf222e;}
      .capture-notification.info{border-left:3px solid var(--main,#ff6b35);color:var(--text-primary,#24292f);}
      @keyframes ch-notif-in{from{transform:translateX(120%);opacity:0;}to{transform:translateX(0);opacity:1;}}
    `;
    document.head.appendChild(s);
  }
  // 既存の録画インジケーターの下にずらす
  const hasRec=!!document.getElementById('capture-rec-indicator');
  const notification=document.createElement('div');
  notification.className=`capture-notification ${type}`;
  notification.style.top=hasRec?'116px':'72px';
  notification.textContent=message;
  document.body.appendChild(notification);
  setTimeout(()=>{
    notification.style.animation='ch-notif-in .2s ease reverse';
    setTimeout(()=>notification.remove(),220);
  },3000);
}

// ========================================
// BroadcastChannel
// ========================================

const channel=new BroadcastChannel('apphub-media-updates');
function notifyMediaUpdate(){channel.postMessage({type:'media-updated'});}

// ========================================
// キーボードショートカット
// ========================================

document.addEventListener('keydown',(e)=>{
  if(e.altKey&&e.key.toLowerCase()==='s'){e.preventDefault();takeScreenshot();}
  if(e.altKey&&e.key.toLowerCase()==='r'){e.preventDefault();isRecording?stopRecording():startRecording();}
});

// ========================================
// 初期化
// ========================================

initDB().then(()=>{
  console.log('📸 Capture Handler v2.0 準備完了 | Alt+S: スクショ | Alt+R: 録画');
}).catch(e=>console.error('IndexedDB初期化エラー:',e));