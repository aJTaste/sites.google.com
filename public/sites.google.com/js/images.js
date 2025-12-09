import{initPage}from'../common/core.js';

await initPage('images','画像・動画管理');

// ========================================
// IndexedDB 接続
// ========================================

const CAPTURE_DB_NAME='AppHubCaptures';
const CAPTURE_STORE_NAME='media';

let db=null;
let currentFilter='all';
let allMedia=[];
let clipboardBlob=null;

async function initDB(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(CAPTURE_DB_NAME,1);
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{
      db=request.result;
      resolve(db);
    };
  });
}

// ========================================
// メディア読み込み
// ========================================

async function loadMedia(){
  if(!db)await initDB();
  
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction([CAPTURE_STORE_NAME],'readonly');
    const store=transaction.objectStore(CAPTURE_STORE_NAME);
    const request=store.getAll();
    
    request.onsuccess=()=>{
      allMedia=request.result.sort((a,b)=>b.timestamp-a.timestamp);
      resolve(allMedia);
    };
    request.onerror=()=>reject(request.error);
  });
}

// ========================================
// メディア表示
// ========================================

async function displayMedia(){
  const grid=document.getElementById('media-grid');
  const emptyState=document.getElementById('empty-state');
  
  await loadMedia();
  
  // フィルタリング
  let filtered=allMedia;
  if(currentFilter!=='all'){
    filtered=allMedia.filter(m=>m.type===currentFilter);
  }
  
  // 空の状態
  if(filtered.length===0){
    grid.style.display='none';
    emptyState.style.display='flex';
    return;
  }
  
  grid.style.display='grid';
  emptyState.style.display='none';
  grid.innerHTML='';
  
  // 統計更新
  updateStats();
  
  // グリッド生成
  filtered.forEach(media=>{
    const item=document.createElement('div');
    item.className='media-item';
    item.dataset.id=media.id;
    
    const typeIcon=media.type==='image'?'image':'videocam';
    const url=URL.createObjectURL(media.blob);
    
    const thumbnailTag=media.type==='image'
      ?`<img class="media-thumbnail" src="${url}" alt="${media.filename}">`
      :`<video class="media-thumbnail" src="${url}" muted></video>`;
    
    const size=(media.size/1024).toFixed(1);
    const date=new Date(media.timestamp).toLocaleString('ja-JP');
    
    item.innerHTML=`
      ${thumbnailTag}
      <div class="media-type-badge">
        <span class="material-symbols-outlined">${typeIcon}</span>
        <span>${media.type==='image'?'画像':'動画'}</span>
      </div>
      <div class="media-actions">
        <button class="media-action-btn" onclick="downloadMedia(${media.id})" title="ダウンロード">
          <span class="material-symbols-outlined">download</span>
        </button>
        <button class="media-action-btn" onclick="deleteMedia(${media.id})" title="削除">
          <span class="material-symbols-outlined">delete</span>
        </button>
      </div>
      <div class="media-info">
        <div class="media-name">${media.filename}</div>
        <div class="media-meta">${size} KB • ${date}</div>
      </div>
    `;
    
    // クリックでプレビュー
    item.addEventListener('click',(e)=>{
      if(!e.target.closest('.media-action-btn')){
        openPreview(media.id);
      }
    });
    
    grid.appendChild(item);
  });
}

// ========================================
// 統計更新
// ========================================

function updateStats(){
  const images=allMedia.filter(m=>m.type==='image').length;
  const videos=allMedia.filter(m=>m.type==='video').length;
  const totalSize=allMedia.reduce((sum,m)=>sum+m.size,0);
  
  document.getElementById('stat-images').textContent=images;
  document.getElementById('stat-videos').textContent=videos;
  document.getElementById('stat-size').textContent=(totalSize/1024/1024).toFixed(2)+' MB';
}

// ========================================
// プレビューモーダル
// ========================================

function openPreview(id){
  const media=allMedia.find(m=>m.id===id);
  if(!media)return;
  
  const modal=document.getElementById('preview-modal');
  const content=document.getElementById('modal-content');
  const url=URL.createObjectURL(media.blob);
  
  if(media.type==='image'){
    content.innerHTML=`<img src="${url}" alt="${media.filename}">`;
  }else{
    content.innerHTML=`<video src="${url}" controls autoplay></video>`;
  }
  
  modal.classList.add('show');
  
  // ダウンロード・削除ボタン
  document.getElementById('modal-download').onclick=()=>downloadMedia(id);
  document.getElementById('modal-delete').onclick=()=>{
    deleteMedia(id);
    modal.classList.remove('show');
  };
}

