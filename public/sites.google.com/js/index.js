import{initPage}from'../common/core.js';

// ページ初期化（サイドバーに管理者パネルは常時表示されるため、追加ロジック不要）
await initPage('index','ホーム');

console.log('index.js読み込み完了');