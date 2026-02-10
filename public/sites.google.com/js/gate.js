import{initPage,supabase,getCurrentProfile}from'../common/core.js';

// ========================================
// 状態管理
// ========================================

const state={
  currentProfile:null,
  currentView:'home',
  currentFeed:'all',
  selectedPostId:null,
  mediaFiles:[],
  posts:[],
  notifications:[],
  isLoading:false,
  explorePosts:[],
  userPosts:[],
  userProfile:null
};

// ========================================
// 初期化
// ========================================

await initPage('gate','aJTGate',{
  onUserLoaded:async(profile)=>{
    state.currentProfile=profile;
    
    // 初期データ読み込み
    await loadPosts();
    await loadSuggestedUsers();
    await loadNotifications();
    
    // リアルタイム監視
    subscribeToUpdates();
    
    // イベントリスナー設定
    setupEventListeners();
  }
});

// ========================================
// イベントリスナー
// ========================================

function setupEventListeners(){
  // ナビゲーション
  document.querySelectorAll('.gate-nav-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const view=btn.dataset.view;
      switchView(view);
    });
  });
  
  // タブ切り替え
  document.querySelectorAll('.gate-tab').forEach(tab=>{
    tab.addEventListener('click',()=>{
      const feed=tab.dataset.feed;
      switchFeed(feed);
    });
  });
  
  // 投稿モーダル
  document.getElementById('new-post-btn').addEventListener('click',openPostModal);
  document.getElementById('post-modal-close').addEventListener('click',closePostModal);
  document.getElementById('post-cancel').addEventListener('click',closePostModal);
  document.getElementById('add-media-btn').addEventListener('click',()=>{
    document.getElementById('media-input').click();
  });
  
  // メディアアップロード
  document.getElementById('media-input').addEventListener('change',handleMediaSelect);
  
  // 文字数カウント
  document.getElementById('post-text').addEventListener('input',(e)=>{
    const remaining=280-e.target.value.length;
    const countEl=document.getElementById('char-count');
    countEl.textContent=remaining;
    countEl.style.color=remaining<0?'#cf222e':remaining<20?'#f97316':'var(--text-tertiary)';
  });
  
  // 投稿送信
  document.getElementById('post-submit').addEventListener('click',submitPost);
  
  // 詳細モーダル
  document.getElementById('detail-modal-close').addEventListener('click',()=>{
    document.getElementById('detail-modal').classList.remove('show');
  });
  
  // 検索
  const searchInput=document.getElementById('search-input');
  let searchTimeout;
  searchInput.addEventListener('input',(e)=>{
    clearTimeout(searchTimeout);
    searchTimeout=setTimeout(()=>{
      handleSearch(e.target.value.trim());
    },300);
  });
  
  // モーダル外クリック
  document.querySelectorAll('.gate-modal').forEach(modal=>{
    modal.addEventListener('click',(e)=>{
      if(e.target===modal){
        modal.classList.remove('show');
      }
    });
  });
}

// ========================================
// 検索機能
// ========================================

async function handleSearch(query){
  if(!query)return;
  
  try{
    const{data:users,error}=await supabase
      .from('profiles')
      .select('*')
      .or(`display_name.ilike.%${query}%,user_id.ilike.%${query}%`)
      .limit(10);
    
    if(error)throw error;
    
    // 検索結果を表示（ここでは簡易的にコンソール出力）
    console.log('検索結果:',users);
  }catch(error){
    console.error('検索エラー:',error);
  }
}

// ========================================
// ビュー切り替え
// ========================================

function switchView(view){
  state.currentView=view;
  
  document.querySelectorAll('.gate-nav-btn').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.view===view);
  });
  
  if(view==='home'){
    loadPosts();
  }else if(view==='explore'){
    showExplore();
  }else if(view==='notifications'){
    showNotifications();
  }else if(view==='profile'){
    showProfile();
  }
}

function switchFeed(feed){
  state.currentFeed=feed;
  
  document.querySelectorAll('.gate-tab').forEach(tab=>{
    tab.classList.toggle('active',tab.dataset.feed===feed);
  });
  
  loadPosts();
}