// ========================================
// ダウンロード
// ========================================

window.downloadMedia=async function(id){
  const media=allMedia.find(m=>m.id===id);
  if(!media)return;
  
  try{
    if('showSaveFilePicker' in window){
      const opts={
        suggestedName:media.filename,
        types:[{
          description:'Media File',
          accept:{'image/png':['.png'],'video/webm':['.webm']}
        }]
      };
      
      const handle=await window.showSaveFilePicker(opts);
      const writable=await handle.createWritable();
      await writable.write(media.blob);
      await writable.close();
    }else{
      const url=URL.createObjectURL(media.blob);
      const a=document.createElement('a');
      a.href=url;
      a.download=media.filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  }catch(error){
    if(error.name!=='AbortError'){
      console.error('ダウンロードエラー:',error);
      alert('ダウンロードに失敗しました');
    }
  }
}

// ========================================
// 削除
// ========================================

window.deleteMedia=async function(id){
  if(!confirm('この項目を削除しますか？'))return;
  
  if(!db)await initDB();
  
  return new Promise((resolve,reject)=>{
    const transaction=db.transaction([CAPTURE_STORE_NAME],'readwrite');
    const store=transaction.objectStore(CAPTURE_STORE_NAME);
    const request=store.delete(id);
    
    request.onsuccess=()=>{
      displayMedia();
      resolve();
    };
    request.onerror=()=>reject(request.error);
  });
}

// ========================================
// すべて削除
// ========================================

document.getElementById('clear-all-btn').addEventListener('click',async()=>{
  if(!confirm('すべての画像・動画を削除しますか？'))return;
  
  if(!db)await initDB();
  
  const transaction=db.transaction([CAPTURE_STORE_NAME],'readwrite');
  const store=transaction.objectStore(CAPTURE_STORE_NAME);
  await store.clear();
  
  displayMedia();
});

// ========================================
// フィルター
// ========================================

document.querySelectorAll('.filter-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter=btn.dataset.filter;
    displayMedia();
  });
});

// ========================================
// クリップボード機能
// ========================================

document.getElementById('paste-btn').addEventListener('click',async()=>{
  try{
    const items=await navigator.clipboard.read();
    
    for(const item of items){
      if(item.types.includes('image/png')){
        const blob=await item.getType('image/png');
        clipboardBlob=blob;
        
        const url=URL.createObjectURL(blob);
        document.getElementById('clipboard-img').src=url;
        document.getElementById('clipboard-preview').style.display='block';
        document.getElementById('download-clipboard-btn').disabled=false;
        
        break;
      }
    }
  }catch(error){
    console.error('クリップボード読み込みエラー:',error);
    alert('クリップボードから画像を読み込めませんでした');
  }
});

document.getElementById('download-clipboard-btn').addEventListener('click',async()=>{
  if(!clipboardBlob)return;
  
  const now=new Date();
  const y=now.getFullYear();
  const m=String(now.getMonth()+1).padStart(2,'0');
  const d=String(now.getDate()).padStart(2,'0');
  const h=String(now.getHours()).padStart(2,'0');
  const min=String(now.getMinutes()).padStart(2,'0');
  const s=String(now.getSeconds()).padStart(2,'0');
  const filename=`${y}-${m}-${d}_${h}${min}${s}.png`;
  
  try{
    if('showSaveFilePicker' in window){
      const opts={
        suggestedName:filename,
        types:[{
          description:'PNG Image',
          accept:{'image/png':['.png']}
        }]
      };
      
      const handle=await window.showSaveFilePicker(opts);
      const writable=await handle.createWritable();
      await writable.write(clipboardBlob);
      await writable.close();
    }else{
      const url=URL.createObjectURL(clipboardBlob);
      const a=document.createElement('a');
      a.href=url;
      a.download=filename;
      a.click();
      URL.revokeObjectURL(url);
    }
  }catch(error){
    if(error.name!=='AbortError'){
      console.error('ダウンロードエラー:',error);
      alert('ダウンロードに失敗しました');
    }
  }
});

// ========================================
// モーダル閉じる
// ========================================

document.getElementById('modal-close').addEventListener('click',()=>{
  document.getElementById('preview-modal').classList.remove('show');
});

document.getElementById('preview-modal').addEventListener('click',(e)=>{
  if(e.target.id==='preview-modal'){
    document.getElementById('preview-modal').classList.remove('show');
  }
});

// ========================================
// 初期化
// ========================================

displayMedia();