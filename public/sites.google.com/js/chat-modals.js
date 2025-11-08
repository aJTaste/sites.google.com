// モーダル管理

import{database}from'../common/firebase-config.js';
import{ref,update,remove}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import{state}from'./chat-state.js';

// モーダルのセットアップ
document.addEventListener('DOMContentLoaded',()=>{
  // 画像拡大モーダル
  const imageModal=document.getElementById('image-modal');
  const imageModalClose=document.getElementById('image-modal-close');
  
  imageModalClose.addEventListener('click',()=>{
    imageModal.classList.remove('show');
  });
  
  imageModal.addEventListener('click',(e)=>{
    if(e.target===imageModal){
      imageModal.classList.remove('show');
    }
  });
  
  // 編集モーダル
  const editModal=document.getElementById('edit-modal');
  const editModalClose=document.getElementById('edit-modal-close');
  const editCancel=document.getElementById('edit-cancel');
  const editSave=document.getElementById('edit-save');
  
  editModalClose.addEventListener('click',()=>{
    editModal.classList.remove('show');
  });
  
  editCancel.addEventListener('click',()=>{
    editModal.classList.remove('show');
  });
  
  editModal.addEventListener('click',(e)=>{
    if(e.target===editModal){
      editModal.classList.remove('show');
    }
  });
  
  editSave.addEventListener('click',async()=>{
    const newText=document.getElementById('edit-textarea').value.trim();
    if(!newText){
      alert('メッセージを入力してください');
      return;
    }
    
    try{
      await update(ref(database,state.editingMessagePath),{
        text:newText,
        editedAt:Date.now()
      });
      editModal.classList.remove('show');
    }catch(error){
      console.error('編集エラー:',error);
      alert('編集に失敗しました');
    }
  });
  
  // 削除モーダル
  const deleteModal=document.getElementById('delete-modal');
  const deleteModalClose=document.getElementById('delete-modal-close');
  const deleteCancel=document.getElementById('delete-cancel');
  const deleteConfirm=document.getElementById('delete-confirm');
  
  deleteModalClose.addEventListener('click',()=>{
    deleteModal.classList.remove('show');
  });
  
  deleteCancel.addEventListener('click',()=>{
    deleteModal.classList.remove('show');
  });
  
  deleteModal.addEventListener('click',(e)=>{
    if(e.target===deleteModal){
      deleteModal.classList.remove('show');
    }
  });
  
  deleteConfirm.addEventListener('click',async()=>{
    try{
      await remove(ref(database,state.editingMessagePath));
      deleteModal.classList.remove('show');
    }catch(error){
      console.error('削除エラー:',error);
      alert('削除に失敗しました');
    }
  });
});
