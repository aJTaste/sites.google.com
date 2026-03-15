import os

def fix(path,old,new,label):
  try:
    with open(path,'r',encoding='utf-8') as f:
      txt=f.read()
    if old not in txt:
      print(f'⚠️  [{label}] 対象が見つかりません（スキップ）')
      return
    with open(path,'w',encoding='utf-8') as f:
      f.write(txt.replace(old,new,1))
    print(f'✅ [{label}]')
  except Exception as e:
    print(f'❌ [{label}] {e}')

def write(path,content,label):
  os.makedirs(os.path.dirname(path),exist_ok=True)
  with open(path,'w',encoding='utf-8') as f:
    f.write(content)
  print(f'✅ [{label}] 新規作成')

B=f'public/sites.google.com'

# ============================================================
# 1. permissions.js
#    owner / member をロール階層に追加
# ============================================================
fix(f'{B}/common/permissions.js',
'const ROLE_HIERARCHY={\n  admin:3,\n  moderator:2,\n  user:1\n};',
'const ROLE_HIERARCHY={\n  admin:4,\n  owner:3,\n  moderator:2,\n  user:1,\n  member:1\n};',
'permissions.js: owner/memberロール追加')

# ============================================================
# 2. chat-state.js
#    getCurrentCommunityRole() を末尾に追加
# ============================================================
fix(f'{B}/js/chat-state.js',
"export function resetMessageState(){\n  state.selectedImage=null;\n  state.replyToMessage=null;\n}",
"export function resetMessageState(){\n  state.selectedImage=null;\n  state.replyToMessage=null;\n}\n\n// 現在の界隈におけるロールを返す（グローバルロールより優先）\nexport function getCurrentCommunityRole(){\n  const c=(state.communities||[]).find(c=>c.id===state.currentCommunityId);\n  return c?.role||state.currentProfile?.role||'user';\n}",
'chat-state.js: getCurrentCommunityRole追加')

# ============================================================
# 3. chat-ui.js
#    import に getCurrentCommunityRole を追加
# ============================================================
fix(f'{B}/js/chat-ui.js',
"import{state,fetchChannels,updateState}from'./chat-state.js';",
"import{state,fetchChannels,updateState,getCurrentCommunityRole}from'./chat-state.js';",
'chat-ui.js: getCurrentCommunityRole import')

# ============================================================
# 4. chat-ui.js
#    canAccessChannel のロール引数を界隈ロールに変更
# ============================================================
fix(f'{B}/js/chat-ui.js',
"const accessibleChannels=(state.channels||[]).filter(ch=>\n    canAccessChannel(state.currentProfile?.role,ch.requiredRole)\n  );",
"const comRole=getCurrentCommunityRole();\n  const accessibleChannels=(state.channels||[]).filter(ch=>\n    canAccessChannel(comRole,ch.requiredRole)\n  );",
'chat-ui.js: canAccessChannelを界隈ロール対応に')

# ============================================================
# 5. chat-handlers.js
#    canAccessChannel のロール引数を界隈ロールに変更
# ============================================================
fix(f'{B}/js/chat-handlers.js',
"import{canAccessChannel}from'../common/permissions.js';",
"import{canAccessChannel}from'../common/permissions.js';\nimport{getCurrentCommunityRole}from'./chat-state.js';",
'chat-handlers.js: getCurrentCommunityRole import')

fix(f'{B}/js/chat-handlers.js',
"  if(!canAccessChannel(state.currentProfile.role,channel.requiredRole)){\n    alert('このチャンネルへのアクセス権限がありません');\n    return;\n  }",
"  if(!canAccessChannel(getCurrentCommunityRole(),channel.requiredRole)){\n    alert('このチャンネルへのアクセス権限がありません');\n    return;\n  }",
'chat-handlers.js: canAccessChannelを界隈ロール対応に')