// ========================================
// 投稿読み込み
// ========================================

async function loadPosts(){
  if(state.isLoading)return;
  state.isLoading=true;
  
  const timeline=document.getElementById('timeline');
  timeline.innerHTML='<div class="timeline-loading"><div class="loading-spinner"></div><p>読み込み中...</p></div>';
  
  try{
    let query=supabase
      .from('posts')
      .select(`
        *,
        profiles!posts_user_id_fkey(id,user_id,display_name,avatar_url,avatar_color),
        likes(count),
        comments(count),
        reposts(count)
      `)
      .order('created_at',{ascending:false})
      .limit(50);
    
    // フォロー中フィルター
    if(state.currentFeed==='following'){
      const{data:following}=await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id',state.currentProfile.id);
      
      const followingIds=following?.map(f=>f.following_id)||[];
      if(followingIds.length===0){
        timeline.innerHTML='<div class="timeline-loading"><p>フォロー中のユーザーがいません</p></div>';
        state.isLoading=false;
        return;
      }
      
      query=query.in('user_id',followingIds);
    }
    
    const{data:posts,error}=await query;
    
    if(error)throw error;
    
    state.posts=posts||[];
    displayPosts(posts||[]);
  }catch(error){
    console.error('投稿読み込みエラー:',error);
    timeline.innerHTML='<div class="timeline-loading"><p>読み込みに失敗しました</p></div>';
  }finally{
    state.isLoading=false;
  }
}

function displayPosts(posts){
  const timeline=document.getElementById('timeline');
  
  if(posts.length===0){
    timeline.innerHTML='<div class="timeline-loading"><p>投稿がありません</p></div>';
    return;
  }
  
  timeline.innerHTML='';
  
  posts.forEach(post=>{
    const postEl=createPostCard(post);
    timeline.appendChild(postEl);
  });
}

function createPostCard(post){
  const card=document.createElement('div');
  card.className='post-card';
  card.dataset.postId=post.id;
  
  const profile=post.profiles;
  const avatarHtml=profile?.avatar_url
    ?`<img src="${profile.avatar_url}" alt="${profile.display_name}">`
    :`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${profile?.avatar_color||'#ff6b35'};color:#fff;font-weight:600;font-size:20px;border-radius:50%;">${profile?.display_name?.charAt(0).toUpperCase()||'?'}</div>`;
  
  const timeAgo=getTimeAgo(post.created_at);
  
  // いいね・リポスト・コメント数
  const likesCount=post.likes?.[0]?.count||0;
  const repostsCount=post.reposts?.[0]?.count||0;
  const commentsCount=post.comments?.[0]?.count||0;
  
  // メディア表示
  let mediaHtml='';
  if(post.media_urls&&post.media_urls.length>0){
    const mediaClass=post.media_urls.length===1?'single'
      :post.media_urls.length===2?'double'
      :post.media_urls.length===3?'triple'
      :'quad';
    
    mediaHtml=`<div class="post-media ${mediaClass}">`;
    post.media_urls.forEach((url,i)=>{
      const type=post.media_types?.[i]||'image';
      if(type==='image'){
        mediaHtml+=`<div class="media-item"><img src="${url}" alt="投稿画像" loading="lazy"></div>`;
      }else{
        mediaHtml+=`<div class="media-item"><video src="${url}" controls preload="metadata"></video></div>`;
      }
    });
    mediaHtml+='</div>';
  }
  
  card.innerHTML=`
    <div class="post-header">
      <div class="post-avatar">${avatarHtml}</div>
      <div class="post-author-info">
        <div>
          <span class="post-author-name">${profile?.display_name||'不明'}</span>
          <span class="post-author-id">@${profile?.user_id||'unknown'}</span>
          <span class="post-time">${timeAgo}</span>
        </div>
      </div>
    </div>
    <div class="post-content">
      <div class="post-text">${escapeHtml(post.text||'')}</div>
      ${mediaHtml}
    </div>
    <div class="post-actions">
      <button class="post-action-btn comment-btn" data-post-id="${post.id}">
        <span class="material-symbols-outlined">chat_bubble_outline</span>
        <span>${commentsCount}</span>
      </button>
      <button class="post-action-btn repost-btn" data-post-id="${post.id}">
        <span class="material-symbols-outlined">repeat</span>
        <span>${repostsCount}</span>
      </button>
      <button class="post-action-btn like-btn" data-post-id="${post.id}">
        <span class="material-symbols-outlined">favorite_border</span>
        <span>${likesCount}</span>
      </button>
    </div>
  `;
  
  // イベントリスナー
  card.addEventListener('click',(e)=>{
    if(!e.target.closest('.post-action-btn')){
      openPostDetail(post.id);
    }
  });
  
  // アクションボタン
  const likeBtn=card.querySelector('.like-btn');
  likeBtn.addEventListener('click',(e)=>{
    e.stopPropagation();
    toggleLike(post.id);
  });
  
  const repostBtn=card.querySelector('.repost-btn');
  repostBtn.addEventListener('click',(e)=>{
    e.stopPropagation();
    toggleRepost(post.id);
  });
  
  const commentBtn=card.querySelector('.comment-btn');
  commentBtn.addEventListener('click',(e)=>{
    e.stopPropagation();
    openPostDetail(post.id);
  });
  
  return card;
}

