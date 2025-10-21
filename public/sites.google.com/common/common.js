// ログイン状態チェック用の関数（各ページのJSから呼び出す）
export function checkAuth(auth,redirectToLogin=true){
  return new Promise((resolve)=>{
    auth.onAuthStateChanged((user)=>{
      if(user){
        resolve(user);
      }else{
        if(redirectToLogin){
          window.location.href='login.html';
        }
        resolve(null);
      }
    });
  });
}


// ログアウト関数
export async function logout(auth){
  try{
    await auth.signOut();
    window.location.href='login.html';
  }catch(error){
    console.error('ログアウトエラー:',error);
    alert('ログアウトに失敗しました');
  }
}

// エラーメッセージ表示
export function showError(elementId,message){
  const el=document.getElementById(elementId);
  if(el){
    el.textContent=message;
  }
}

// エラーメッセージクリア
export function clearError(elementId){
  const el=document.getElementById(elementId);
  if(el){
    el.textContent='';
  }
}
