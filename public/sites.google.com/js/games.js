import{initPage}from'../common/core.js';
await initPage('games','Games');

// ============================================================
//  ゲームデータ
//  ゲームを追加するには、この配列にオブジェクトを1つ追加するだけ！
//
//  フィールド説明：
//  - id       : ユニークなID（英数字）
//  - title    : 表示名
//  - desc     : 説明文
//  - url      : 遷移先URL（games/ からの相対 or 絶対URL）
//  - cat      : カテゴリ → "minecraft" | "action" | "horror" | "other"
//  - tags     : タグ配列（任意、最大3つ推奨）
//  - icon     : Material Symbols アイコン名（省略時: stadia_controller）
//  - newTab   : true = 新しいタブで開く（省略時: true）
// ============================================================
const GAMES=[
  {
    id:'eag-js',
    title:'Eaglercraft JS',
    desc:'JavaScript版Minecraft。AppHub特設サーバーをデフォルト表示。',
    url:'games/eag-js.html',
    cat:'minecraft',
    tags:['マルチ対応','日本語'],
    icon:'deployed_code'
  },
  {
    id:'eag-wasm',
    title:'Eaglercraft WASM-GC',
    desc:'WASM-GC版Minecraft。JSより軽量で動作が安定している。',
    url:'games/eag-wasm-gc.html',
    cat:'minecraft',
    tags:['軽量'],
    icon:'memory'
  },
  {
    id:'shobon',
    title:'しょぼんのアクション',
    desc:'初見殺しで有名な鬼畜横スクロールアクション。覚悟して挑め。',
    url:'games/shobon.html',
    cat:'action',
    tags:['鬼畜','横スクロール'],
    icon:'sports_esports'
  },
  {
    id:'shobon-hub',
    title:'しょぼんのアクション（AppHub版）',
    desc:'AppHubのUIに溶け込んだカスタム版。見た目がオシャレ。',
    url:'games/shobon-hub.html',
    cat:'action',
    tags:['AppHub特製'],
    icon:'sports_esports'
  },
  {
    id:'aquarium',
    title:'アクアリウムは踊らない',
    desc:'ホラゲーらしい。詳細は不明だが評判は悪くない。',
    url:'games/aquarium.html',
    cat:'horror',
    tags:['ホラー'],
    icon:'water'
  },
  {
    id:'rajiata',
    title:'ラジアータの愛染罪',
    desc:'ホラゲーらしい（2作目）。前作とは別の雰囲気らしい。',
    url:'games/rajiata.html',
    cat:'horror',
    tags:['ホラー'],
    icon:'water'
  },
  {
    id:'rd',
    title:'Revenge ＆ Default ～エリスの復讐劇～',
    desc:'AppHub内で人気のゲーム。ストーリー系。',
    url:'games/r&d.html',
    cat:'other',
    tags:['大人気','ストーリー'],
    icon:'auto_stories'
  },
];

// ============================================================
//  カテゴリ定義（表示名・アイコン）
// ============================================================
const CATEGORIES={
  all:  {label:'すべて',   icon:'apps'},
  minecraft:{label:'Minecraft', icon:'deployed_code'},
  action:   {label:'アクション', icon:'sports_esports'},
  horror:   {label:'ホラー',    icon:'water'},
  other:    {label:'その他',    icon:'category'},
};

// ============================================================
//  状態
// ============================================================
let _activeCat='all';
let _query='';

// ============================================================
//  フィルタリング
// ============================================================
function _filtered(){
  return GAMES.filter(g=>{
    const catOk=_activeCat==='all'||g.cat===_activeCat;
    const q=_query.trim().toLowerCase();
    const queryOk=!q
      ||g.title.toLowerCase().includes(q)
      ||g.desc.toLowerCase().includes(q)
      ||(g.tags||[]).some(t=>t.toLowerCase().includes(q));
    return catOk&&queryOk;
  });
}

// ============================================================
//  描画
// ============================================================
function _renderFilters(){
  const wrap=document.getElementById('games-filters');
  if(!wrap)return;
  wrap.innerHTML='';

  // カテゴリごとの件数
  const counts={};
  Object.keys(CATEGORIES).forEach(k=>{
    counts[k]=k==='all'?GAMES.length:GAMES.filter(g=>g.cat===k).length;
  });

  Object.entries(CATEGORIES).forEach(([key,def])=>{
    if(counts[key]===0&&key!=='all')return;// 0件のカテゴリは非表示
    const btn=document.createElement('button');
    btn.className='filter-chip'+(key===_activeCat?' active':'');
    btn.innerHTML=`<span class="material-symbols-outlined">${def.icon}</span>${def.label}<span class="chip-count">${counts[key]}</span>`;
    btn.addEventListener('click',()=>{
      _activeCat=key;
      _renderFilters();
      _renderGrid();
    });
    wrap.appendChild(btn);
  });
}

function _renderGrid(){
  const grid=document.getElementById('games-grid');
  const empty=document.getElementById('games-empty');
  const countEl=document.getElementById('games-count');
  if(!grid||!empty)return;

  const list=_filtered();

  if(countEl)countEl.textContent=`${list.length}件`;

  if(!list.length){
    grid.style.display='none';
    empty.style.display='block';
    const qEl=document.getElementById('empty-query');
    if(qEl)qEl.textContent=_query||_activeCat;
    return;
  }
  empty.style.display='none';
  grid.style.display='grid';
  grid.innerHTML='';

  list.forEach((g,i)=>{
    const catDef=CATEGORIES[g.cat]||CATEGORIES.other;
    const icon=g.icon||'stadia_controller';
    const newTab=g.newTab!==false;
    const tags=(g.tags||[]).slice(0,3).map(t=>`<span class="game-card-tag">${_esc(t)}</span>`).join('');

    const a=document.createElement('a');
    a.className='game-card';
    a.href=g.url;
    a.dataset.cat=g.cat||'other';
    if(newTab){a.target='_blank';a.rel='noopener noreferrer';}
    a.style.animationDelay=`${i*30}ms`;
    a.innerHTML=`
      <div class="game-card-bar"></div>
      <div class="game-card-body">
        <div class="game-card-top">
          <div class="game-card-icon">
            <span class="material-symbols-outlined">${icon}</span>
          </div>
          <span class="game-card-badge">${_esc(catDef.label)}</span>
        </div>
        <div class="game-card-title">${_esc(g.title)}</div>
        <div class="game-card-desc">${_esc(g.desc)}</div>
        ${tags?`<div class="game-card-footer">${tags}</div>`:''}
      </div>
    `;
    grid.appendChild(a);
  });
}

function _esc(s){
  const d=document.createElement('div');
  d.textContent=s||'';
  return d.innerHTML;
}

// ============================================================
//  イベント
// ============================================================
function _initSearch(){
  const input=document.getElementById('games-search');
  if(!input)return;
  input.addEventListener('input',()=>{
    _query=input.value;
    _renderFilters();
    _renderGrid();
  });
}

// ============================================================
//  初期化
// ============================================================
_renderFilters();
_renderGrid();
_initSearch();