import{initializeApp}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import{getAuth}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import{getDatabase}from'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

const firebaseConfig={
  apiKey:"AIzaSyDM_jJDGjN0mlV6FqBVzZTL5Qx95yaHruc",
  authDomain:"apphub-ajtaste.firebaseapp.com",
  databaseURL:"https://apphub-ajtaste-default-rtdb.firebaseio.com/",
  projectId:"apphub-ajtaste",
  storageBucket:"apphub-ajtaste.firebasestorage.app",
  messagingSenderId:"135285241813",
  appId:"1:135285241813:web:513e2aaa8f8dcd04556f5c"
};

const app=initializeApp(firebaseConfig);
const auth=getAuth(app);
const database=getDatabase(app);

export{auth,database};