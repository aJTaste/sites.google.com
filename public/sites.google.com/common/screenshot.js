// ========================================
// スクリーンショット・録画システム
// ========================================

// IndexedDB設定
const DB_NAME='apphub_captures';
const DB_VERSION=1;
let db=null;

// 録画状態
let mediaRecorder=null;
let recordedChunks=[];
let isRecording=false;

// ========================================
// IndexedDB初期化
// ========================================

async function initDB(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
      db=request.result;
      resolve(db);
    };
    
    request.onupgradeneeded=(e)=>{
      const db=e.target.result;
      
      // スクリーンショット用
      if(!db.objectStoreNames.contains('screenshots')){
        const store=db.createObjectStore('screenshots',{keyPath:'id',autoIncrement:true});
        store.createIndex('timestamp','timestamp',{unique:false});
      }
      
      // 録画用
      if(!db.objectStoreNames.contains('recordings')){
        const store=db.createObjectStore('recordings',{keyPath:'id',autoIncrement:true});
        store.createIndex('timestamp','timestamp',{unique:false});
      }
    };
  });
}

// ========================================
// スクリーンショット撮影
// ========================================

async function takeScreenshot(){
  try{
    // 画面選択
    const stream=await navigator.mediaDevices.getDisplayMedia({
      video:{mediaSource:'screen'}
    });
    
    // ビデオトラックから1フレーム取得
    const track=stream.getVideoTracks()[0];
    const imageCapture=new ImageCapture(track);
    const bitmap=await imageCapture.grabFrame();
    
    // Canvasに描画
    const canvas=document.createElement('canvas');
    canvas.width=bitmap.width;
    canvas.height=bitmap.height;
    const ctx=canvas.getContext('2d');
    ctx.drawImage(bitmap,0,0);
    
    // 停止
    stream.getTracks().forEach(track=>track.stop());
    
    // Blobに変換
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    
    // IndexedDBに保存
    await saveScreenshot(blob);
    
    // 通知
    showNotification('📸 スクリーンショットを保存しました');
    
    return blob;
  }catch(error){
    console.error('スクリーンショットエラー:',error);
    if(error.name!=='NotAllowedError'){
      showNotification('❌ スクリーンショットに失敗しました','error');
    }
  }
}

// スクリーンショットをDBに保存
async function saveScreenshot(blob){
  const transaction=db.transaction(['screenshots'],'readwrite');
  const store=transaction.objectStore('screenshots');
  
  const data={
    blob:blob,
    timestamp:Date.now(),
    type:'screenshot'
  };
  
  await store.add(data);
}

// ========================================
// 録画機能
// ========================================

async function startRecording(){
  try{
    // 画面選択
    const stream=await navigator.mediaDevices.getDisplayMedia({
      video:{mediaSource:'screen'},
      audio:true // 音声も録画
    });
    
    recordedChunks=[];
    
    // MediaRecorder設定
    mediaRecorder=new MediaRecorder(stream,{
      mimeType:'video/webm;codecs=vp9'
    });
    
    mediaRecorder.ondataavailable=(e)=>{
      if(e.data.size>0){
        recordedChunks.push(e.data);
      }
    };
    
    mediaRecorder.onstop=async()=>{
      const blob=new Blob(recordedChunks,{type:'video/webm'});
      await saveRecording(blob);
      showNotification('🎥 録画を保存しました');
      
      // ストリーム停止
      stream.getTracks().forEach(track=>track.stop());
    };
    
    mediaRecorder.start();
    isRecording=true;
    
    showNotification('🔴 録画を開始しました');
    
    // 録画停止ボタンを表示
    showRecordingIndicator();
    
  }catch(error){
    console.error('録画エラー:',error);
    if(error.name!=='NotAllowedError'){
      showNotification('❌ 録画に失敗しました','error');
    }
  }
}

function stopRecording(){
  if(mediaRecorder&&isRecording){
    mediaRecorder.stop();
    isRecording=false;
    hideRecordingIndicator();
  }
}

// 録画をDBに保存
async function saveRecording(blob){
  const transaction=db.transaction(['recordings'],'readwrite');
  const store=transaction.objectStore('recordings');
  
  const data={
    blob:blob,
    timestamp:Date.now(),
    type:'recording'
  };
  
  await store.add(data);
}

// ========================================
// 録画インジケーター
// ========================================

function showRecordingIndicator(){
  const indicator=document.createElement('div');
  indicator.id='recording-indicator';
  indicator.innerHTML=`
    <div style="position:fixed;top:20px;right:20px;background:#ff0000;color:#fff;padding:12px 20px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);z-index:10000;display:flex;align-items:center;gap:12px;font-family:sans-serif;font-size:14px;font-weight:600;">
      <div style="width:12px;height:12px;background:#fff;border-radius:50%;animation:pulse 1s infinite;"></div>
      録画中
      <button onclick="window.stopRecording()" style="background:#fff;color:#ff0000;border:none;padding:6px 12px;border-radius:4px;cursor:pointer;font-weight:600;margin-left:8px;">停止</button>
    </div>
    <style>
      @keyframes pulse{
        0%,100%{opacity:1;}
        50%{opacity:0.3;}
      }
    </style>
  `;
  document.body.appendChild(indicator);
}

function hideRecordingIndicator(){
  const indicator=document.getElementById('recording-indicator');
  if(indicator){
    indicator.remove();
  }
}

// ========================================
// 通知表示
// ========================================

function showNotification(message,type='success'){
  const notification=document.createElement('div');
  const bgColor=type==='error'?'#ff4444':'#00a77a';
  
  notification.innerHTML=`
    <div style="position:fixed;top:20px;right:20px;background:${bgColor};color:#fff;padding:12px 20px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);z-index:10000;font-family:sans-serif;font-size:14px;animation:slideIn 0.3s;">
      ${message}
    </div>
    <style>
      @keyframes slideIn{
        from{transform:translateX(100%);}
        to{transform:translateX(0);}
      }
    </style>
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(()=>{
    notification.style.opacity='0';
    notification.style.transition='opacity 0.3s';
    setTimeout(()=>notification.remove(),300);
  },3000);
}

// ========================================
// ショートカットキー監視
// ========================================

document.addEventListener('keydown',(e)=>{
  // Meta + S: スクリーンショットにctrlを足した
  if(e.ctrlKey&&e.altKey&&e.key==='s'){
    e.preventDefault();
    takeScreenshot();
  }
  
  // Meta + R: 録画開始/停止にctrlを足した
  if(e.ctrlKey&&e.altKey&&e.key==='r'){
    e.preventDefault();
    if(isRecording){
      stopRecording();
    }else{
      startRecording();
    }
  }
});

// ========================================
// グローバルに公開
// ========================================

window.takeScreenshot=takeScreenshot;
window.startRecording=startRecording;
window.stopRecording=stopRecording;

// ========================================
// 初期化
// ========================================

initDB().then(()=>{
  console.log('📸 スクリーンショットシステム準備完了');
}).catch(err=>{
  console.error('IndexedDB初期化エラー:',err);
});