// ========================================
// 投稿詳細
// ========================================

async function openPostDetail(postId){
  const modal=document.getElementById('detail-modal');
  const body=document.getElementById('detail-modal-body');
  
  body.innerHTML='<div class="timeline-loading"><div class="loading-spinner"></div><p>読み込み中...</p></div>';
  modal.classList.add('show');
  
  try{
    const{data:post,error}=await supabase
      .from('posts')
      .select(`
        *,
        profiles!posts_user_id_fkey(id,user_id,display_name,avatar_url,avatar_color)
      `)
      .eq('id',postId)
      .single();
    
    if(error)throw error;
    
    const{data:comments}=await supabase
      .from('comments')
      .select(`
        *,
        profiles!comments_user_id_fkey(id,user_id,display_name,avatar_url,avatar_color)
      `)
      .eq('post_id',postId)
      .order('created_at',{ascending:true});
    
    body.innerHTML='';
    
    // 投稿本体
    const postCard=createPostCard(post);
    postCard.style.borderBottom='none';
    postCard.style.cursor='default';
    body.appendChild(postCard);
    
    // コメントセクション
    const commentsSection=document.createElement('div');
    commentsSection.className='comments-section';
    
    const currentAvatarHtml=state.currentProfile.avatar_url
      ?`<img src="${state.currentProfile.avatar_url}" alt="${state.currentProfile.display_name}">`
      :`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${state.currentProfile.avatar_color||'#ff6b35'};color:#fff;font-weight:600;font-size:16px;border-radius:50%;">${state.currentProfile.display_name.charAt(0).toUpperCase()}</div>`;
    
    commentsSection.innerHTML=`
      <h4>コメント</h4>
      <div class="comment-input-container">
        <div class="comment-input-avatar">${currentAvatarHtml}</div>
        <div class="comment-input-wrapper">
          <textarea id="comment-input" placeholder="コメントを入力" maxlength="280"></textarea>
          <button class="comment-submit-btn" id="comment-submit-btn">コメント</button>
        </div>
      </div>
      <div id="comments-list"></div>
    `;
    
    body.appendChild(commentsSection);
    
    // コメント表示
    const commentsList=document.getElementById('comments-list');
    (comments||[]).forEach(comment=>{
      const commentCard=createCommentCard(comment);
      commentsList.appendChild(commentCard);
    });
    
    // コメント送信
    document.getElementById('comment-submit-btn').addEventListener('click',()=>{
      submitComment(postId);
    });
  }catch(error){
    console.error('詳細読み込みエラー:',error);
    body.innerHTML='<div class="timeline-loading"><p>読み込みに失敗しました</p></div>';
  }
}

