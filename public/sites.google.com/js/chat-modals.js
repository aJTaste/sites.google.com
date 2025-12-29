// モーダル管理（シンプル版）

console.log('chat-modals.js読み込み成功');

document.addEventListener('DOMContentLoaded',()=>{
  console.log('モーダル初期化');
  
  // 画像拡大モーダル
  const imageModal=document.getElementById('image-modal');
  const imageModalClose=document.getElementById('image-modal-close');
  
  if(imageModalClose){
    imageModalClose.addEventListener('click',()=>{
      imageModal.classList.remove('show');
    });
  }
  
  if(imageModal){
    imageModal.addEventListener('click',(e)=>{
      if(e.target===imageModal){
        imageModal.classList.remove('show');
      }
    });
  }
});