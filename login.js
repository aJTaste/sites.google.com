import{auth}from'../common/firebase-config.js';
import{signInWithEmailAndPassword}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

const form=document.getElementById('login-form');
const accountIdInput=document.getElementById('account-id');
const passwordInput=document.getElementById('password');
const loginError=document.getElementById('login-error');

form.addEventListener('submit',async(e)=>{
  e.preventDefault();
  
  const accountId=accountIdInput.value.trim();
  const password=passwordInput.value;
  const email=`${accountId}@ajtaste.jp`;
  
  try{
    await signInWithEmailAndPassword(auth,email,password);
    window.location.href='index.html';
  }catch(error){
    console.error(error);
    loginError.textContent='アカウントIDまたはパスワードが間違っています';
  }
});