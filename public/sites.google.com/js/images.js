import{initPage}from'../common/core.js';
await initPage('images','Images');

// ==========================================
// IndexedDB
// ==========================================
const CAPTURE_DB_NAME='AppHubCaptures';
const CAPTURE_STORE_NAME='media';
const MAX_STORAGE_MB=200;// ストレージバー満杯の基準

let db=null;
let allMedia=[];
let currentFilter='all';
let currentSort='newest';
let selectMode=false;
let selectedIds=new Set();
let previewIndex=-1;// 現在モーダルで表示中のインデックス（filtered配列上）

// BroadcastChannel（他タブからの更新受信）
const bc=new BroadcastChannel('apphub-media-updates');
bc.onmessage=(e)=>{if(e.data.type==='media-updated')_load();};

async function _initDB(){
  if(db)return db;
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(CAPTURE_DB_NAME,1);
    req.onerror=()=>reject(req.error);
    req.onsuccess=()=>{db=req.result;resolve(db);};
    req.onupgradeneeded=(e)=>{
      const d=e.target.result;
      if(!d.objectStoreNames.contains(CAPTURE_STORE_NAME)){
        const s=d.createObjectStore(CAPTURE_STORE_NAME,{keyPath:'id',autoIncrement:true});
        s.createIndex('timestamp','timestamp',{unique:false});
        s.createIndex('type','type',{unique:false});
      }
    };
  });
}

async function _load(){
  await _initDB();
  allMedia=await new Promise((resolve,reject)=>{
    const tx=db.transaction([CAPTURE_STORE_NAME],'readonly');
    const req=tx.objectStore(CAPTURE_STORE_NAME).getAll();
    req.onsuccess=()=>resolve(req.result||[]);
    req.onerror=()=>reject(req.error);
  });
  _renderAll();
}

async function _deleteById(id){
  await _initDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction([CAPTURE_STORE_NAME],'readwrite');
    const req=tx.objectStore(CAPTURE_STORE_NAME).delete(id);
    req.onsuccess=resolve;req.onerror=()=>reject(req.error);
  });
}