# ============================================================
# 6. admin-requests.js
#    承認時にデフォルト4チャンネルを自動作成
# ============================================================
fix(f'{B}/js/admin-requests.js',
"  // Step3: community_requests UPDATE",
"""  // Step3: デフォルトチャンネルを作成
  const DEFAULT_CHANNELS=[
    {name:'連絡',description:'お知らせや連絡事項',icon:'campaign',required_role:null},
    {name:'チャンネルA',description:'自由に使えるチャンネル',icon:'tag',required_role:null},
    {name:'チャンネルB',description:'自由に使えるチャンネル',icon:'tag',required_role:null},
    {name:'モデレーター専用',description:'モデレーター限定チャット',icon:'shield',required_role:'moderator'},
  ];
  const{error:ech}=await supabase
    .from('channels')
    .insert(DEFAULT_CHANNELS.map(ch=>({...ch,community_id:community.id})));
  if(ech)console.error('[approveRequest] channels INSERT failed',ech);

  // Step4: community_requests UPDATE""",
'admin-requests.js: デフォルトチャンネル自動作成')

# ============================================================
# 7. hub.html
#    メンバー管理ページへのリンクを追加
# ============================================================
fix(f'{B}/hub.html',
"""            <a href="kaiwai-apply.html" style="text-decoration:none;color:inherit;">
              <div class="app-card">
                <div class="app-icon">
                  <span class="material-symbols-outlined">group_add</span>
                </div>
                <h3>界隈を作成する</h3>
                <p>新しい界隈の作成を申請できます。</p>
              </div>
            </a>""",
"""            <a href="kaiwai-apply.html" style="text-decoration:none;color:inherit;">
              <div class="app-card">
                <div class="app-icon">
                  <span class="material-symbols-outlined">group_add</span>
                </div>
                <h3>界隈を作成する</h3>
                <p>新しい界隈の作成を申請できます。</p>
              </div>
            </a>
            <a href="kaiwai-manage.html" style="text-decoration:none;color:inherit;">
              <div class="app-card">
                <div class="app-icon">
                  <span class="material-symbols-outlined">manage_accounts</span>
                </div>
                <h3>界隈メンバー管理</h3>
                <p>モデレーターの設定・解除ができます。</p>
              </div>
            </a>""",
'hub.html: メンバー管理リンク追加')

