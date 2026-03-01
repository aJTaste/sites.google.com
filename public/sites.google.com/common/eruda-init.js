(function(){
  let visible=false;
  let ready=false;
  let pendingShow=false;

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

  function killEntryBtn(){
    const btn=document.querySelector('#eruda .eruda-entry-btn');
    if(btn)btn.style.setProperty('display','none','important');
  }

  function injectCss(){
    const s=document.createElement('style');
    s.textContent='#eruda .eruda-entry-btn{display:none!important;visibility:hidden!important;pointer-events:none!important;}';
    document.head.appendChild(s);
  }

  // eruda.show()をラップしてボタンを毎回消す
  function wrapErudaShow(){
    const _show=eruda.show.bind(eruda);
    eruda.show=function(){
      _show();
      // 描画後に消す
      requestAnimationFrame(killEntryBtn);
      setTimeout(killEntryBtn,50);
      setTimeout(killEntryBtn,150);
    };
  }

  function setupEruda(){
    if(!(window.eruda&&eruda._isInit)){
      eruda.init();
      eruda.hide();
    }
    injectCss();
    wrapErudaShow();
    killEntryBtn();
    loadPlugins(plugins,0);
    ready=true;
    if(pendingShow){
      eruda.show();
      visible=true;
      pendingShow=false;
    }
  }

  function preload(){
    injectCss();
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
      if(!ready){pendingShow=true;return;}
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