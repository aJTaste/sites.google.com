(function(){
  let loaded=false;
  let visible=false;

  function loadScript(src,cb){
    const s=document.createElement('script');
    s.src=src;
    s.onload=cb;
    s.onerror=function(){console.warn('[Eruda] failed to load:',src);};
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
      try{p.init();}catch(e){console.warn('[Eruda] plugin init failed:',e);}
      loadPlugins(list,idx+1);
    });
  }

  function hideEntryBtn(){
    const s=document.createElement('style');
    s.textContent='#eruda .eruda-entry-btn{display:none!important;}';
    document.head.appendChild(s);
  }

  function initEruda(){
    eruda.init();
    hideEntryBtn();
    eruda.hide();
    loadPlugins(plugins,0);
  }

  document.addEventListener('keydown',function(e){
    if(e.repeat)return;
    if(e.altKey&&(e.key==='i'||e.key==='I'||e.key==='\u3044')){
      e.preventDefault();
      if(!loaded){
        loadScript('https://cdn.jsdelivr.net/npm/eruda',function(){
          loaded=true;
          initEruda();
          eruda.show();
          visible=true;
        });
      } else {
        if(visible){
          eruda.hide();
          visible=false;
        } else {
          eruda.show();
          visible=true;
        }
      }
    }
  });

})();