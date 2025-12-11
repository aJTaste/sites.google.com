// ========================================
// AppHub Capture Handler
// 全ページで Alt+S (スクショ) / Alt+R (録画) を実行
// ========================================

const CAPTURE_DB_NAME='AppHubCaptures';
const CAPTURE_DB_VERSION=1;
const CAPTURE_STORE_NAME='media';

let db=null;
let mediaRecorder=null;
let recordedChunks=[];
let isRecording=false;

// ========================================
// IndexedDB 初期化
// ========================================

async function initDB(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(CAPTURE_DB_NAME,CAPTURE_DB_VERSION);
    
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
      db=request.result;
      resolve(db);
    };
    
    request.onupgradeneeded=(e)=>{
      const db=e.target.result;
      if(!db.objectStoreNames.contains(CAPTURE_STORE_NAME)){
        const store=db.createObjectStore(CAPTURE_STORE_NAME,{keyPath:'id',autoIncrement:true});
        store.createIndex('timestamp','timestamp',{unique:false});
        store.createIndex('type','type',{unique:false});
      }
    };
  });
}

// ========================================
// IndexedDB へ保存
// ========================================

async function saveToIndexedDB(blob,type){
  if(!db)await initDB();
  
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction([CAPTURE_STORE_NAME],'readwrite');
    const store=transaction.objectStore(CAPTURE_STORE_NAME);
    
    const now=new Date();
    const timestamp=now.getTime();
    const filename=formatFilename(now,type);
    
    const data={
      blob:blob,
      type:type,
      filename:filename,
      timestamp:timestamp,
      size:blob.size
    };
    
    const request=store.add(data);
    
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}

// ========================================
// ファイル名生成（YYYY-MM-DD_HHMMSS）
// ========================================

function formatFilename(date,type){
  const y=date.getFullYear();
  const m=String(date.getMonth()+1).padStart(2,'0');
  const d=String(date.getDate()).padStart(2,'0');
  const h=String(date.getHours()).padStart(2,'0');
  const min=String(date.getMinutes()).padStart(2,'0');
  const s=String(date.getSeconds()).padStart(2,'0');
  
  const ext=type==='image'?'png':'webm';
  return `${y}-${m}-${d}_${h}${min}${s}.${ext}`;
}

// ========================================
// File System Access API でダウンロード
// ========================================

async function downloadBlob(blob,filename){
  try{
    // File System Access API対応確認
    if('showSaveFilePicker' in window){
      const opts={
        suggestedName:filename,
        types:[{
          description:'Media File',
          accept:{'image/png':['.png'],'video/webm':['.webm']}
        }]
      };
      
      const handle=await window.showSaveFilePicker(opts);
      const writable=await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      
      console.log('✓ File System Access APIで保存:',filename);
    }else{
      // フォールバック: 通常のダウンロード
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url;
      a.download=filename;
      a.click();
      URL.revokeObjectURL(url);
      
      console.log('✓ 通常ダウンロード:',filename);
    }
  }catch(error){
    if(error.name!=='AbortError'){
      console.error('ダウンロードエラー:',error);
      alert('ダウンロードに失敗しました');
    }
  }
}

// ========================================
// スクリーンショット撮影
// ========================================

async function takeScreenshot(){
  try{
    // getDisplayMedia でキャプチャ
    const stream=await navigator.mediaDevices.getDisplayMedia({
      video:{mediaSource:'screen'},
      audio:false
    });
    
    // ビデオトラックから1フレーム取得
    const track=stream.getVideoTracks()[0];
    const imageCapture=new ImageCapture(track);
    const bitmap=await imageCapture.grabFrame();
    
    // Canvasに描画してPNGに変換
    const canvas=document.createElement('canvas');
    canvas.width=bitmap.width;
    canvas.height=bitmap.height;
    const ctx=canvas.getContext('2d');
    ctx.drawImage(bitmap,0,0);
    
    // トラック停止
    track.stop();
    
    // Blobに変換
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    
    // IndexedDBに保存
    const id=await saveToIndexedDB(blob,'image');
    
    // すぐにダウンロード
    const filename=formatFilename(new Date(),'image');
    await downloadBlob(blob,filename);
    
    // 他のタブに通知（リアルタイム反映）
    notifyMediaUpdate();
    
    showNotification('スクリーンショットを保存しました','success');
  }catch(error){
    if(error.name==='NotAllowedError'){
      console.log('キャンセルされました');
    }else{
      console.error('スクショエラー:',error);
      showNotification('スクリーンショットに失敗しました','error');
    }
  }
}