function createCommentCard(comment){
  const card=document.createElement('div');
  card.className='comment-card';
  
  const profile=comment.profiles;
  const avatarHtml=profile?.avatar_url
    ?`<img src="${profile.avatar_url}" alt="${profile.display_name}">`
    :`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${profile?.avatar_color||'#ff6b35'};color:#fff;font-weight:600;font-size:14px;border-radius:50%;">${profile?.display_name?.charAt(0).toUpperCase()||'?'}</div>`;
  
  const timeAgo=getTimeAgo(comment.created_at);
  
  card.innerHTML=`
    <div class="comment-avatar">${avatarHtml}</div>
    <div class="comment-content">
      <div class="comment-author">${profile?.display_name||'不明'}</div>
      <div class="comment-text">${escapeHtml(comment.text)}</div>
      <div class="comment-time">${timeAgo}</div>
    </div>
  `;
  
  return card;
}

async function submitComment(postId){
  const input=document.getElementById('comment-input');
  const text=input.value.trim();
  
  if(!text)return;
  
  const submitBtn=document.getElementById('comment-submit-btn');
  submitBtn.disabled=true;
  submitBtn.textContent='送信中...';
  
  try{
    const{error}=await supabase
      .from('comments')
      .insert({
        post_id:postId,
        user_id:state.currentProfile.id,
        text:text
      });
    
    if(error)throw error;
    
    input.value='';
    
    // 通知を作成
    const{data:post}=await supabase
      .from('posts')
      .select('user_id')
      .eq('id',postId)
      .single();
    
    if(post?.user_id&&post.user_id!==state.currentProfile.id){
      await createNotification(post.user_id,'comment',postId);
    }
    
    // 再読み込み
    openPostDetail(postId);
  }catch(error){
    console.error('コメント投稿エラー:',error);
    alert('コメントの投稿に失敗しました');
    submitBtn.disabled=false;
    submitBtn.textContent='コメント';
  }
}

// ========================================
// 投稿モーダル
// ========================================

function openPostModal(){
  document.getElementById('post-modal').classList.add('show');
  document.getElementById('post-text').focus();
}

function closePostModal(){
  document.getElementById('post-modal').classList.remove('show');
  document.getElementById('post-text').value='';
  document.getElementById('post-media-preview').innerHTML='';
  document.getElementById('char-count').textContent='280';
  document.getElementById('char-count').style.color='var(--text-tertiary)';
  state.mediaFiles=[];
}

function handleMediaSelect(e){
  const files=Array.from(e.target.files);
  
  if(state.mediaFiles.length+files.length>4){
    alert('メディアは最大4つまでです');
    return;
  }
  
  files.forEach(file=>{
    if(file.size>20*1024*1024){
      alert(`${file.name}のファイルサイズは20MB以下にしてください`);
      return;
    }
    
    state.mediaFiles.push(file);
  });
  
  displayMediaPreview();
  e.target.value='';
}

function displayMediaPreview(){
  const preview=document.getElementById('post-media-preview');
  preview.innerHTML='';
  
  state.mediaFiles.forEach((file,index)=>{
    const reader=new FileReader();
    reader.onload=(e)=>{
      const item=document.createElement('div');
      item.className='media-preview-item';
      
      const isVideo=file.type.startsWith('video');
      item.innerHTML=`
        ${isVideo
          ?`<video src="${e.target.result}"></video>`
          :`<img src="${e.target.result}" alt="プレビュー">`
        }
        <button class="media-preview-remove" data-index="${index}">
          <span class="material-symbols-outlined">close</span>
        </button>
      `;
      
      item.querySelector('.media-preview-remove').addEventListener('click',()=>{
        removeMedia(index);
      });
      
      preview.appendChild(item);
    };
    reader.readAsDataURL(file);
  });
}

function removeMedia(index){
  state.mediaFiles.splice(index,1);
  displayMediaPreview();
}

