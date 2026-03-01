(function(){
  let visible=false;
  let ready=false;
  let pendingShow=false;

  // できる限り早くCSSを注入
  const style=document.createElement('style');
  style.textContent=
    '#eruda .eruda-entry-btn{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;width:0!important;height:0!important;}'+
    '#eruda,#eruda *{transition:none!important;animation:none!important;transform-origin:unset!important;}'+
    '#eruda .eruda-dev-tools{transition:none!important;animation:none!important;}';
  (document.head||document.documentElement).appendChild(style);

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
    // DOM要素を削除
    document.querySelectorAll('#eruda .eruda-entry-btn').forEach(el=>el.remove());
    // erudaの内部オブジェクトを無効化
    try{
      const eb=eruda._entryBtn;
      if(eb){
        if(eb.$el)eb.$el.remove();
        eb.show=function(){};
        eb.hide=function(){};
        eb.toggle=function(){};
      }
    }catch(e){}
  }

  // MutationObserverでeruda DOM追加後もアイコンを即削除
  const observer=new MutationObserver(function(){
    const btn=document.querySelector('#eruda .eruda-entry-btn');
    if(btn)btn.remove();
  });

  function setupEruda(){
    if(!(window.eruda&&eruda._isInit)){
      eruda.init();
    }
    killEntryBtn();

    // show/hideをラップしてモーションをスキップ
    const _show=eruda.show.bind(eruda);
    const _hide=eruda.hide.bind(eruda);
    eruda.show=function(){
      _show();
      requestAnimationFrame(killEntryBtn);
    };
    eruda.hide=function(){
      _hide();
      requestAnimationFrame(killEntryBtn);
    };

    observer.observe(document.body,{childList:true,subtree:true});

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
