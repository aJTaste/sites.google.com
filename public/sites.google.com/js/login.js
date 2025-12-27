import{supabase}from'../common/supabase-config.js';

const form=document.getElementById('login-form');
const accountIdInput=document.getElementById('account-id');
const passwordInput=document.getElementById('password');
const loginError=document.getElementById('login-error');

form.addEventListener('submit',async(e)=>{
  e.preventDefault();
  
  const accountId=accountIdInput.value.trim();
  const password=passwordInput.value;
  
  // メールアドレス形式に変換
  const email=`${accountId}@apphub.local`;
  
  try{
    const{data,error}=await supabase.auth.signInWithPassword({
      email:email,
      password:password
    });
    
    if(error)throw error;
    
    // オンライン状態を更新
    await supabase
      .from('profiles')
      .update({
        is_online:true,
        last_online:new Date().toISOString()
      })
      .eq('id',data.user.id);
    
    window.location.href='index.html';
  }catch(error){
    console.error(error);
    loginError.textContent='アカウントIDまたはパスワードが間違っています';
  }
});

// ローディング完了
document.body.classList.remove('page-loading');
document.body.classList.add('page-loaded');