async function submitPost(){
  const text=document.getElementById('post-text').value.trim();
  
  if(!text&&state.mediaFiles.length===0){
    alert('テキストまたはメディアを入力してください');
    return;
  }
  
  if(text.length>280){
    alert('テキストは280文字以内にしてください');
    return;
  }
  
  const submitBtn=document.getElementById('post-submit');
  submitBtn.disabled=true;
  submitBtn.textContent='投稿中...';
  
  try{
    let mediaUrls=[];
    let mediaTypes=[];
    
    // メディアアップロード
    for(const file of state.mediaFiles){
      const fileName=`${state.currentProfile.id}_${Date.now()}_${Math.random().toString(36).substr(2,9)}`;
      const fileExt=file.name.split('.').pop();
      
      const{error:uploadError}=await supabase.storage
        .from('gate-media')
        .upload(`${fileName}.${fileExt}`,file);
      
      if(uploadError)throw uploadError;
      
      const{data:urlData}=supabase.storage
        .from('gate-media')
        .getPublicUrl(`${fileName}.${fileExt}`);
      
      mediaUrls.push(urlData.publicUrl);
      mediaTypes.push(file.type.startsWith('video')?'video':'image');
    }
    
    // 投稿作成
    const{error}=await supabase
      .from('posts')
      .insert({
        user_id:state.currentProfile.id,
        text:text,
        media_urls:mediaUrls.length>0?mediaUrls:null,
        media_types:mediaTypes.length>0?mediaTypes:null
      });
    
    if(error)throw error;
    
    closePostModal();
    loadPosts();
  }catch(error){
    console.error('投稿エラー:',error);
    alert('投稿に失敗しました: '+error.message);
    submitBtn.disabled=false;
    submitBtn.textContent='投稿';
  }
}

// ========================================
// アクション（いいね・リポスト）
// ========================================

async function toggleLike(postId){
  try{
    const{data:existing}=await supabase
      .from('likes')
      .select('id')
      .eq('post_id',postId)
      .eq('user_id',state.currentProfile.id)
      .maybeSingle();
    
    if(existing){
      await supabase.from('likes').delete().eq('id',existing.id);
    }else{
      await supabase.from('likes').insert({
        post_id:postId,
        user_id:state.currentProfile.id
      });
      
      // 通知作成
      const{data:post}=await supabase
        .from('posts')
        .select('user_id')
        .eq('id',postId)
        .single();
      
      if(post?.user_id&&post.user_id!==state.currentProfile.id){
        await createNotification(post.user_id,'like',postId);
      }
    }
    
    loadPosts();
  }catch(error){
    console.error('いいねエラー:',error);
  }
}

async function toggleRepost(postId){
  try{
    const{data:existing}=await supabase
      .from('reposts')
      .select('id')
      .eq('post_id',postId)
      .eq('user_id',state.currentProfile.id)
      .maybeSingle();
    
    if(existing){
      await supabase.from('reposts').delete().eq('id',existing.id);
    }else{
      await supabase.from('reposts').insert({
        post_id:postId,
        user_id:state.currentProfile.id
      });
      
      // 通知作成
      const{data:post}=await supabase
        .from('posts')
        .select('user_id')
        .eq('id',postId)
        .single();
      
      if(post?.user_id&&post.user_id!==state.currentProfile.id){
        await createNotification(post.user_id,'repost',postId);
      }
    }
    
    loadPosts();
  }catch(error){
    console.error('リポストエラー:',error);
  }
}

// ========================================
// おすすめユーザー
// ========================================

async function loadSuggestedUsers(){
  try{
    const{data:users}=await supabase
      .from('profiles')
      .select('*')
      .neq('id',state.currentProfile.id)
      .limit(5);
    
    const suggestedUsersEl=document.getElementById('suggested-users');
    suggestedUsersEl.innerHTML='';
    
    for(const user of users||[]){
      const item=document.createElement('div');
      item.className='user-suggestion';
      
      const avatarHtml=user.avatar_url
        ?`<img src="${user.avatar_url}" alt="${user.display_name}">`
        :`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${user.avatar_color||'#ff6b35'};color:#fff;font-weight:600;font-size:16px;border-radius:50%;">${user.display_name.charAt(0).toUpperCase()}</div>`;
      
      // フォロー状態チェック
      const{data:followStatus}=await supabase
        .from('follows')
        .select('id')
        .eq('follower_id',state.currentProfile.id)
        .eq('following_id',user.id)
        .maybeSingle();
      
      const isFollowing=!!followStatus;
      
      item.innerHTML=`
        <div class="user-suggestion-avatar">${avatarHtml}</div>
        <div class="user-suggestion-info">
          <div class="user-suggestion-name">${user.display_name}</div>
          <div class="user-suggestion-id">@${user.user_id}</div>
        </div>
        <button class="follow-btn ${isFollowing?'following':''}" data-user-id="${user.id}">
          ${isFollowing?'フォロー中':'フォロー'}
        </button>
      `;
      
      item.querySelector('.follow-btn').addEventListener('click',()=>{
        toggleFollow(user.id);
      });
      
      suggestedUsersEl.appendChild(item);
    }
  }catch(error){
    console.error('おすすめユーザー読み込みエラー:',error);
  }
}