# ============================================================
# 8. kaiwai-manage.html（新規）
# ============================================================
write(f'{B}/kaiwai-manage.html',
"""<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>界隈メンバー管理 | AppHub</title>
  <link rel="stylesheet" href="common/common.css">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200">
  <link rel="icon" href="assets/favicon1.svg">
  <link rel="apple-touch-icon" href="assets/icon1.svg">
  <style>
    .manage-wrap{max-width:520px;margin:40px auto;padding:0 16px 40px;}
    .manage-head{display:flex;align-items:center;gap:12px;margin-bottom:24px;}
    .manage-head-icon{width:48px;height:48px;border-radius:12px;background:var(--main-light);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
    .manage-head-icon .material-symbols-outlined{font-size:26px;color:var(--main);}
    .manage-head h2{font-size:20px;font-weight:700;margin-bottom:2px;}
    .manage-head p{font-size:13px;color:var(--text-secondary);margin:0;}
    .community-select{width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg-primary);color:var(--text-primary);font-size:14px;margin-bottom:20px;cursor:pointer;}
    .member-item{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--border);border-radius:10px;margin-bottom:8px;background:var(--bg-primary);}
    .member-avatar{width:40px;height:40px;border-radius:50%;overflow:hidden;flex-shrink:0;}
    .member-avatar img{width:40px;height:40px;object-fit:cover;}
    .member-info{flex:1;min-width:0;}
    .member-name{font-size:14px;font-weight:600;display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
    .member-id{font-size:11px;color:var(--text-tertiary);margin-top:1px;}
    .member-action{flex-shrink:0;}
    .role-badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;}
    .role-owner{background:#fef3c7;color:#92400e;}
    .role-moderator{background:#ede9fe;color:#5b21b6;}
    [data-theme="dark"] .role-owner{background:rgba(146,64,14,0.2);color:#fcd34d;}
    [data-theme="dark"] .role-moderator{background:rgba(91,33,182,0.2);color:#c4b5fd;}
    .btn-promote{padding:6px 12px;border-radius:6px;border:none;background:var(--main);color:#fff;font-size:12px;font-weight:600;cursor:pointer;}
    .btn-demote{padding:6px 12px;border-radius:6px;border:1px solid var(--border);background:var(--bg-secondary);color:var(--text-primary);font-size:12px;font-weight:600;cursor:pointer;}
    .btn-promote:hover{opacity:.85;}
    .btn-demote:hover{background:var(--bg-primary);}
    .manage-empty{text-align:center;padding:40px;color:var(--text-tertiary);font-size:14px;}
  </style>
</head>
<body class="page-loading">
  <div class="app-container">
    <div class="main-container">
      <main class="main-content">
        <div class="manage-wrap">
          <div class="manage-head">
            <div class="manage-head-icon">
              <span class="material-symbols-outlined">manage_accounts</span>
            </div>
            <div>
              <h2>界隈メンバー管理</h2>
              <p id="community-label">読み込み中...</p>
            </div>
          </div>
          <select class="community-select" id="community-select" hidden></select>
          <div id="member-list">
            <div class="manage-empty">読み込み中...</div>
          </div>
        </div>
      </main>
    </div>
  </div>
  <script type="module" src="js/kaiwai-manage.js"></script>
  <script src="common/stealth-mode.js"></script>
  <script src="common/capture-handler.js"></script>
  <script src="common/eruda-init.js"></script>
</body>
</html>""",
'kaiwai-manage.html')

