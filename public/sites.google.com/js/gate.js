import{initPage,supabase,getCurrentProfile}from'../common/core.js';
import{uploadToCloudinary}from'../common/cloudinary.js';
import{geoAvatarDataUrl}from'../common/geo-avatar.js';

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
  userProfile:null,
  searchQuery:'',
  viewingUserId:null
};

// ========================================
// 初期化
// ========================================

await initPage('gate','aJTGate',{
  onUserLoaded:async(profile)=>{
    state.currentProfile=profile;

    await loadPosts();
    await loadSuggestedUsers();
    await loadNotifications();

    subscribeToUpdates();
    setupEventListeners();
  }
});

// ========================================
// イベントリスナー
// ========================================

function setupEventListeners(){
  document.querySelectorAll('.gate-nav-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const view=btn.dataset.view;
      switchView(view);
    });
  });

  document.querySelectorAll('.gate-tab').forEach(tab=>{
    tab.addEventListener('click',()=>{
      const feed=tab.dataset.feed;
      switchFeed(feed);
    });
  });

  document.getElementById('new-post-btn').addEventListener('click',openPostModal);
  document.getElementById('post-modal-close').addEventListener('click',closePostModal);
  document.getElementById('post-cancel').addEventListener('click',closePostModal);
  document.getElementById('add-media-btn').addEventListener('click',()=>{
    document.getElementById('media-input').click();
  });

  document.getElementById('media-input').addEventListener('change',handleMediaSelect);

  document.getElementById('post-text').addEventListener('input',(e)=>{
    const remaining=280-e.target.value.length;
    const countEl=document.getElementById('char-count');
    countEl.textContent=remaining;
    countEl.style.color=remaining<0?'#cf222e':remaining<20?'#f97316':'var(--text-tertiary)';
  });

  document.getElementById('post-submit').addEventListener('click',submitPost);

  document.getElementById('detail-modal-close').addEventListener('click',()=>{
    document.getElementById('detail-modal').classList.remove('show');
  });

  // 検索
  const searchInput=document.getElementById('search-input');
  let searchTimeout;
  searchInput.addEventListener('input',(e)=>{
    const query=e.target.value.trim();
    state.searchQuery=query;
    clearTimeout(searchTimeout);
    if(query===''){
      // 検索クリア → 元の表示に戻す
      restoreCurrentView();
      return;
    }
    searchTimeout=setTimeout(()=>{
      handleSearch(query);
    },300);
  });

  document.querySelectorAll('.gate-modal').forEach(modal=>{
    modal.addEventListener('click',(e)=>{
      if(e.target===modal){
        modal.classList.remove('show');
      }
    });
  });
}

// ========================================
// 現在のビューを再表示
// ========================================

function restoreCurrentView(){
  if(state.currentView==='home'){
    loadPosts();
  }else if(state.currentView==='explore'){
    showExplore();
  }else if(state.currentView==='notifications'){
    showNotifications();
  }else if(state.currentView==='profile'){
    if(state.viewingUserId&&state.viewingUserId!==state.currentProfile.id){
      showUserProfile(state.viewingUserId);
    }else{
      showProfile();
    }
  }
}

// ========================================
// 検索機能
// ========================================

