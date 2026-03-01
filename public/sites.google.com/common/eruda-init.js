(function(){
  let visible=false;

  function loadScript(src,cb){
    const s=document.createElement('script');
    s.src=src;
    s.onload=cb;
    s.onerror=function(){console.warn('[Eruda] failed:',src);};
    document.head.appendChild(s);
  }

  const plugins=[
    {src:'https://cdn.jsdelivr.net/npm/eruda-code',init:()=>eruda.add(erudaCode)},
    {src:'https://cdn.jsdelivr.net/npm/eruda-monitor',init:()=>eruda.add(erudaMonitor)},
    {src:'https://cdn.jsdelivr.net/npm/eruda-timing',init:()=>eruda.add(erudaTiming)},
    {src:'https://cdn.jsdelivr.net/npm/eruda-memory',init:()=>eruda.add(erudaMemory)},
  ];

  function loadPlugins(list,idx){
    if(idx>=list.length)return;
    const p=list[idx];
    loadScript(p.src,function(){
      try{p.init();}catch(e){console.warn('[Eruda] plugin failed:',e);}
      loadPlugins(list,idx+1);
    });
  }

  // アイコンを徹底的に隠すCSS + MutationObserver
  function suppressEntryBtn(){
    const style=document.createElement('style');
    style.textContent=[
      '#eruda .eruda-entry-btn{',
      '  display:none!important;',
      '  visibility:hidden!important;',
      '  opacity:0!important;',
      '  pointer-events:none!important;',
      '}'
    ].join('');
    document.head.appendChild(style);

    const obs=new MutationObserver(function(mutations){
      mutations.forEach(function(m){
        m.addedNodes.forEach(function(node){
          if(node.nodeType!==1)return;
          // 追加されたノード自身＆子孫を検索
          const btns=[
            ...( node.matches&&node.matches('.eruda-entry-btn') ? [node] : [] ),
            ...Array.from(node.querySelectorAll('.eruda-entry-btn'))
          ];
          btns.forEach(function(btn){
            btn.style.setProperty('display','none','important');
          });
        });
      });
    });
    obs.observe(document.documentElement,{childList:true,subtree:true});
  }

  let ready=false;
  let pendingShow=false;

  function setupEruda(){
    if(window.eruda&&eruda._isInit){
      ready=true;
      if(pendingShow){eruda.show();visible=true;pendingShow=false;}
      return;
    }
    eruda.init();
    eruda.hide();
    loadPlugins(plugins,0);
    ready=true;
    if(pendingShow){eruda.show();visible=true;pendingShow=false;}
  }

  // ページ読み込み時に裏で先読み（Alt+I前に準備完了させる）
  function preload(){
    suppressEntryBtn();
    if(window.eruda){
      setupEruda();
    } else {
      loadScript('https://cdn.jsdelivr.net/npm/eruda',setupEruda);
    }
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',preload);
  } else {
    preload();
  }

  document.addEventListener('keydown',function(e){
    if(e.repeat)return;
    if(e.altKey&&(e.key==='i'||e.key==='I'||e.key==='\u3044')){
      e.preventDefault();
      if(!ready){
        // まだ読み込み中なら表示予約
        pendingShow=true;
        return;
      }
      if(visible){
        eruda.hide();
        visible=false;
      } else {
        eruda.show();
        visible=true;
      }
    }
  });

})();