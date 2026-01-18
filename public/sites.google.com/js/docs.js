import{initPage,supabase}from'../common/core.js';

let currentProfile=null;
let saveTimeout=null;
let isSaving=false;

// ページ初期化
await initPage('docs','Docs',{
  onUserLoaded:async(profile)=>{
    currentProfile=profile;
    await loadNote();
    setupAutoSave();
  }
});

// ノート読み込み
async function loadNote(){
  try{
    const{data:note,error}=await supabase
      .from('notes')
      .select('*')
      .eq('user_id',currentProfile.id)
      .single();
    
    if(error&&error.code!=='PGRST116'){
      throw error;
    }
    
    if(note){
      document.getElementById('note-textarea').value=note.content||'';
      updateLastUpdated(note.updated_at);
    }
  }catch(error){
    console.error('ノート読み込みエラー:',error);
  }
}

// 自動保存設定
function setupAutoSave(){
  const textarea=document.getElementById('note-textarea');
  
  textarea.addEventListener('input',()=>{
    // 保存中表示
    showStatus('saving');
    
    // 既存のタイマーをクリア
    if(saveTimeout){
      clearTimeout(saveTimeout);
    }
    
    // 0.5秒後に保存
    saveTimeout=setTimeout(async()=>{
      await saveNote();
    },500);
  });
}

// ノート保存
async function saveNote(){
  if(isSaving)return;
  isSaving=true;
  
  const content=document.getElementById('note-textarea').value;
  
  try{
    const{data:existing,error:checkError}=await supabase
      .from('notes')
      .select('id')
      .eq('user_id',currentProfile.id)
      .single();
    
    if(checkError&&checkError.code!=='PGRST116'){
      throw checkError;
    }
    
    if(existing){
      // 更新
      const{data,error}=await supabase
        .from('notes')
        .update({content:content})
        .eq('user_id',currentProfile.id)
        .select()
        .single();
      
      if(error)throw error;
      
      updateLastUpdated(data.updated_at);
    }else{
      // 新規作成
      const{data,error}=await supabase
        .from('notes')
        .insert({
          user_id:currentProfile.id,
          content:content
        })
        .select()
        .single();
      
      if(error)throw error;
      
      updateLastUpdated(data.updated_at);
    }
    
    // 保存完了表示
    showStatus('saved');
    
    // 2秒後に消す
    setTimeout(()=>{
      hideStatus();
    },2000);
    
  }catch(error){
    console.error('保存エラー:',error);
    alert('保存に失敗しました');
  }finally{
    isSaving=false;
  }
}

// ステータス表示
function showStatus(type){
  const statusText=document.getElementById('status-text');
  
  if(type==='saving'){
    statusText.className='status-text saving';
    statusText.innerHTML='<span class="material-symbols-outlined">sync</span>保存中...';
  }else if(type==='saved'){
    statusText.className='status-text saved';
    statusText.innerHTML='<span class="material-symbols-outlined">check_circle</span>保存完了';
  }
}

// ステータス非表示
function hideStatus(){
  const statusText=document.getElementById('status-text');
  statusText.className='status-text';
  statusText.innerHTML='';
}

// 最終更新日時を更新
function updateLastUpdated(timestamp){
  const lastUpdated=document.getElementById('last-updated');
  const date=new Date(timestamp);
  const formatted=date.toLocaleString('ja-JP',{
    year:'numeric',
    month:'2-digit',
    day:'2-digit',
    hour:'2-digit',
    minute:'2-digit',
    second:'2-digit'
  });
  lastUpdated.textContent=`最終更新: ${formatted}`;
}