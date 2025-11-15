// 偽装モード: 検索キー(Meta/Win) + 1 で発動

let stealthMode=false;
let originalTitle='';
let originalFavicon='';
let originalContent='';

// Chromebookの検索キーはMetaKey（Windowsキーと同じ扱い）
document.addEventListener('keydown',(e)=>{
  // Meta(検索キー) + 1
  if(e.metaKey&&e.key==='1'){
    e.preventDefault();
    toggleStealthMode();
  }
});

function toggleStealthMode(){
  stealthMode=!stealthMode;
  
  if(stealthMode){
    activateStealth();
  }else{
    deactivateStealth();
  }
}

function activateStealth(){
  // タイトルとファビコンを保存
  originalTitle=document.title;
  originalFavicon=document.querySelector('link[rel="icon"]')?.href||'';
  const originalType=document.querySelector('link[rel="icon"]')?.type||'';
  
  // タイトルを変更
  document.title='まなびポケット';
  
  // ファビコンを変更（PNGの場合はtype属性も設定）
  const faviconLink=document.querySelector('link[rel="icon"]');
  if(faviconLink){
    faviconLink.href='assets/manabi.svg';
    faviconLink.type='image/png';
  }
  
  // 念のため保存
  window.originalFaviconType=originalType;
  
  // bodyの内容を保存して非表示
  originalContent=document.body.innerHTML;
  document.body.innerHTML='';
  document.body.style.background='#ffffff';
  
  // 念のため全要素を非表示
  const style=document.createElement('style');
  style.id='stealth-style';
  style.textContent='*{display:none!important;visibility:hidden!important;}body{display:block!important;visibility:visible!important;background:#fff!important;}';
  document.head.appendChild(style);
}

function deactivateStealth(){
  // タイトルとファビコンを復元
  document.title=originalTitle;
  
  const faviconLink=document.querySelector('link[rel="icon"]');
  if(faviconLink&&originalFavicon){
    faviconLink.href=originalFavicon;
    // type属性も復元
    if(window.originalFaviconType){
      faviconLink.type=window.originalFaviconType;
    }else{
      faviconLink.removeAttribute('type');
    }
  }
  
  // bodyの内容を復元
  document.body.innerHTML=originalContent;
  document.body.style.background='';
  
  // スタイルを削除
  const stealthStyle=document.getElementById('stealth-style');
  if(stealthStyle){
    stealthStyle.remove();
  }
  
  // イベントリスナーを再設定（復元後にJSが動くように）
  const scripts=document.querySelectorAll('script[type="module"]');
  scripts.forEach(script=>{
    const newScript=document.createElement('script');
    newScript.type='module';
    newScript.src=script.src;
    document.body.appendChild(newScript);
  });
}

console.log('偽装モード準備完了: Meta(検索) + 1 で発動');