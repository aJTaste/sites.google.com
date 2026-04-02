// 最終ページ記録（PWA起動時のリダイレクト用）
(()=>{
  const p=location.pathname;
  const skip=['/index.html','/login.html','/register.html','/404.html'];
  if(p.includes('/sites.google.com/')&&!skip.some(s=>p.endsWith(s))){
    localStorage.setItem('apphub_last_page',location.href);
  }
})();

if('serviceWorker' in navigator){
  window.addEventListener('load',async()=>{
    try{
      const reg=await navigator.serviceWorker.register('/sw.js',{scope:'/sites.google.com/'});

      // 新しいSWが待機状態になったら即座にスキップ→リロード
      const applyUpdate=worker=>{
        worker.postMessage('SKIP_WAITING');
      };

      if(reg.waiting){
        // すでに待機中のSWがある場合
        applyUpdate(reg.waiting);
      }

      reg.addEventListener('updatefound',()=>{
        const newWorker=reg.installing;
        newWorker.addEventListener('statechange',()=>{
          if(newWorker.state==='installed'&&navigator.serviceWorker.controller){
            // 更新バナーを表示
            _showUpdateBanner();
          }
        });
      });

      // SWが切り替わったらページをリロード（新バージョン反映）
      let refreshing=false;
      navigator.serviceWorker.addEventListener('controllerchange',()=>{
        if(!refreshing){
          refreshing=true;
          window.location.reload();
        }
      });
    }catch(e){
      console.warn('[PWA]',e);
    }
  });
}

let _prompt=null;
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();
  _prompt=e;
  if(!localStorage.getItem('pwa-dismissed')) _showBanner();
});

function _showUpdateBanner(){
  if(document.getElementById('pwa-update-banner')) return;
  const el=document.createElement('div');
  el.id='pwa-update-banner';
  el.innerHTML=
    '<div class="pwa-banner-text">'+
      '<span class="material-symbols-outlined">refresh</span>'+
      'アプリが更新されました。リロードしてください。'+
    '</div>'+
    '<div class="pwa-banner-btns">'+
      '<button id="pwa-reload">リロード</button>'+
      '<button id="pwa-update-dismiss">後で</button>'+
    '</div>';
  document.body.appendChild(el);
  document.getElementById('pwa-reload').onclick=()=>{
    window.location.reload();
  };
  document.getElementById('pwa-update-dismiss').onclick=()=>{
    el.remove();
  };
}

function _showBanner(){
  if(document.getElementById('pwa-banner')) return;
  const el=document.createElement('div');
  el.id='pwa-banner';
  el.innerHTML=
    '<div class="pwa-banner-text">'+
      '<span class="material-symbols-outlined">install_mobile</span>'+
      'ホーム画面に追加できます'+
    '</div>'+
    '<div class="pwa-banner-btns">'+
      '<button id="pwa-install">追加</button>'+
      '<button id="pwa-dismiss">✕</button>'+
    '</div>';
  document.body.appendChild(el);
  document.getElementById('pwa-install').onclick=async()=>{
    if(!_prompt) return;
    _prompt.prompt();
    await _prompt.userChoice;
    _prompt=null;
    el.remove();
  };
  document.getElementById('pwa-dismiss').onclick=()=>{
    localStorage.setItem('pwa-dismissed','1');
    el.remove();
  };
}
window.addEventListener('appinstalled',()=>{
  document.getElementById('pwa-banner')?.remove();
});