// ========================================
// 録画開始
// ========================================

async function startRecording(){
  if(isRecording)return;
  
  try{
    const stream=await navigator.mediaDevices.getDisplayMedia({
      video:{mediaSource:'screen'},
      audio:true
    });
    
    // 🎬 画面選択モーダルが消えるまで待機（10フレーム ≈ 167ms）
    await new Promise(resolve=>setTimeout(resolve,167));
    
    mediaRecorder=new MediaRecorder(stream,{
      mimeType:'video/webm;codecs=vp8,opus'
    });
    
    recordedChunks=[];
    
    mediaRecorder.ondataavailable=(e)=>{
      if(e.data.size>0){
        recordedChunks.push(e.data);
      }
    };
    
    mediaRecorder.onstop=async()=>{
      const blob=new Blob(recordedChunks,{type:'video/webm'});
      
      // IndexedDBに保存
      const id=await saveToIndexedDB(blob,'video');
      
      // すぐにダウンロード
      const filename=formatFilename(new Date(),'video');
      await downloadBlob(blob,filename);
      
      // 他のタブに通知（リアルタイム反映）
      notifyMediaUpdate();
      
      showNotification('録画を保存しました','success');
      
      // ストリーム停止
      stream.getTracks().forEach(track=>track.stop());
      isRecording=false;
    };
    
    mediaRecorder.start();
    isRecording=true;
    
    showNotification('録画を開始しました（Alt+R で停止）','info');
  }catch(error){
    if(error.name==='NotAllowedError'){
      console.log('キャンセルされました');
    }else{
      console.error('録画エラー:',error);
      showNotification('録画に失敗しました','error');
    }
  }
}

// ========================================
// 録画停止
// ========================================

function stopRecording(){
  if(mediaRecorder&&isRecording){
    mediaRecorder.stop();
  }
}

// ========================================
// 通知表示
// ========================================

function showNotification(message,type='info'){
  const notification=document.createElement('div');
  notification.className=`capture-notification ${type}`;
  notification.textContent=message;
  
  const style=document.createElement('style');
  style.textContent=`
    .capture-notification{
      position:fixed;
      top:80px;
      right:24px;
      padding:12px 20px;
      background:var(--bg-primary);
      border:1px solid var(--border);
      border-radius:8px;
      box-shadow:0 4px 12px rgba(0,0,0,0.15);
      font-size:14px;
      font-weight:600;
      z-index:9999;
      animation:slideIn 0.3s ease;
    }
    .capture-notification.success{
      border-color:#2da44e;
      color:#2da44e;
    }
    .capture-notification.error{
      border-color:#cf222e;
      color:#cf222e;
    }
    .capture-notification.info{
      border-color:var(--main);
      color:var(--main);
    }
    @keyframes slideIn{
      from{transform:translateX(400px);opacity:0;}
      to{transform:translateX(0);opacity:1;}
    }
  `;
  
  if(!document.querySelector('style[data-capture-notification]')){
    style.setAttribute('data-capture-notification','true');
    document.head.appendChild(style);
  }
  
  document.body.appendChild(notification);
  
  setTimeout(()=>{
    notification.style.animation='slideIn 0.3s ease reverse';
    setTimeout(()=>notification.remove(),300);
  },3000);
}

// ========================================
// キーボードイベント
// ========================================

document.addEventListener('keydown',(e)=>{
  // Alt+S: スクリーンショット
  if(e.altKey&&e.key.toLowerCase()==='s'){
    e.preventDefault();
    takeScreenshot();
  }
  
  // Alt+R: 録画開始/停止
  if(e.altKey&&e.key.toLowerCase()==='r'){
    e.preventDefault();
    if(!isRecording){
      startRecording();
    }else{
      stopRecording();
    }
  }
});

// ========================================
// 初期化
// ========================================

// BroadcastChannel（リアルタイム反映用）
const channel=new BroadcastChannel('apphub-media-updates');

function notifyMediaUpdate(){
  channel.postMessage({type:'media-updated'});
}

initDB().then(()=>{
  console.log('📸 Capture Handler 準備完了');
  console.log('Alt+S: スクリーンショット');
  console.log('Alt+R: 録画開始/停止');
}).catch(error=>{
  console.error('IndexedDB初期化エラー:',error);
});