async function handleSearch(query){
  const timeline=document.getElementById('timeline');
  timeline.innerHTML='<div class="timeline-loading"><div class="loading-spinner"></div><p>検索中...</p></div>';

  try{
    // ユーザー検索
    const{data:users,error:userErr}=await supabase
      .from('profiles')
      .select('*')
      .or(`display_name.ilike.%${query}%,user_id.ilike.%${query}%`)
      .limit(10);

    if(userErr)throw userErr;

    // 投稿検索
    const{data:posts,error:postErr}=await supabase
      .from('posts')
      .select(`
        *,
        profiles!posts_user_id_fkey(id,user_id,display_name,avatar_url,avatar_color),
        likes(count),
        comments(count),
        reposts(count)
      `)
      .ilike('text',`%${query}%`)
      .order('created_at',{ascending:false})
      .limit(20);

    if(postErr)throw postErr;

    timeline.innerHTML='';

    // 検索ヘッダー
    const header=document.createElement('div');
    header.style.cssText='padding:14px 18px;font-size:15px;font-weight:700;color:var(--text-primary);border-bottom:1px solid var(--border);background:var(--bg-primary);';
    header.textContent=`"${query}" の検索結果`;
    timeline.appendChild(header);

    const hasUsers=users&&users.length>0;
    const hasPosts=posts&&posts.length>0;

    if(!hasUsers&&!hasPosts){
      const empty=document.createElement('div');
      empty.className='timeline-loading';
      empty.innerHTML='<p>検索結果がありません</p>';
      timeline.appendChild(empty);
      return;
    }

    // ユーザー結果
    if(hasUsers){
      const sectionTitle=document.createElement('div');
      sectionTitle.style.cssText='padding:10px 18px;font-size:13px;font-weight:700;color:var(--text-secondary);background:var(--bg-secondary);border-bottom:1px solid var(--border);';
      sectionTitle.textContent='ユーザー';
      timeline.appendChild(sectionTitle);

      users.forEach(user=>{
        const item=createUserSearchCard(user);
        timeline.appendChild(item);
      });
    }

    // 投稿結果
    if(hasPosts){
      const sectionTitle=document.createElement('div');
      sectionTitle.style.cssText='padding:10px 18px;font-size:13px;font-weight:700;color:var(--text-secondary);background:var(--bg-secondary);border-bottom:1px solid var(--border);';
      sectionTitle.textContent='投稿';
      timeline.appendChild(sectionTitle);

      posts.forEach(post=>{
        const postEl=createPostCard(post);
        timeline.appendChild(postEl);
      });
    }

  }catch(error){
    console.error('検索エラー:',error);
    timeline.innerHTML='<div class="timeline-loading"><p>検索に失敗しました</p></div>';
  }
}