async function toggleFollow(userId){
  try{
    const{data:existing}=await supabase
      .from('follows')
      .select('id')
      .eq('follower_id',state.currentProfile.id)
      .eq('following_id',userId)
      .maybeSingle();
    
    if(existing){
      await supabase.from('follows').delete().eq('id',existing.id);
    }else{
      await supabase.from('follows').insert({
        follower_id:state.currentProfile.id,
        following_id:userId
      });
      
      // 通知作成
      await createNotification(userId,'follow',null);
    }
    
    loadSuggestedUsers();
  }catch(error){
    console.error('フォローエラー:',error);
  }
}

// ========================================
// 通知
// ========================================

async function createNotification(userId,type,postId){
  try{
    await supabase.from('notifications').insert({
      user_id:userId,
      actor_id:state.currentProfile.id,
      type:type,
      post_id:postId
    });
  }catch(error){
    console.error('通知作成エラー:',error);
  }
}

async function loadNotifications(){
  try{
    const{data:notifications}=await supabase
      .from('notifications')
      .select(`
        *,
        profiles!notifications_actor_id_fkey(id,user_id,display_name,avatar_url,avatar_color)
      `)
      .eq('user_id',state.currentProfile.id)
      .order('created_at',{ascending:false})
      .limit(50);
    
    state.notifications=notifications||[];
    updateNotificationBadge();
  }catch(error){
    console.error('通知読み込みエラー:',error);
  }
}

function updateNotificationBadge(){
  const unreadCount=state.notifications.filter(n=>!n.is_read).length;
  const badge=document.getElementById('notif-badge');
  
  if(unreadCount>0){
    badge.textContent=unreadCount>99?'99+':unreadCount;
    badge.style.display='flex';
  }else{
    badge.style.display='none';
  }
}

function showNotifications(){
  const timeline=document.getElementById('timeline');
  timeline.innerHTML='';
  
  if(state.notifications.length===0){
    timeline.innerHTML='<div class="timeline-loading"><p>通知はありません</p></div>';
    return;
  }
  
  state.notifications.forEach(notif=>{
    const card=document.createElement('div');
    card.className='post-card';
    
    const profile=notif.profiles;
    const avatarHtml=profile?.avatar_url
      ?`<img src="${profile.avatar_url}" alt="${profile.display_name}">`
      :`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${profile?.avatar_color||'#ff6b35'};color:#fff;font-weight:600;font-size:20px;border-radius:50%;">${profile?.display_name?.charAt(0).toUpperCase()||'?'}</div>`;
    
    const typeText=notif.type==='like'?'があなたの投稿にいいねしました'
      :notif.type==='comment'?'があなたの投稿にコメントしました'
      :notif.type==='repost'?'があなたの投稿をリポストしました'
      :'があなたをフォローしました';
    
    const timeAgo=getTimeAgo(notif.created_at);
    
    card.innerHTML=`
      <div class="post-header">
        <div class="post-avatar">${avatarHtml}</div>
        <div class="post-author-info">
          <div>
            <span class="post-author-name">${profile?.display_name||'不明'}</span>
            <span class="post-author-id">${typeText}</span>
          </div>
          <div class="post-time">${timeAgo}</div>
        </div>
      </div>
    `;
    
    if(notif.post_id){
      card.style.cursor='pointer';
      card.addEventListener('click',()=>{
        openPostDetail(notif.post_id);
      });
    }
    
    timeline.appendChild(card);
  });
  
  // 既読にする
  markNotificationsAsRead();
}

