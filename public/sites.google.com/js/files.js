import{initPage,supabase,getCurrentProfile}from'../common/core.js';

let currentProfile=null;
let currentFilter='all';
let allFiles=[];
let selectedFile=null;

// ページ初期化
await initPage('files','Files',{
  onUserLoaded:async(profile)=>{
    currentProfile=profile;
    
    // モデレーター以上の場合、モデレーター限定オプションを表示
    if(['moderator','admin'].includes(profile.role)){
      document.getElementById('moderator-toggle').style.display='flex';
      document.getElementById('moderator-filter').style.display='flex';
    }
    
    // ファイル一覧を読み込み
    await loadFiles();
    
    // リアルタイム購読
    subscribeToFiles();
  }
});

// ファイル一覧を読み込み
async function loadFiles(){
  console.log('ファイル読み込み開始...');
  try{
    const{data:files,error}=await supabase
      .from('files')
      .select('*')
      .order('created_at',{ascending:false});
    
    if(error){
      console.error('クエリエラー:',error);
      throw error;
    }
    
    console.log('取得したファイル:',files);
    
    // uploaded_by で profiles を取得
    if(files&&files.length>0){
      const userIds=[...new Set(files.map(f=>f.uploaded_by))];
      console.log('ユーザーID:',userIds);
      
      const{data:profiles,error:profileError}=await supabase
        .from('profiles')
        .select('id,display_name,avatar_url,avatar_color')
        .in('id',userIds);
      
      if(profileError){
        console.error('プロフィール取得エラー:',profileError);
      }
      
      console.log('取得したプロフィール:',profiles);
      
      const profileMap={};
      if(profiles){
        profiles.forEach(p=>{
          profileMap[p.id]=p;
        });
      }
      
      // uploaded_by_profile を追加
      allFiles=files.map(file=>({
        ...file,
        uploaded_by_profile:profileMap[file.uploaded_by]||{display_name:'不明'}
      }));
    }else{
      allFiles=[];
    }
    
    console.log('表示するファイル:',allFiles);
    displayFiles();
  }catch(error){
    console.error('ファイル読み込みエラー:',error);
    document.getElementById('files-grid').innerHTML=`
      <div class="empty-state">
        <span class="material-symbols-outlined">error</span>
        <p>読み込みに失敗しました: ${error.message}</p>
      </div>
    `;
  }
}

// リアルタイム購読
function subscribeToFiles(){
  console.log('リアルタイム購読開始...');
  supabase
    .channel('files-realtime-changes')
    .on('postgres_changes',{
      event:'*',
      schema:'public',
      table:'files'
    },(payload)=>{
      console.log('リアルタイム更新:',payload);
      loadFiles();
    })
    .subscribe((status)=>{
      console.log('購読ステータス:',status);
    });
}

// ファイル一覧を表示
function displayFiles(){
  const grid=document.getElementById('files-grid');
  
  // フィルタリング
  let filtered=allFiles;
  if(currentFilter==='public'){
    filtered=allFiles.filter(file=>!file.is_moderator_only);
  }else if(currentFilter==='moderator'){
    filtered=allFiles.filter(file=>file.is_moderator_only);
  }
  
  if(filtered.length===0){
    grid.innerHTML=`
      <div class="empty-state">
        <span class="material-symbols-outlined">folder</span>
        <p>まだファイルがありません</p>
      </div>
    `;
    return;
  }
  
  grid.innerHTML='';
  
  filtered.forEach(file=>{
    const card=document.createElement('div');
    card.className='file-card';
    
    // ファイルアイコン
    const icon=getFileIcon(file.file_type);
    
    const uploadedBy=file.uploaded_by_profile||{display_name:'不明'};
    const createdDate=new Date(file.created_at).toLocaleDateString('ja-JP');
    const fileSize=formatFileSize(file.file_size);
    
    // モデレーター限定バッジ
    const moderatorBadge=file.is_moderator_only?'<span class="moderator-badge"><span class="material-symbols-outlined">shield</span>モデレーター限定</span>':'';
    
    // 削除ボタン（アップロード者本人またはモデレーター以上）
    const canDelete=file.uploaded_by===currentProfile.id||['moderator','admin'].includes(currentProfile.role);
    const deleteBtn=canDelete?`
      <button class="file-action-btn delete" onclick="deleteFile('${file.id}','${file.file_url}')" title="削除">
        <span class="material-symbols-outlined">delete</span>
      </button>
    `:'';
    
    card.innerHTML=`
      <div class="file-icon-large">
        <span class="material-symbols-outlined">${icon}</span>
      </div>
      <div class="file-content">
        <div class="file-header">
          <div class="file-name">${file.filename}</div>
          ${moderatorBadge}
        </div>
        ${file.description?`<div class="file-description">${file.description}</div>`:''}
        <div class="file-meta">
          <div class="file-author">
            <span class="material-symbols-outlined">person</span>
            <span>${uploadedBy.display_name}</span>
          </div>
          <span>•</span>
          <span>${fileSize}</span>
          <span>•</span>
          <span>${createdDate}</span>
        </div>
      </div>
      <div class="file-actions">
        <button class="file-action-btn" onclick="downloadFile('${file.file_url}','${file.filename}')" title="ダウンロード">
          <span class="material-symbols-outlined">download</span>
        </button>
        ${deleteBtn}
      </div>
    `;
    
    grid.appendChild(card);
  });
}