# ============================================================
# 9. js/kaiwai-manage.js（新規）
# ============================================================
write(f'{B}/js/kaiwai-manage.js',
"""import{initPage}from'../common/core.js';
import{supabase}from'../common/supabase-config.js';
import{geoAvatarDataUrl}from'../common/geo-avatar.js';

let myProfile=null;
let myManagedCommunities=[];  // 管理権限のある界隈一覧
let currentCommunityId=null;

await initPage('kaiwai-manage','界隈メンバー管理',{onUserLoaded:async(profile)=>{
  myProfile=profile;
  await loadManagedCommunities();
}});

// ========================================
// 管理可能な界隈を取得
// ========================================
async function loadManagedCommunities(){
  const{data:memberships,error}=await supabase
    .from('community_members')
    .select('community_id,role,communities(id,name)')
    .eq('user_id',myProfile.id)
    .in('role',['owner','moderator']);

  if(error||!memberships||memberships.length===0){
    document.getElementById('community-label').textContent='管理できる界隈がありません';
    document.getElementById('member-list').innerHTML='<div class="manage-empty">オーナーまたはモデレーターの界隈がありません</div>';
    return;
  }

  myManagedCommunities=memberships.map(m=>({
    id:m.community_id,
    name:m.communities?.name||'界隈',
    myRole:m.role
  }));

  // セレクターを構築
  const sel=document.getElementById('community-select');
  myManagedCommunities.forEach(c=>{
    const opt=document.createElement('option');
    opt.value=c.id;
    opt.textContent=c.name+(c.myRole==='owner'?' (オーナー)':' (モデレーター)');
    sel.appendChild(opt);
  });

  if(myManagedCommunities.length>1){
    sel.hidden=false;
    sel.addEventListener('change',()=>{
      currentCommunityId=sel.value;
      loadMembers();
    });
  }

  currentCommunityId=myManagedCommunities[0].id;
  document.getElementById('community-label').textContent=myManagedCommunities[0].name;
  await loadMembers();
}

// ========================================
// メンバー一覧を読み込む
// ========================================
async function loadMembers(){
  const list=document.getElementById('member-list');
  list.innerHTML='<div class="manage-empty">読み込み中...</div>';

  // 現在の自分のロール
  const myCom=myManagedCommunities.find(c=>c.id===currentCommunityId);
  const myRole=myCom?.myRole||'member';

  const{data:members,error}=await supabase
    .from('community_members')
    .select('user_id,role,profiles(id,display_name,avatar_url,user_id)')
    .eq('community_id',currentCommunityId);

  if(error||!members){
    list.innerHTML='<div class="manage-empty">取得に失敗しました</div>';
    return;
  }

  // ロール順でソート: owner > moderator > member
  const ORDER={owner:0,moderator:1,member:2};
  members.sort((a,b)=>(ORDER[a.role]??9)-(ORDER[b.role]??9));

  list.innerHTML='';
  members.forEach(m=>{
    const p=m.profiles;
    if(!p)return;
    const isSelf=m.user_id===myProfile.id;
    const isOwner=m.role==='owner';

    const item=document.createElement('div');
    item.className='member-item';

    const src=p.avatar_url||geoAvatarDataUrl(p.id,40);

    let badge='';
    if(m.role==='owner') badge='<span class="role-badge role-owner">オーナー</span>';
    else if(m.role==='moderator') badge='<span class="role-badge role-moderator">Mod</span>';

    // ボタン表示条件:
    // - 自分自身 or オーナー相手 → 表示しない
    // - myRole=owner → 誰でもMod昇格/降格可
    // - myRole=moderator → memberのみMod昇格可（降格は不可）
    let btn='';
    if(!isSelf&&!isOwner){
      if(m.role==='moderator'&&myRole==='owner'){
        btn=`<button class="btn-demote mod-btn" data-uid="${m.user_id}" data-action="demote">Modを外す</button>`;
      }else if(m.role==='member'){
        btn=`<button class="btn-promote mod-btn" data-uid="${m.user_id}" data-action="promote">Modに設定</button>`;
      }
    }

    item.innerHTML=`
      <div class="member-avatar"><img src="${src}" alt=""></div>
      <div class="member-info">
        <div class="member-name">${esc(p.display_name)}${badge}</div>
        <div class="member-id">ID: ${esc(p.user_id||'')}</div>
      </div>
      <div class="member-action">${btn}</div>
    `;
    list.appendChild(item);
  });

  list.querySelectorAll('.mod-btn').forEach(btn=>{
    btn.addEventListener('click',()=>handleRoleChange(btn.dataset.uid,btn.dataset.action,btn));
  });
}

// ========================================
// ロール変更
// ========================================
async function handleRoleChange(userId,action,btn){
  btn.disabled=true;
  btn.textContent='処理中...';
  const newRole=action==='promote'?'moderator':'member';

  const{error}=await supabase
    .from('community_members')
    .update({role:newRole})
    .eq('community_id',currentCommunityId)
    .eq('user_id',userId);

  if(error){
    alert('変更に失敗しました: '+error.message);
    btn.disabled=false;
    btn.textContent=action==='promote'?'Modに設定':'Modを外す';
    return;
  }
  await loadMembers();
}

function esc(t){
  const d=document.createElement('div');
  d.textContent=t||'';
  return d.innerHTML;
}""",
'js/kaiwai-manage.js')

print('\n🎉 全修正処理完了')
print('\n📋 変更内容:')
print('  1. permissions.js   - owner/memberをロール階層に追加')
print('  2. chat-state.js    - getCurrentCommunityRole()を追加')
print('  3. chat-ui.js       - チャンネル表示を界隈ロールで判定')
print('  4. chat-handlers.js - チャンネルアクセスを界隈ロールで判定')
print('  5. admin-requests.js- 承認時にデフォルト4チャンネルを作成')
print('  6. hub.html         - メンバー管理ページへのリンクを追加')
print('  7. kaiwai-manage.html (新規)')
print('  8. js/kaiwai-manage.js (新規)')