async function markNotificationsAsRead(){
  try{
    const unreadIds=state.notifications
      .filter(n=>!n.is_read)
      .map(n=>n.id);
    
    if(unreadIds.length>0){
      await supabase
        .from('notifications')
        .update({is_read:true})
        .in('id',unreadIds);
      
      state.notifications.forEach(n=>{
        if(unreadIds.includes(n.id)){
          n.is_read=true;
        }
      });
      
      updateNotificationBadge();
    }
  }catch(error){
    console.error('既読更新エラー:',error);
  }
}

// ========================================
// 探索画面
// ========================================

async function showExplore(){
  const timeline=document.getElementById('timeline');
  timeline.innerHTML='<div class="timeline-loading"><div class="loading-spinner"></div><p>読み込み中...</p></div>';
  
  try{
    // 人気の投稿を取得（いいね数でソート）
    const{data:posts,error}=await supabase
      .from('posts')
      .select(`
        *,
        profiles!posts_user_id_fkey(id,user_id,display_name,avatar_url,avatar_color),
        likes(count),
        comments(count),
        reposts(count)
      `)
      .order('created_at',{ascending:false})
      .limit(30);
    
    if(error)throw error;
    
    // いいね数でソート
    const sortedPosts=(posts||[]).sort((a,b)=>{
      const aLikes=a.likes?.[0]?.count||0;
      const bLikes=b.likes?.[0]?.count||0;
      return bLikes-aLikes;
    });
    
    state.explorePosts=sortedPosts;
    displayPosts(sortedPosts);
  }catch(error){
    console.error('探索読み込みエラー:',error);
    timeline.innerHTML='<div class="timeline-loading"><p>読み込みに失敗しました</p></div>';
  }
}

// ========================================
// プロフィール画面
// ========================================

async function showProfile(){
  const timeline=document.getElementById('timeline');
  timeline.innerHTML='<div class="timeline-loading"><div class="loading-spinner"></div><p>読み込み中...</p></div>';
  
  try{
    // 自分の投稿を取得
    const{data:posts,error}=await supabase
      .from('posts')
      .select(`
        *,
        profiles!posts_user_id_fkey(id,user_id,display_name,avatar_url,avatar_color),
        likes(count),
        comments(count),
        reposts(count)
      `)
      .eq('user_id',state.currentProfile.id)
      .order('created_at',{ascending:false})
      .limit(50);
    
    if(error)throw error;
    
    // プロフィールヘッダーを作成
    const header=document.createElement('div');
    header.className='profile-header';
    header.style.cssText='padding:24px;background:var(--bg-primary);border-bottom:1px solid var(--border);margin-bottom:16px;';
    
    const avatarHtml=state.currentProfile.avatar_url
      ?`<img src="${state.currentProfile.avatar_url}" alt="${state.currentProfile.display_name}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;">`
      :`<div style="width:80px;height:80px;display:flex;align-items:center;justify-content:center;background:${state.currentProfile.avatar_color||'#ff6b35'};color:#fff;font-weight:600;font-size:32px;border-radius:50%;">${state.currentProfile.display_name.charAt(0).toUpperCase()}</div>`;
    
    // 【修正】フォロワー・フォロー中数を取得 (dataではなくcountを直接取得する)
    const{count:followersCount}=await supabase
      .from('follows')
      .select('*',{count:'exact',head:true})
      .eq('following_id',state.currentProfile.id);
    
    const{count:followingCount}=await supabase
      .from('follows')
      .select('*',{count:'exact',head:true})
      .eq('follower_id',state.currentProfile.id);
    
    // 修正前の .length 計算コードは削除済み
    
    header.innerHTML=`
      <div style="display:flex;gap:20px;align-items:flex-start;">
        ${avatarHtml}
        <div style="flex:1;">
          <h2 style="font-size:24px;font-weight:700;margin-bottom:4px;">${state.currentProfile.display_name}</h2>
          <p style="color:var(--text-secondary);margin-bottom:12px;">@${state.currentProfile.user_id}</p>
          <div style="display:flex;gap:20px;font-size:14px;">
            <div><strong>${(posts||[]).length}</strong> <span style="color:var(--text-secondary);">投稿</span></div>
            <div><strong>${followingCount||0}</strong> <span style="color:var(--text-secondary);">フォロー中</span></div>
            <div><strong>${followersCount||0}</strong> <span style="color:var(--text-secondary);">フォロワー</span></div>
          </div>
        </div>
      </div>
    `;
    
    timeline.innerHTML='';
    timeline.appendChild(header);
    
    state.userPosts=posts||[];
    
    if(posts&&posts.length>0){
      posts.forEach(post=>{
        const postEl=createPostCard(post);
        timeline.appendChild(postEl);
      });
    }else{
      const empty=document.createElement('div');
      empty.className='timeline-loading';
      empty.innerHTML='<p>まだ投稿がありません</p>';
      timeline.appendChild(empty);
    }
  }catch(error){
    console.error('プロフィール読み込みエラー:',error);
    timeline.innerHTML='<div class="timeline-loading"><p>読み込みに失敗しました</p></div>';
  }
}