// ファイルアイコンを取得
function getFileIcon(fileType){
  if(fileType.startsWith('image/'))return 'image';
  if(fileType.startsWith('video/'))return 'videocam';
  if(fileType.startsWith('audio/'))return 'audiotrack';
  if(fileType.includes('pdf'))return 'picture_as_pdf';
  if(fileType.includes('word'))return 'description';
  if(fileType.includes('excel')||fileType.includes('spreadsheet'))return 'table_chart';
  if(fileType.includes('powerpoint')||fileType.includes('presentation'))return 'slideshow';
  if(fileType.includes('zip')||fileType.includes('rar'))return 'folder_zip';
  return 'insert_drive_file';
}

// ファイルサイズをフォーマット
function formatFileSize(bytes){
  if(bytes<1024)return bytes+' B';
  if(bytes<1024*1024)return(bytes/1024).toFixed(1)+' KB';
  return(bytes/1024/1024).toFixed(1)+' MB';
}

// ファイルダウンロード
window.downloadFile=function(url,filename){
  const a=document.createElement('a');
  a.href=url;
  a.download=filename;
  a.click();
}

// ファイル削除
window.deleteFile=async function(fileId,fileUrl){
  if(!confirm('このファイルを削除しますか？'))return;
  
  try{
    // Storageから削除
    const filePath=fileUrl.split('/').pop();
    await supabase.storage
      .from('shared-files')
      .remove([filePath]);
    
    // データベースから削除
    const{error}=await supabase
      .from('files')
      .delete()
      .eq('id',fileId);
    
    if(error)throw error;
  }catch(error){
    console.error('削除エラー:',error);
    alert('削除に失敗しました');
  }
}

// フィルターボタン
document.querySelectorAll('.filter-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter=btn.dataset.filter;
    displayFiles();
  });
});

// ファイル選択
document.getElementById('file-input').addEventListener('change',(e)=>{
  const file=e.target.files[0];
  const errorEl=document.getElementById('upload-error');
  const infoEl=document.getElementById('selected-file-info');
  
  errorEl.textContent='';
  
  if(!file){
    infoEl.classList.remove('show');
    return;
  }
  
  // 20MB制限
  if(file.size>20*1024*1024){
    errorEl.textContent='ファイルサイズは20MB以下にしてください';
    e.target.value='';
    infoEl.classList.remove('show');
    return;
  }
  
  selectedFile=file;
  infoEl.textContent=`選択: ${file.name} (${formatFileSize(file.size)})`;
  infoEl.classList.add('show');
});

// フォーム送信
document.getElementById('upload-form').addEventListener('submit',async(e)=>{
  e.preventDefault();
  
  if(!selectedFile){
    alert('ファイルを選択してください');
    return;
  }
  
  const description=document.getElementById('file-description').value.trim();
  const isModeratorOnly=document.getElementById('moderator-only').checked;
  const uploadBtn=document.getElementById('upload-btn');
  const errorEl=document.getElementById('upload-error');
  
  uploadBtn.disabled=true;
  uploadBtn.textContent='アップロード中...';
  errorEl.textContent='';
  
  try{
    console.log('アップロード開始:',selectedFile.name);
    
    // ファイルをStorageにアップロード
    const fileName=`${currentProfile.id}_${Date.now()}_${selectedFile.name}`;
    
    const{data:uploadData,error:uploadError}=await supabase.storage
      .from('shared-files')
      .upload(fileName,selectedFile);
    
    if(uploadError){
      console.error('ストレージエラー:',uploadError);
      throw uploadError;
    }
    
    console.log('アップロード成功:',uploadData);
    
    // 公開URLを取得
    const{data:urlData}=supabase.storage
      .from('shared-files')
      .getPublicUrl(fileName);
    
    console.log('公開URL:',urlData.publicUrl);
    
    // データベースに保存
    const insertData={
      filename:selectedFile.name,
      file_url:urlData.publicUrl,
      file_size:selectedFile.size,
      file_type:selectedFile.type,
      description:description||null,
      is_moderator_only:isModeratorOnly,
      uploaded_by:currentProfile.id
    };
    
    console.log('DB挿入データ:',insertData);
    
    const{data:dbData,error:dbError}=await supabase
      .from('files')
      .insert(insertData)
      .select();
    
    if(dbError){
      console.error('DB挿入エラー:',dbError);
      throw dbError;
    }
    
    console.log('DB挿入成功:',dbData);
    
    // 即座に画面を更新
    await loadFiles();
    
    // フォームをリセット
    document.getElementById('upload-form').reset();
    document.getElementById('selected-file-info').classList.remove('show');
    selectedFile=null;
    
    alert('アップロードが完了しました');
  }catch(error){
    console.error('アップロードエラー:',error);
    errorEl.textContent='アップロードに失敗しました: '+error.message;
  }finally{
    uploadBtn.disabled=false;
    uploadBtn.textContent='アップロード';
  }
});