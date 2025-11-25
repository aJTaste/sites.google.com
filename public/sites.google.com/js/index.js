import{initPage}from'../common/core.js';
import{checkPermission}from'../common/permissions.js';

// ページ初期化（ユーザーデータを取得）
const userData=await initPage('index','ホーム');

// 管理者パネルへのアクセス権限がある場合、リンクを表示
if(userData&&checkPermission(userData.role,'view_admin_panel')){
  addAdminPanelLink();
}

// 管理者パネルリンクを追加
function addAdminPanelLink(){
  const sidebar=document.querySelector('.sidebar-nav');
  const adminLink=document.createElement('a');
  adminLink.href='admin.html';
  adminLink.className='nav-item';
  adminLink.title='管理者パネル';
  adminLink.innerHTML=`
    <span class="material-symbols-outlined">admin_panel_settings</span>
  `;
  sidebar.appendChild(adminLink);
}