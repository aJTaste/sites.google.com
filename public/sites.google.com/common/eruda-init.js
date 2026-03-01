// ================================
// Eruda DevTools 初期化
// Alt+I で開閉
// ================================

(function(){
  // Erudaスクリプトを動的ロード
  function loadScript(src,cb){
    const s=document.createElement('script');
    s.src=src;
    s.onload=cb;
    document.head.appendChild(s);
  }

  function initEruda(){
    eruda.init();

    // プラグイン: JS実行（アドレスバーJS不可環境で超重要）
    loadScript('https://cdn.jsdelivr.net/npm/eruda-code',function(){
      eruda.add(erudaCode);
    });

    // プラグイン: FPS・メモリモニター
    loadScript('https://cdn.jsdelivr.net/npm/eruda-monitor',function(){
      eruda.add(erudaMonitor);
    });

    // プラグイン: タッチ・クリック可視化
    loadScript('https://cdn.jsdelivr.net/npm/eruda-touches',function(){
      eruda.add(erudaTouches);
    });

    // デフォルトで非表示
    eruda.hide();

    // Erudaのコンテナをbodyの直下に確実に配置
    // （z-indexがAppHubのモーダルと競合しないよう調整）
    const container=document.getElementById('eruda');
    if(container){
      container.style.zIndex='999999';
    }
  }

  // Alt+I でトグル
  let erudaLoaded=false;
  let erudaVisible=false;

  document.addEventListener('keydown',function(e){
    if(e.altKey&&(e.key==='i'||e.key==='I'||e.key==='ｉ')){
      e.preventDefault();
      if(!erudaLoaded){
        loadScript('https://cdn.jsdelivr.net/npm/eruda',function(){
          erudaLoaded=true;
          initEruda();
          eruda.show();
          erudaVisible=true;
        });
      } else {
        if(erudaVisible){
          eruda.hide();
          erudaVisible=false;
        } else {
          eruda.show();
          erudaVisible=true;
        }
      }
    }
  });

})();