import{initPage}from'../common/core.js';

await initPage('images','画像・録画');

// ========================================
// IndexedDB接続
// ========================================

const DB_NAME='apphub_captures';
const DB_VERSION=1;
let db=null;

async function initDB(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
      db=request.result;
      resolve(db);
    };
  });
}

// ========================================
// データ読み込み
// ========================================

async function loadScreenshots(){
  const transaction=db.transaction(['screenshots'],'readonly');
  const store=transaction.objectStore('screenshots');
  const request=store.getAll();
  
  return new Promise((resolve,reject)=>{
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}

async function loadRecordings(){
  const transaction=db.transaction(['recordings'],'readonly');
  const store=transaction.objectStore('recordings');
  const request=store.getAll();
  
  return new Promise((resolve,reject)=>{
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}

// ========================================
// UI表示
// ========================================

async function displayCaptures(){
  const screenshots=await loadScreenshots();
  const recordings=await loadRecordings();
  
  displayScreenshots(screenshots);
  displayRecordings(recordings);
}

function displayScreenshots(screenshots){
  const grid=document.getElementById('screenshots-grid');
  
  if(screenshots.length===0){
    grid.innerHTML=`
      <div class="empty-state">
        <span class="material-symbols-outlined">photo_library</span>
        <p>スクリーンショットがありません</p>
      </div>
    `;
    return;
  }
  
  grid.innerHTML='';
  
  // 新しい順に表示
  screenshots.reverse().forEach(item=>{
    const date=new Date(item.timestamp);
    const dateStr=date.toLocaleString('ja-JP');
    
    const el=document.createElement('div');
    el.className='capture-item';
    el.innerHTML=`
      <img class="capture-preview" src="${URL.createObjectURL(item.blob)}" alt="スクリーンショット">
      <div class="capture-info">
        <div class="capture-date">${dateStr}</div>
        <div class="capture-actions">
          <button class="btn-primary btn-small" onclick="downloadCapture(${item.id},'screenshot')">
            <span class="material-symbols-outlined">download</span>
            <span>ダウンロード</span>
          </button>
          <button class="btn-secondary btn-small" onclick="deleteCapture(${item.id},'screenshot')">
            <span class="material-symbols-outlined">delete</span>
          </button>
        </div>
      </div>
    `;
    grid.appendChild(el);
  });
}

function displayRecordings(recordings){
  const grid=document.getElementById('recordings-grid');
  
  if(recordings.length===0){
    grid.innerHTML=`
      <div class="empty-state">
        <span class="material-symbols-outlined">video_library</span>
        <p>録画がありません</p>
      </div>
    `;
    return;
  }
  
  grid.innerHTML='';
  
  // 新しい順に表示
  recordings.reverse().forEach(item=>{
    const date=new Date(item.timestamp);
    const dateStr=date.toLocaleString('ja-JP');
    
    const el=document.createElement('div');
    el.className='capture-item';
    el.innerHTML=`
      <video class="capture-preview" src="${URL.createObjectURL(item.blob)}" controls></video>
      <div class="capture-info">
        <div class="capture-date">${dateStr}</div>
        <div class="capture-actions">
          <button class="btn-primary btn-small" onclick="downloadCapture(${item.id},'recording')">
            <span class="material-symbols-outlined">download</span>
            <span>ダウンロード</span>
          </button>
          <button class="btn-secondary btn-small" onclick="deleteCapture(${item.id},'recording')">
            <span class="material-symbols-outlined">delete</span>
          </button>
        </div>
      </div>
    `;
    grid.appendChild(el);
  });
}

// ========================================
// ダウンロード
// ========================================

async function downloadCapture(id,type){
  const storeName=type==='screenshot'?'screenshots':'recordings';
  const transaction=db.transaction([storeName],'readonly');
  const store=transaction.objectStore(storeName);
  const request=store.get(id);
  
  request.onsuccess=()=>{
    const item=request.result;
    const url=URL.createObjectURL(item.blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`${type}_${item.timestamp}.${type==='screenshot'?'png':'webm'}`;
    a.click();
    URL.revokeObjectURL(url);
  };
}

window.downloadCapture=downloadCapture;

// ========================================
// 削除
// ========================================

async function deleteCapture(id,type){
  if(!confirm('削除してもよろしいですか？')){
    return;
  }
  
  const storeName=type==='screenshot'?'screenshots':'recordings';
  const transaction=db.transaction([storeName],'readwrite');
  const store=transaction.objectStore(storeName);
  store.delete(id);
  
  transaction.oncomplete=()=>{
    displayCaptures();
  };
}

window.deleteCapture=deleteCapture;

// ========================================
// 全削除
// ========================================

document.getElementById('clear-screenshots-btn').addEventListener('click',async()=>{
  if(!confirm('全てのスクリーンショットを削除してもよろしいですか？')){
    return;
  }
  
  const transaction=db.transaction(['screenshots'],'readwrite');
  const store=transaction.objectStore('screenshots');
  store.clear();
  
  transaction.oncomplete=()=>{
    displayCaptures();
  };
});

document.getElementById('clear-recordings-btn').addEventListener('click',async()=>{
  if(!confirm('全ての録画を削除してもよろしいですか？')){
    return;
  }
  
  const transaction=db.transaction(['recordings'],'readwrite');
  const store=transaction.objectStore('recordings');
  store.clear();
  
  transaction.oncomplete=()=>{
    displayCaptures();
  };
});

// ========================================
// クイックアクション
// ========================================

document.getElementById('take-screenshot-btn').addEventListener('click',()=>{
  window.takeScreenshot();
});

document.getElementById('start-recording-btn').addEventListener('click',()=>{
  window.startRecording();
});

document.getElementById('clipboard-download-btn').addEventListener('click',async()=>{
  try{
    const items=await navigator.clipboard.read();
    
    for(const item of items){
      if(item.types.includes('image/png')){
        const blob=await item.getType('image/png');
        const url=URL.createObjectURL(blob);
        const a=document.createElement('a');
        a.href=url;
        a.download=`clipboard_${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
        
        alert('✓ クリップボードの画像をダウンロードしました');
        return;
      }
    }
    
    alert('⚠️ クリップボードに画像がありません');
  }catch(error){
    console.error('クリップボードエラー:',error);
    alert('❌ クリップボードの読み取りに失敗しました');
  }
});

// ========================================
// 初期化
// ========================================

initDB().then(()=>{
  displayCaptures();
}).catch(err=>{
  console.error('IndexedDB初期化エラー:',err);
});