// ユーザー検索カード
function createUserSearchCard(user){
  const item=document.createElement('div');
  item.className='post-card';
  item.style.cursor='pointer';

  const avatarHtml=`<img src="${user.avatar_url||geoAvatarDataUrl(user.id,44)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;

  const isSelf=user.id===state.currentProfile.id;

  item.innerHTML=`
    <div style="display:flex;align-items:center;gap:14px;">
      <div style="width:48px;height:48px;border-radius:50%;overflow:hidden;flex-shrink:0;background:var(--bg-secondary);">${avatarHtml}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:16px;font-weight:700;color:var(--text-primary);">${escapeHtml(user.display_name)}</div>
        <div style="font-size:14px;color:var(--text-secondary);">@${escapeHtml(user.user_id)}</div>
      </div>
      ${!isSelf?`<button class="follow-btn" data-user-id="${user.id}" style="flex-shrink:0;">フォロー</button>`:''}
    </div>
  `;

  // フォローボタン
  if(!isSelf){
    const followBtn=item.querySelector('.follow-btn');
    // フォロー状態を非同期で確認
    checkFollowStatus(user.id).then(isFollowing=>{
      if(isFollowing){
        followBtn.textContent='フォロー中';
        followBtn.classList.add('following');
      }
    });
    followBtn.addEventListener('click',(e)=>{
      e.stopPropagation();
      toggleFollow(user.id,followBtn);
    });
  }

  // カードクリックでプロフィール表示
  item.addEventListener('click',(e)=>{
    if(!e.target.closest('.follow-btn')){
      showUserProfile(user.id);
    }
  });

  return item;
}

// フォロー状態確認
async function checkFollowStatus(userId){
  const{data}=await supabase
    .from('follows')
    .select('id')
    .eq('follower_id',state.currentProfile.id)
    .eq('following_id',userId)
    .maybeSingle();
  return!!data;
}

// ========================================
// 他ユーザーのプロフィール表示
// ========================================

async function showUserProfile(userId){
  state.viewingUserId=userId;
  const timeline=document.getElementById('timeline');
  timeline.innerHTML='<div class="timeline-loading"><div class="loading-spinner"></div><p>読み込み中...</p></div>';

  // ナビをprofileにする（視覚的に切り替え）
  document.querySelectorAll('.gate-nav-btn').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.view==='profile');
  });

  try{
    const{data:profile,error:profileErr}=await supabase
      .from('profiles')
      .select('*')
      .eq('id',userId)
      .single();

    if(profileErr)throw profileErr;

    const{data:posts,error:postsErr}=await supabase
      .from('posts')
      .select(`
        *,
        profiles!posts_user_id_fkey(id,user_id,display_name,avatar_url,avatar_color),
        likes(count),
        comments(count),
        reposts(count)
      `)
      .eq('user_id',userId)
      .order('created_at',{ascending:false})
      .limit(50);

    if(postsErr)throw postsErr;

    const{count:followersCount}=await supabase
      .from('follows')
      .select('*',{count:'exact',head:true})
      .eq('following_id',userId);

    const{count:followingCount}=await supabase
      .from('follows')
      .select('*',{count:'exact',head:true})
      .eq('follower_id',userId);

    const isFollowing=await checkFollowStatus(userId);
    const isSelf=userId===state.currentProfile.id;

    const avatarHtml=`<img src="${profile.avatar_url||geoAvatarDataUrl(profile.id,80)}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;">`;

    timeline.innerHTML='';

    const header=document.createElement('div');
    header.style.cssText='padding:20px 18px;background:var(--bg-primary);border-bottom:1px solid var(--border);';

    header.innerHTML=`
      <div style="display:flex;gap:20px;align-items:flex-start;">
        ${avatarHtml}
        <div style="flex:1;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
            <h2 style="font-size:22px;font-weight:700;">${escapeHtml(profile.display_name)}</h2>
            ${!isSelf?`<button class="follow-btn${isFollowing?' following':''}" id="profile-follow-btn" data-user-id="${userId}">${isFollowing?'フォロー中':'フォロー'}</button>`:'<span style="padding:6px 14px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:18px;font-size:13px;font-weight:600;color:var(--text-secondary);">自分</span>'}
          </div>
          <p style="color:var(--text-secondary);font-size:14px;margin-bottom:12px;">@${escapeHtml(profile.user_id)}</p>
          <div style="display:flex;gap:20px;font-size:14px;">
            <div><strong>${(posts||[]).length}</strong> <span style="color:var(--text-secondary);">投稿</span></div>
            <div><strong>${followingCount||0}</strong> <span style="color:var(--text-secondary);">フォロー中</span></div>
            <div><strong>${followersCount||0}</strong> <span style="color:var(--text-secondary);">フォロワー</span></div>
          </div>
        </div>
      </div>
    `;

    timeline.appendChild(header);

    // フォローボタンのイベント
    const followBtn=header.querySelector('#profile-follow-btn');
    if(followBtn){
      followBtn.addEventListener('click',()=>{
        toggleFollow(userId,followBtn);
      });
    }

    // 戻るボタン
    if(state.searchQuery){
      const backBtn=document.createElement('button');
      backBtn.style.cssText='margin:12px 18px;display:flex;align-items:center;gap:6px;padding:8px 14px;background:var(--bg-primary);border:1px solid var(--border);border-radius:18px;font-size:13px;font-weight:600;color:var(--text-secondary);cursor:pointer;';
      backBtn.innerHTML='<span class="material-symbols-outlined" style="font-size:16px;">arrow_back</span>検索結果に戻る';
      backBtn.addEventListener('click',()=>{
        handleSearch(state.searchQuery);
      });
      timeline.insertBefore(backBtn,header);
      timeline.removeChild(backBtn);
      timeline.appendChild(backBtn);
      // headerの後に挿入
      header.insertAdjacentElement('afterend',backBtn);
    }

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
// ビュー切り替え
// ========================================

function switchView(view){
  state.currentView=view;
  state.viewingUserId=null;

  // 検索クリア
  const searchInput=document.getElementById('search-input');
  if(searchInput)searchInput.value='';
  state.searchQuery='';

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
  const avatarHtml=`<img src="${profile?.avatar_url||geoAvatarDataUrl(profile?.id||'x',44)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;

  const timeAgo=getTimeAgo(post.created_at);

  const likesCount=post.likes?.[0]?.count||0;
  const repostsCount=post.reposts?.[0]?.count||0;
  const commentsCount=post.comments?.[0]?.count||0;

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
      <div class="post-avatar" style="cursor:pointer;" data-user-id="${profile?.id||''}">${avatarHtml}</div>
      <div class="post-author-info">
        <div>
          <span class="post-author-name" style="cursor:pointer;" data-user-id="${profile?.id||''}">${profile?.display_name||'不明'}</span>
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

  // アバター・名前クリックでプロフィール表示
  card.querySelectorAll('[data-user-id]').forEach(el=>{
    el.addEventListener('click',(e)=>{
      e.stopPropagation();
      const uid=el.dataset.userId;
      if(uid)showUserProfile(uid);
    });
  });

  card.addEventListener('click',(e)=>{
    if(!e.target.closest('.post-action-btn')&&!e.target.closest('[data-user-id]')){
      openPostDetail(post.id);
    }
  });

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

    const postCard=createPostCard(post);
    postCard.style.borderBottom='none';
    postCard.style.cursor='default';
    body.appendChild(postCard);

    const commentsSection=document.createElement('div');
    commentsSection.className='comments-section';

    const currentAvatarHtml=`<img src="${state.currentProfile.avatar_url||geoAvatarDataUrl(state.currentProfile.id,38)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;

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

    const commentsList=document.getElementById('comments-list');
    (comments||[]).forEach(comment=>{
      const commentCard=createCommentCard(comment);
      commentsList.appendChild(commentCard);
    });

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
  const avatarHtml=`<img src="${profile?.avatar_url||geoAvatarDataUrl(profile?.id||'x',34)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;

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

    const{data:post}=await supabase
      .from('posts')
      .select('user_id')
      .eq('id',postId)
      .single();

    if(post?.user_id&&post.user_id!==state.currentProfile.id){
      await createNotification(post.user_id,'comment',postId);
    }

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

    for(const file of state.mediaFiles){
      const type=file.type.startsWith('video')?'video':'image';
      const url=await uploadToCloudinary(file,'gate');
      mediaUrls.push(url);
      mediaTypes.push(type);
    }

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

      const isFollowing=await checkFollowStatus(user.id);

      item.innerHTML=`
        <div class="user-suggestion-avatar" style="cursor:pointer;" data-user-id="${user.id}">${avatarHtml}</div>
        <div class="user-suggestion-info" style="cursor:pointer;" data-user-id="${user.id}">
          <div class="user-suggestion-name">${user.display_name}</div>
          <div class="user-suggestion-id">@${user.user_id}</div>
        </div>
        <button class="follow-btn ${isFollowing?'following':''}" data-user-id="${user.id}">
          ${isFollowing?'フォロー中':'フォロー'}
        </button>
      `;

      item.querySelectorAll('[data-user-id]').forEach(el=>{
        el.addEventListener('click',(e)=>{
          if(!e.target.closest('.follow-btn')){
            showUserProfile(user.id);
          }
        });
      });

      item.querySelector('.follow-btn').addEventListener('click',(e)=>{
        e.stopPropagation();
        toggleFollow(user.id,e.currentTarget);
      });

      suggestedUsersEl.appendChild(item);
    }
  }catch(error){
    console.error('おすすめユーザー読み込みエラー:',error);
  }
}

