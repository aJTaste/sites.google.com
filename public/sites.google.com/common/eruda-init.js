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

  function disableEntryBtn(){
    // Erudaの内部_entryBtnオブジェクトのshowを完全に無効化
    try{
      const eb=eruda._entryBtn;
      if(eb){
        if(eb.$el){
          eb.$el.remove();
        }
        // show/hideを空関数で上書き
        eb.show=function(){};
        eb.hide=function(){};
      }
    }catch(e){}
    // DOM上に残ったボタンも削除
    const btn=document.querySelector('#eruda .eruda-entry-btn');
    if(btn)btn.remove();
  }

  // eruda.show/hideをラップして毎回ボタン無効化
  function wrapEruda(){
    const _show=eruda.show.bind(eruda);
    const _hide=eruda.hide.bind(eruda);
    eruda.show=function(){
      _show();
      disableEntryBtn();
    };
    eruda.hide=function(){
      _hide();
      disableEntryBtn();
    };
  }

  function setupEruda(){
    if(!(window.eruda&&eruda._isInit)){
      eruda.init();
    }
    disableEntryBtn();
    wrapEruda();
    eruda.hide();
    loadPlugins(plugins,0);
    ready=true;
    if(pendingShow){
      eruda.show();
      visible=true;
      pendingShow=false;
    }
  }

  function preload(){
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