// モーダル管理（Supabase版）

// 画像拡大モーダル
document.addEventListener('DOMContentLoaded',()=>{
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