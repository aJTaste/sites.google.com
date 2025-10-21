// TODO: 明日一緒に実装する

import{auth,database}from'../common/firebase-config.js';
import{checkAuth,logout}from'../common/common.js';
import{ref,get}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// ログイン状態チェック
checkAuth(auth).then((user)=>{
  // TODO: ユーザー情報を取得して表示
});

// DOM要素取得
const userBtn=document.getElementById('user-btn');
const userDropdown=document.getElementById('user-dropdown');
const logoutBtn=document.getElementById('logout-btn');
const navItems=document.querySelectorAll('.nav-item');

// ユーザーメニュー開閉
userBtn.addEventListener('click',()=>{
  // TODO: ドロップダウン表示切り替え
});

// ログアウト
logoutBtn.addEventListener('click',()=>{
  // TODO: ログアウト処理
});

// ナビゲーション
navItems.forEach((item)=>{
  item.addEventListener('click',(e)=>{
    e.preventDefault();
    // TODO: アプリ切り替え処理
  });
});