async function toggleFollow(userId,btn){
  try{
    const{data:existing}=await supabase
      .from('follows')
      .select('id')
      .eq('follower_id',state.currentProfile.id)
      .eq('following_id',userId)
      .maybeSingle();

    if(existing){
      await supabase.from('follows').delete().eq('id',existing.id);
      if(btn){
        btn.textContent='フォロー';
        btn.classList.remove('following');
      }
    }else{
      await supabase.from('follows').insert({
        follower_id:state.currentProfile.id,
        following_id:userId
      });
      if(btn){
        btn.textContent='フォロー中';
        btn.classList.add('following');
      }
      await createNotification(userId,'follow',null);
    }

    // おすすめユーザーを更新（プロフィール画面でなければ）
    if(!state.viewingUserId){
      loadSuggestedUsers();
    }
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
    const avatarHtml=`<img src="${profile?.avatar_url||geoAvatarDataUrl(profile?.id||'x',44)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;

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
// 自分のプロフィール画面
// ========================================

async function showProfile(){
  state.viewingUserId=state.currentProfile.id;
  await showUserProfile(state.currentProfile.id);
}

// ========================================
// リアルタイム監視
// ========================================

function subscribeToUpdates(){
  supabase
    .channel('posts-changes')
    .on('postgres_changes',{
      event:'*',
      schema:'public',
      table:'posts'
    },()=>{
      if(state.currentView==='home'&&!state.searchQuery){
        loadPosts();
      }else if(state.currentView==='explore'&&!state.searchQuery){
        showExplore();
      }
    })
    .subscribe();

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

  supabase
    .channel('likes-changes')
    .on('postgres_changes',{
      event:'*',
      schema:'public',
      table:'likes'
    },()=>{
      if(state.currentView==='home'&&!state.searchQuery){
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
      if(state.currentView==='home'&&!state.searchQuery){
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

  const urlRegex=/(https?:\/\/[^\s]+)/g;
  escaped=escaped.replace(urlRegex,'<a href="$1" target="_blank" rel="noopener noreferrer" style="color:var(--main);text-decoration:underline;">$1</a>');

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