async function _saveToDB(blob,type){
  await _initDB();
  const now=new Date();
  const pad=n=>String(n).padStart(2,'0');
  const filename=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.${type==='image'?'png':'webm'}`;
  return new Promise((resolve,reject)=>{
    const tx=db.transaction([CAPTURE_STORE_NAME],'readwrite');
    const req=tx.objectStore(CAPTURE_STORE_NAME).add({blob,type,filename,timestamp:now.getTime(),size:blob.size});
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
}

// ==========================================
// フィルタリング＆ソート
// ==========================================
function _getFiltered(){
  let list=currentFilter==='all'?[...allMedia]:allMedia.filter(m=>m.type===currentFilter);
  switch(currentSort){
    case 'newest': list.sort((a,b)=>b.timestamp-a.timestamp); break;
    case 'oldest': list.sort((a,b)=>a.timestamp-b.timestamp); break;
    case 'largest': list.sort((a,b)=>b.size-a.size); break;
    case 'smallest': list.sort((a,b)=>a.size-b.size); break;
  }
  return list;
}

// ==========================================
// 描画
// ==========================================
function _renderAll(){
  _renderStats();
  _renderTabCounts();
  _renderGrid();
  _updateBatchBar();
}

function _renderStats(){
  const imgs=allMedia.filter(m=>m.type==='image').length;
  const vids=allMedia.filter(m=>m.type==='video').length;
  const totalBytes=allMedia.reduce((s,m)=>s+m.size,0);
  const totalMB=totalBytes/1024/1024;

  document.getElementById('stat-images').textContent=imgs;
  document.getElementById('stat-videos').textContent=vids;
  document.getElementById('stat-size').textContent=totalMB<1
    ?`${(totalMB*1024).toFixed(0)} KB`
    :`${totalMB.toFixed(1)} MB`;

  const pct=Math.min(100,totalMB/MAX_STORAGE_MB*100);
  const fill=document.getElementById('storage-bar-fill');
  if(fill)fill.style.width=pct+'%';
}

function _renderTabCounts(){
  const all=allMedia.length;
  const imgs=allMedia.filter(m=>m.type==='image').length;
  const vids=allMedia.filter(m=>m.type==='video').length;
  const setCount=(id,n)=>{const el=document.getElementById(id);if(el)el.textContent=n>0?n:'';};
  setCount('tab-all-count',all);
  setCount('tab-image-count',imgs);
  setCount('tab-video-count',vids);
}

function _renderGrid(){
  const grid=document.getElementById('media-grid');
  const empty=document.getElementById('empty-state');
  if(!grid||!empty)return;

  const list=_getFiltered();

  if(!list.length){
    grid.style.display='none';
    empty.style.display='flex';
    return;
  }
  empty.style.display='none';
  grid.style.display='grid';
  grid.innerHTML='';

  list.forEach((media,i)=>{
    const item=document.createElement('div');
    item.className='media-item'+(selectMode?' select-mode':'')+(selectedIds.has(media.id)?' selected':'');
    item.dataset.id=media.id;
    item.style.animationDelay=`${i*15}ms`;

    const url=URL.createObjectURL(media.blob);
    const isImg=media.type==='image';
    const thumb=isImg
      ?`<img class="media-thumbnail" src="${url}" alt="${_esc(media.filename)}" loading="lazy">`
      :`<video class="media-thumbnail" src="${url}" muted preload="metadata"></video>`;
    const sizeStr=media.size<1024*100
      ?`${(media.size/1024).toFixed(0)} KB`
      :`${(media.size/1024/1024).toFixed(1)} MB`;
    const dateStr=new Date(media.timestamp).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});

    item.innerHTML=`
      <div class="media-check"></div>
      ${thumb}
      <div class="media-type-badge">
        <span class="material-symbols-outlined">${isImg?'image':'videocam'}</span>
        ${isImg?'画像':'動画'}
      </div>
      <div class="media-hover-actions">
        <button class="media-hover-btn" data-action="download" title="DL">
          <span class="material-symbols-outlined">download</span>
        </button>
        <button class="media-hover-btn" data-action="delete" title="削除">
          <span class="material-symbols-outlined">delete</span>
        </button>
      </div>
      <div class="media-info">
        <div class="media-name">${_esc(media.filename)}</div>
        <div class="media-meta">${sizeStr} · ${dateStr}</div>
      </div>
    `;

    // クリック
    item.addEventListener('click',(e)=>{
      if(e.target.closest('.media-hover-btn'))return;
      if(selectMode){
        _toggleSelect(media.id);
        return;
      }
      const filtered=_getFiltered();
      const idx=filtered.findIndex(m=>m.id===media.id);
      _openModal(idx);
    });

    // アクションボタン
    item.addEventListener('click',(e)=>{
      const btn=e.target.closest('.media-hover-btn');
      if(!btn)return;
      e.stopPropagation();
      if(btn.dataset.action==='download')_downloadMedia(media);
      else if(btn.dataset.action==='delete')_confirmDelete([media.id]);
    });

    grid.appendChild(item);
  });
}

// ==========================================
// 選択モード
// ==========================================
function _setSelectMode(on){
  selectMode=on;
  if(!on)selectedIds.clear();
  document.getElementById('select-toggle-btn')?.classList.toggle('active',on);
  _renderGrid();
  _updateBatchBar();
}

function _toggleSelect(id){
  if(selectedIds.has(id))selectedIds.delete(id);
  else selectedIds.add(id);
  _renderGrid();
  _updateBatchBar();
}

function _updateBatchBar(){
  const bar=document.getElementById('batch-bar');
  const countEl=document.getElementById('batch-count');
  if(!bar)return;
  if(selectMode&&selectedIds.size>0){
    bar.classList.add('show');
    if(countEl)countEl.textContent=`${selectedIds.size}件選択中`;
  }else{
    bar.classList.remove('show');
  }
}

// ==========================================
// モーダル
// ==========================================
let _modalMedia=null;

function _openModal(idx){
  const list=_getFiltered();
  if(idx<0||idx>=list.length)return;
  previewIndex=idx;
  _modalMedia=list[idx];
  _renderModal();
  document.getElementById('preview-modal').classList.add('show');
}

function _renderModal(){
  const list=_getFiltered();
  const media=_modalMedia;
  if(!media)return;
  const content=document.getElementById('modal-content');
  const info=document.getElementById('modal-info');
  if(!content)return;

  // 既存のオブジェクトURLを解放
  const old=content.querySelector('img,video');
  if(old&&old.src&&old.src.startsWith('blob:'))URL.revokeObjectURL(old.src);
  content.innerHTML='';

  const url=URL.createObjectURL(media.blob);
  if(media.type==='image'){
    const img=document.createElement('img');
    img.src=url;img.alt=media.filename;
    content.appendChild(img);
  }else{
    const vid=document.createElement('video');
    vid.src=url;vid.controls=true;vid.autoplay=true;
    content.appendChild(vid);
  }

  if(info){
    const sizeStr=(media.size/1024/1024).toFixed(2)+' MB';
    const dateStr=new Date(media.timestamp).toLocaleString('ja-JP');
    info.textContent=`${media.filename}  |  ${sizeStr}  |  ${dateStr}`;
  }

  // ナビボタン状態
  const prev=document.getElementById('modal-prev');
  const next=document.getElementById('modal-next');
  if(prev)prev.disabled=previewIndex<=0;
  if(next)next.disabled=previewIndex>=list.length-1;
}

function _closeModal(){
  const modal=document.getElementById('preview-modal');
  modal.classList.remove('show');
  const content=document.getElementById('modal-content');
  const old=content?.querySelector('img,video');
  if(old?.src?.startsWith('blob:'))URL.revokeObjectURL(old.src);
  if(content)content.innerHTML='';
  _modalMedia=null;
  previewIndex=-1;
}

function _modalNav(dir){
  const list=_getFiltered();
  const next=previewIndex+dir;
  if(next<0||next>=list.length)return;
  previewIndex=next;
  _modalMedia=list[next];
  _renderModal();
}

// ==========================================
// ダウンロード
// ==========================================
async function _downloadMedia(media){
  try{
    const isImg=media.type==='image';
    const ext=isImg?'.png':'.webm';
    const mimeType=isImg?'image/png':'video/webm';
    const handle=await window.showSaveFilePicker({
      suggestedName:media.filename,
      types:[{description:'Media File',accept:{[mimeType]:[ext]}}]
    });
    const writable=await handle.createWritable();
    await writable.write(media.blob);
    await writable.close();
  }catch(e){
    if(e.name!=='AbortError')console.error('DLエラー:',e);
  }
}

async function _downloadBatch(){
  const targets=allMedia.filter(m=>selectedIds.has(m.id));
  for(const m of targets)await _downloadMedia(m);
}

// ==========================================
// 削除
// ==========================================
async function _confirmDelete(ids){
  const msg=ids.length===1?'この項目を削除しますか？':`${ids.length}件を削除しますか？`;
  if(!confirm(msg))return;
  for(const id of ids)await _deleteById(id);
  selectedIds=new Set([...selectedIds].filter(id=>!ids.includes(id)));
  if(ids.includes(_modalMedia?.id))_closeModal();
  await _load();
}

// ==========================================
// クリップボードから貼り付け
// ==========================================
async function _pasteFromClipboard(){
  try{
    const items=await navigator.clipboard.read();
    let blob=null;
    for(const item of items){
      const type=item.types.find(t=>t.startsWith('image/'));
      if(type){blob=await item.getType(type);break;}
    }
    if(!blob){alert('クリップボードに画像がありません');return;}
    await _saveToDB(blob,'image');
    await _load();
    _showToast('📋 クリップボードから追加しました');
  }catch(e){
    if(e.name==='NotAllowedError')alert('クリップボードへのアクセスを許可してください');
    else{console.error(e);alert('貼り付けに失敗しました');}
  }
}

// ==========================================
// クリップボードへコピー（モーダル）
// ==========================================
async function _copyToClipboard(){
  if(!_modalMedia||_modalMedia.type!=='image')return;
  try{
    await navigator.clipboard.write([new ClipboardItem({'image/png':_modalMedia.blob})]);
    _showToast('📋 クリップボードにコピーしました');
  }catch(e){
    _showToast('コピーに失敗しました');
  }
}

// ==========================================
// ドラッグ&ドロップ
// ==========================================
function _initDragDrop(){
  const main=document.getElementById('images-main');
  const zone=document.getElementById('drop-zone');
  if(!main||!zone)return;

  let dragCounter=0;
  main.addEventListener('dragenter',(e)=>{e.preventDefault();dragCounter++;zone.classList.add('active-drag');});
  main.addEventListener('dragleave',(e)=>{e.preventDefault();dragCounter--;if(dragCounter<=0){dragCounter=0;zone.classList.remove('active-drag');}});
  main.addEventListener('dragover',(e)=>e.preventDefault());
  main.addEventListener('drop',async(e)=>{
    e.preventDefault();dragCounter=0;zone.classList.remove('active-drag');
    const files=[...e.dataTransfer.files].filter(f=>f.type.startsWith('image/')||f.type.startsWith('video/'));
    if(!files.length){alert('画像・動画ファイルのみ追加できます');return;}
    for(const f of files){
      const type=f.type.startsWith('image/')?'image':'video';
      await _saveToDB(f,type);
    }
    await _load();
    _showToast(`📁 ${files.length}件追加しました`);
  });
}

// ==========================================
// トースト
// ==========================================
function _showToast(msg){
  const t=document.createElement('div');
  t.textContent=msg;
  t.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--text-primary);color:var(--bg-primary);padding:9px 20px;border-radius:20px;font-size:13px;font-weight:600;z-index:9999;white-space:nowrap;pointer-events:none;transition:opacity .25s;';
  document.body.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';setTimeout(()=>t.remove(),260);},2500);
}

function _esc(s){
  const d=document.createElement('div');d.textContent=s||'';return d.innerHTML;
}

// ==========================================
// イベント登録
// ==========================================
function _initEvents(){
  // フィルタータブ
  document.querySelectorAll('.filter-tab').forEach(btn=>{
    btn.addEventListener('click',()=>{
      document.querySelectorAll('.filter-tab').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter=btn.dataset.filter;
      _renderAll();
    });
  });

  // ソート
  document.getElementById('sort-select')?.addEventListener('change',(e)=>{
    currentSort=e.target.value;
    _renderAll();
  });

  // 選択モードトグル
  document.getElementById('select-toggle-btn')?.addEventListener('click',()=>{
    _setSelectMode(!selectMode);
  });

  // すべて削除
  document.getElementById('clear-all-btn')?.addEventListener('click',async()=>{
    if(!allMedia.length)return;
    if(!confirm(`すべての${allMedia.length}件を削除しますか？`))return;
    await _initDB();
    await new Promise((resolve,reject)=>{
      const tx=db.transaction([CAPTURE_STORE_NAME],'readwrite');
      const req=tx.objectStore(CAPTURE_STORE_NAME).clear();
      req.onsuccess=resolve;req.onerror=()=>reject(req.error);
    });
    selectedIds.clear();
    await _load();
  });

  // クリップボード貼り付け
  document.getElementById('clipboard-btn')?.addEventListener('click',_pasteFromClipboard);

  // バッチ操作
  document.getElementById('batch-download-btn')?.addEventListener('click',()=>{
    _downloadBatch();
    _setSelectMode(false);
  });
  document.getElementById('batch-delete-btn')?.addEventListener('click',()=>{
    _confirmDelete([...selectedIds]);
  });
  document.getElementById('batch-cancel-btn')?.addEventListener('click',()=>{
    _setSelectMode(false);
  });

  // モーダル
  document.getElementById('modal-close')?.addEventListener('click',_closeModal);
  document.getElementById('modal-overlay')?.addEventListener('click',_closeModal);
  document.getElementById('modal-prev')?.addEventListener('click',()=>_modalNav(-1));
  document.getElementById('modal-next')?.addEventListener('click',()=>_modalNav(1));
  document.getElementById('modal-download')?.addEventListener('click',()=>{if(_modalMedia)_downloadMedia(_modalMedia);});
  document.getElementById('modal-copy')?.addEventListener('click',_copyToClipboard);
  document.getElementById('modal-delete')?.addEventListener('click',()=>{if(_modalMedia)_confirmDelete([_modalMedia.id]);});

  // キーボード
  document.addEventListener('keydown',(e)=>{
    const modal=document.getElementById('preview-modal');
    if(!modal.classList.contains('show'))return;
    if(e.key==='Escape')_closeModal();
    else if(e.key==='ArrowLeft')_modalNav(-1);
    else if(e.key==='ArrowRight')_modalNav(1);
  });

  // ドラッグ&ドロップ
  _initDragDrop();
}

// ==========================================
// 初期化
// ==========================================
_initEvents();
await _load();