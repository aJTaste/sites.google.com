import{initPage,supabase,getCurrentProfile}from'../common/core.js';

let currentProfile=null;
let currentFilter='all';
let allLinks=[];

// ページ初期化
await initPage('links','Links',{
  onUserLoaded:async(profile)=>{
    currentProfile=profile;
    
    // リンク一覧を読み込み
    await loadLinks();
    
    // リアルタイム購読
    subscribeToLinks();
  }
});

// リンク一覧を読み込み
async function loadLinks(){
  try{
    const{data:links,error}=await supabase
      .from('links')
      .select('*')
      .order('created_at',{ascending:false});
    
    if(error)throw error;
    
    // posted_by で profiles を取得
    if(links&&links.length>0){
      const userIds=[...new Set(links.map(l=>l.posted_by))];
      const{data:profiles}=await supabase
        .from('profiles')
        .select('id,display_name,avatar_url,avatar_color')
        .in('id',userIds);
      
      const profileMap={};
      if(profiles){
        profiles.forEach(p=>{
          profileMap[p.id]=p;
        });
      }
      
      // posted_by_profile を追加
      allLinks=links.map(link=>({
        ...link,
        posted_by_profile:profileMap[link.posted_by]||{display_name:'不明'}
      }));
    }else{
      allLinks=[];
    }
    
    displayLinks();
  }catch(error){
    console.error('リンク読み込みエラー:',error);
    document.getElementById('links-grid').innerHTML=`
      <div class="empty-state">
        <span class="material-symbols-outlined">error</span>
        <p>読み込みに失敗しました: ${error.message}</p>
      </div>
    `;
  }
}

// リアルタイム購読
function subscribeToLinks(){
  supabase
    .channel('links-changes')
    .on('postgres_changes',{
      event:'*',
      schema:'public',
      table:'links'
    },async()=>{
      await loadLinks();
    })
    .subscribe();
}

// リンク一覧を表示
function displayLinks(){
  const grid=document.getElementById('links-grid');
  
  // フィルタリング
  let filtered=allLinks;
  if(currentFilter!=='all'){
    filtered=allLinks.filter(link=>link.category===currentFilter);
  }
  
  if(filtered.length===0){
    grid.innerHTML=`
      <div class="empty-state">
        <span class="material-symbols-outlined">link</span>
        <p>まだリンクがありません</p>
      </div>
    `;
    return;
  }
  
  grid.innerHTML='';
  
  filtered.forEach(link=>{
    const card=document.createElement('div');
    card.className='link-card';
    
    const icon=link.category==='game'?'sports_esports':'category';
    const categoryClass=link.category;
    const categoryName=link.category==='game'?'ゲーム':'その他';
    
    const postedBy=link.posted_by_profile||{display_name:'不明'};
    const createdDate=new Date(link.created_at).toLocaleDateString('ja-JP');
    
    // 削除ボタン（投稿者本人またはモデレーター以上）
    const canDelete=link.posted_by===currentProfile.id||['moderator','admin'].includes(currentProfile.role);
    const deleteBtn=canDelete?`
      <button class="link-action-btn delete" onclick="deleteLink('${link.id}')" title="削除">
        <span class="material-symbols-outlined">delete</span>
      </button>
    `:'';
    
    card.innerHTML=`
      <div class="link-icon">
        <span class="material-symbols-outlined">${icon}</span>
      </div>
      <div class="link-content">
        <div class="link-header">
          <a href="${link.url}" target="_blank" rel="noopener noreferrer" class="link-url">${link.url}</a>
          <span class="category-badge ${categoryClass}">${categoryName}</span>
        </div>
        <div class="link-description">${link.description}</div>
        <div class="link-meta">
          <div class="link-author">
            <span class="material-symbols-outlined">person</span>
            <span>${postedBy.display_name}</span>
          </div>
          <span>•</span>
          <span>${createdDate}</span>
        </div>
      </div>
      <div class="link-actions">
        <button class="link-action-btn" onclick="window.open('${link.url}','_blank')" title="開く">
          <span class="material-symbols-outlined">open_in_new</span>
        </button>
        ${deleteBtn}
      </div>
    `;
    
    grid.appendChild(card);
  });
}

// リンク削除
window.deleteLink=async function(linkId){
  if(!confirm('このリンクを削除しますか？'))return;
  
  try{
    const{error}=await supabase
      .from('links')
      .delete()
      .eq('id',linkId);
    
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
    displayLinks();
  });
});

// フォーム送信
document.getElementById('add-link-form').addEventListener('submit',async(e)=>{
  e.preventDefault();
  
  const url=document.getElementById('link-url').value.trim();
  const description=document.getElementById('link-description').value.trim();
  const category=document.getElementById('link-category').value;
  const errorEl=document.getElementById('link-error');
  const submitBtn=e.target.querySelector('button[type="submit"]');
  
  errorEl.textContent='';
  
  if(!url||!description){
    errorEl.textContent='すべての項目を入力してください';
    return;
  }
  
  submitBtn.disabled=true;
  submitBtn.textContent='投稿中...';
  
  try{
    const{error}=await supabase
      .from('links')
      .insert({
        url:url,
        description:description,
        category:category,
        posted_by:currentProfile.id
      });
    
    if(error)throw error;
    
    // フォームをリセット
    document.getElementById('add-link-form').reset();
  }catch(error){
    console.error('投稿エラー:',error);
    errorEl.textContent='投稿に失敗しました: '+error.message;
  }finally{
    submitBtn.disabled=false;
    submitBtn.textContent='投稿';
  }
});