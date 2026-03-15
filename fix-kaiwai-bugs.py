import re,sys

def fix(path,old,new,label):
  try:
    with open(path,'r',encoding='utf-8') as f:
      txt=f.read()
    if old not in txt:
      print(f'⚠️  [{label}] 対象文字列が見つかりません（既に修正済み？）')
      return
    with open(path,'w',encoding='utf-8') as f:
      f.write(txt.replace(old,new,1))
    print(f'✅ [{label}]')
  except Exception as e:
    print(f'❌ [{label}] {e}')

BASE='public/sites.google.com/js'

# ============================================================
# 1. chat-state.js - fetchUserCommunities に order 追加
# ============================================================
fix(
  f'{BASE}/chat-state.js',
  ".select('community_id,role,communities(id,name)')\n    .eq('user_id',userId);",
  ".select('community_id,role,communities(id,name)')\n    .eq('user_id',userId)\n    .order('created_at');",
  'chat-state.js: fetchUserCommunities order追加'
)

# ============================================================
# 2. kaiwai-join.js - 招待コード小文字化
# ============================================================
fix(
  f'{BASE}/kaiwai-join.js',
  "const code=document.getElementById('inp-code').value.trim();",
  "const code=document.getElementById('inp-code').value.trim().toLowerCase();",
  'kaiwai-join.js: 招待コード小文字化'
)

# ============================================================
# 3. db.js - 空メンバー時の全ユーザー表示バグ
# ============================================================
fix(
  f'{BASE}/db.js',
  "    let query=supabase.from('profiles').select('*').order('created_at',{ascending:false});\n    if(memberIds&&memberIds.length>0){\n      query=query.in('id',memberIds);\n    }",
  "    if(!memberIds||memberIds.length===0){\n      allProfiles=[];\n      displayProfiles();\n      return;\n    }\n    let query=supabase.from('profiles').select('*').order('created_at',{ascending:false});\n    query=query.in('id',memberIds);",
  'db.js: 空メンバー時の全員表示バグ修正'
)

# ============================================================
# 4. admin-requests.js - 招待コード重複時のエラーメッセージ改善
# ============================================================
fix(
  f'{BASE}/admin-requests.js',
  "  if(e1){\n    alert('承認失敗 (communities INSERT): '+e1.message);\n    if(btn){btn.disabled=false;btn.textContent='承認';}\n    return;\n  }",
  "  if(e1){\n    const msg=(e1.message.includes('duplicate')||e1.message.includes('unique'))\n      ?'招待コードが他の界隈と重複しています。コードを変更して再度承認してください。'\n      :'承認失敗: '+e1.message;\n    alert(msg);\n    if(btn){btn.disabled=false;btn.textContent='承認';}\n    return;\n  }",
  'admin-requests.js: 重複エラーメッセージ改善'
)

# ============================================================
# 5. chat.js - import に DEFAULT_COMMUNITY_ID 追加
# ============================================================
fix(
  f'{BASE}/chat.js',
  "import{state,updateState,fetchChannels,fetchUserCommunities}from'./chat-state.js';",
  "import{state,updateState,fetchChannels,fetchUserCommunities,DEFAULT_COMMUNITY_ID}from'./chat-state.js';",
  'chat.js: DEFAULT_COMMUNITY_ID import追加'
)

# ============================================================
# 6. chat.js - communities→channels の初期化順序修正 & DEBUGログ整理
# ============================================================
fix(
  f'{BASE}/chat.js',
  "    console.log('[DEBUG] 3: channels fetch開始');\ntry{\n  const channels=await fetchChannels();\n  updateState('channels',channels);\n  console.log('[DEBUG] 3: channels fetch ✅ 件数:', channels.length);\n  const communities=await fetchUserCommunities(profile.id);\n  updateState('communities',communities);\n  renderCommunitySwitcher();\n}catch(e){console.error('[DEBUG] 3: channels fetch ❌', e);}\n\nconsole.log('[DEBUG] 4: loadUsers開始');\n\n    console.log('[DEBUG] 3: loadUsers開始');",
  "    try{\n  const communities=await fetchUserCommunities(profile.id);\n  updateState('communities',communities);\n  const firstId=communities[0]?.id||DEFAULT_COMMUNITY_ID;\n  updateState('currentCommunityId',firstId);\n  const channels=await fetchChannels(firstId);\n  updateState('channels',channels);\n  renderCommunitySwitcher();\n}catch(e){console.error('[communities/channels fetch]',e);}",
  'chat.js: 初期化順序修正'
)

print('\n🎉 全修正処理完了')