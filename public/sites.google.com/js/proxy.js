const PROXY="https://http-proxy.4hrji46478m.workers.dev/youtube.com/";
const frame=document.getElementById("frame");
const inp=document.getElementById("inp");
const history=[];

function encode(url){return btoa(unescape(encodeURIComponent(url)));}
function decode(b64){try{return decodeURIComponent(escape(atob(b64)));}catch{return null;}}

function go(){
  let v=inp.value.trim();
  if(!v) return;
  if(!v.startsWith("http://")&&!v.startsWith("https://")){
    v=v.includes(".")?"https://"+v:"https://www.google.com/search?q="+encodeURIComponent(v);
  }
  navigate(v);
}

function navigate(url){
  const proxyUrl=PROXY+"?url="+encode(url);
  history.push(url);
  inp.value=url;
  frame.src=proxyUrl;
}

function goBack(){
  if(history.length<2) return;
  history.pop();
  const prev=history[history.length-1];
  inp.value=prev;
  frame.src=PROXY+"?url="+encode(prev);
}

// iframeのURL変化を検知してアドレスバーを更新
frame.addEventListener("load",()=>{
  try{
    const src=frame.src;
    const urlParam=new URL(src).searchParams.get("url");
    if(urlParam){
      const decoded=decode(urlParam);
      if(decoded) inp.value=decoded;
    }
  }catch{}
});

inp.addEventListener("keydown",e=>{if(e.key==="Enter") go();});
