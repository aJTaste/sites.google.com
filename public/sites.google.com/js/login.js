import{supabase}from'../common/supabase-config.js';

const form=document.getElementById('login-form');
const userIdInput=document.getElementById('user-id');
const passwordInput=document.getElementById('password');
const loginError=document.getElementById('login-error');
const submitBtn=document.getElementById('submit-btn');

form.addEventListener('submit',async(e)=>{
  e.preventDefault();
  
  const userId=userIdInput.value.trim();
  const password=passwordInput.value;
  
  loginError.textContent='';
  submitBtn.disabled=true;
  submitBtn.textContent='ログイン中...';
  
  try{
    // Supabase Authでログイン
    const{data,error}=await supabase.auth.signInWithPassword({
      email:`${userId}@ajtaste.jp`,
      password:password
    });
    
    if(error)throw error;
    
    // ログイン成功
    window.location.href='index.html';
    
  }catch(error){
    console.error('ログインエラー:',error);
    
    if(error.message.includes('Invalid login credentials')){
      loginError.textContent='IDまたはパスワードが間違っています';
    }else{
      loginError.textContent='ログインに失敗しました: '+error.message;
    }
    
    submitBtn.disabled=false;
    submitBtn.textContent='ログイン';
  }
});

// ページ表示
document.body.classList.remove('page-loading');
document.body.classList.add('page-loaded');