// ========================================
// リアルタイム監視
// ========================================

function subscribeToUpdates(){
  // 投稿の変更を監視
  supabase
    .channel('posts-changes')
    .on('postgres_changes',{
      event:'*',
      schema:'public',
      table:'posts'
    },()=>{
      if(state.currentView==='home'){
        loadPosts();
      }else if(state.currentView==='explore'){
        showExplore();
      }else if(state.currentView==='profile'){
        showProfile();
      }
    })
    .subscribe();
  
  // 通知の変更を監視
  supabase
    .channel('notifications-changes')
    .on('postgres_changes',{
      event:'INSERT',
      schema:'public',
      table:'notifications',
      filter:`user_id=eq.${state.currentProfile.id}`
    },()=>{
      loadNotifications();
    })
    .subscribe();
  
  // コメントの変更を監視
  supabase
    .channel('comments-changes')
    .on('postgres_changes',{
      event:'*',
      schema:'public',
      table:'comments'
    },()=>{
      if(state.currentView==='home'){
        loadPosts();
      }
    })
    .subscribe();
  
  // いいね・リポストの変更を監視
  supabase
    .channel('likes-changes')
    .on('postgres_changes',{
      event:'*',
      schema:'public',
      table:'likes'
    },()=>{
      if(state.currentView==='home'){
        loadPosts();
      }
    })
    .subscribe();
  
  supabase
    .channel('reposts-changes')
    .on('postgres_changes',{
      event:'*',
      schema:'public',
      table:'reposts'
    },()=>{
      if(state.currentView==='home'){
        loadPosts();
      }
    })
    .subscribe();
}

// ========================================
// ユーティリティ
// ========================================

function escapeHtml(text){
  const div=document.createElement('div');
  div.textContent=text;
  let escaped=div.innerHTML;
  
  // URLをリンク化
  const urlRegex=/(https?:\/\/[^\s]+)/g;
  escaped=escaped.replace(urlRegex,'<a href="$1" target="_blank" rel="noopener noreferrer" style="color:var(--main);text-decoration:underline;">$1</a>');
  
  // 改行を<br>に
  escaped=escaped.replace(/\n/g,'<br>');
  
  return escaped;
}

function getTimeAgo(timestamp){
  const now=Date.now();
  const then=new Date(timestamp).getTime();
  const diff=now-then;
  
  const seconds=Math.floor(diff/1000);
  const minutes=Math.floor(seconds/60);
  const hours=Math.floor(minutes/60);
  const days=Math.floor(hours/24);
  
  if(seconds<60)return`${seconds}秒前`;
  if(minutes<60)return`${minutes}分前`;
  if(hours<24)return`${hours}時間前`;
  if(days<7)return`${days}日前`;
  
  return new Date(timestamp).toLocaleDateString('ja-JP',{
    month:'short',
    day:'numeric'
  });
}