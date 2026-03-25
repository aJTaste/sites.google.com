const BASE="https://http-proxy.4hrji46478m.workers.dev/youtube.com/";

function encode(url){return btoa(unescape(encodeURIComponent(url)));}
function decode(b64){try{return decodeURIComponent(escape(atob(b64)));}catch{return null;}}

function rewriteUrl(url,base){
  try{
    const abs=new URL(url,base).href;
    if(abs.startsWith("javascript:")||abs.startsWith("data:")||abs.startsWith("blob:")) return url;
    return BASE+"?url="+encode(abs);
  }catch{return url;}
}

// Refererから元のターゲットURLを復元
function getBaseFromReferer(referer){
  try{
    const ref=new URL(referer);
    const enc=ref.searchParams.get("url");
    if(enc){
      const decoded=decode(enc);
      if(decoded) return new URL(decoded).origin;
    }
  }catch{}
  return null;
}

class UrlRewriter{
  constructor(base){this.base=base;}
  element(el){
    for(const attr of["href","src","action","poster","data","formaction"]){
      const val=el.getAttribute(attr);
      if(val&&!val.startsWith("#")&&!val.startsWith("javascript:")&&!val.startsWith("data:")){
        el.setAttribute(attr,rewriteUrl(val,this.base));
      }
    }
    if(el.getAttribute("srcset")){
      const srcset=el.getAttribute("srcset").split(",").map(s=>{
        const parts=s.trim().split(/\s+/);
        if(parts[0]) parts[0]=rewriteUrl(parts[0],this.base);
        return parts.join(" ");
      }).join(", ");
      el.setAttribute("srcset",srcset);
    }
    // integrity属性を削除（SRIブロック対策）
    if(el.getAttribute("integrity")) el.removeAttribute("integrity");
    if(el.getAttribute("crossorigin")) el.removeAttribute("crossorigin");
  }
}

// エラーページHTML
function errorPage(title,msg,target=""){
  return`<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><title>${title}</title>
<style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:white}
.box{background:#16213e;color:#eee;padding:2em;border-radius:12px;max-width:480px;width:90%;text-align:center}
h2{color:#e94560;margin-bottom:.5em}p{color:#aaa;font-size:.9em;word-break:break-all}
.url{background:#0f3460;padding:.5em 1em;border-radius:6px;font-size:.8em;margin-top:1em;color:#88b;word-break:break-all}
</style></head><body><div class="box">
<h2>⚠ ${title}</h2><p>${msg}</p>${target?`<div class="url">${target}</div>`:""}
</div></body></html>`;
}

export default{
  async fetch(req){
    const reqUrl=new URL(req.url);

    // OPTIONSプリフライト
    if(req.method==="OPTIONS"){
      return new Response(null,{status:204,headers:{
        "Access-Control-Allow-Origin":"*",
        "Access-Control-Allow-Methods":"GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "Access-Control-Allow-Headers":"*",
      }});
    }

    const encoded=reqUrl.searchParams.get("url");
    let target;

    if(!encoded){
      // --- url param missing: Refererから動的ナビゲーションを復元 ---
      const referer=req.headers.get("referer")||"";
      const originBase=getBaseFromReferer(referer);
      if(originBase){
        // パス+クエリを元のサイトのoriginに結合してリダイレクト
        const reconstructed=new URL(reqUrl.pathname+reqUrl.search,originBase).href;
        const redirectTo=BASE+"?url="+encode(reconstructed);
        return Response.redirect(redirectTo,302);
      }
      // Refererもない場合はエラーページ
      return new Response(
        errorPage("リクエストエラー","URLパラメータがありません。URLバーから直接アクセスしてください。"),
        {status:400,headers:{"Content-Type":"text/html;charset=utf-8"}}
      );
    }

    target=decode(encoded);
    if(!target){
      return new Response(
        errorPage("デコードエラー","URLのエンコードが不正です。"),
        {status:400,headers:{"Content-Type":"text/html;charset=utf-8"}}
      );
    }

    let targetUrl;
    try{targetUrl=new URL(target);}catch{
      return new Response(
        errorPage("URLエラー",`無効なURLです: ${target}`),
        {status:400,headers:{"Content-Type":"text/html;charset=utf-8"}}
      );
    }

    // リクエストヘッダーを組み立て
    const headers=new Headers();
    const skipHeaders=new Set(["host","origin","referer","cf-connecting-ip","cf-ipcountry","cf-ray","cf-visitor","x-forwarded-for","x-real-ip"]);
    for(const[k,v] of req.headers){
      if(!skipHeaders.has(k.toLowerCase())) headers.set(k,v);
    }
    headers.set("Host",targetUrl.hostname);
    headers.set("Origin",targetUrl.origin);
    headers.set("Referer",targetUrl.href);
    // ブラウザらしいUAを設定（サーバーのBot弾き対策）
    if(!headers.get("User-Agent")||headers.get("User-Agent").includes("Cloudflare")){
      headers.set("User-Agent","Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36");
    }
    headers.set("Accept","text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8");
    headers.set("Accept-Language","ja,en-US;q=0.9,en;q=0.8");
    headers.set("Sec-Fetch-Mode","navigate");
    headers.set("Sec-Fetch-Site","same-origin");
    headers.set("Sec-Fetch-Dest","document");

    let res;
    try{
      res=await fetch(target,{
        method:req.method,
        headers,
        body:req.method!=="GET"&&req.method!=="HEAD"?req.body:undefined,
        redirect:"manual", // リダイレクトを手動処理
      });
    }catch(e){
      const msg=e?.message||"unknown";
      // 接続拒否・タイムアウト等の判定
      const isRefused=msg.includes("refused")||msg.includes("ECONNREFUSED")||msg.includes("connect");
      return new Response(
        errorPage(
          isRefused?"接続が拒否されました":"フェッチエラー",
          isRefused
            ?"対象サーバーが接続を拒否しました。このサイトはプロキシに対応していない可能性があります。"
            :`エラー: ${msg}`,
          target
        ),
        {status:502,headers:{"Content-Type":"text/html;charset=utf-8","Access-Control-Allow-Origin":"*"}}
      );
    }

    const resHeaders=new Headers();
    resHeaders.set("Access-Control-Allow-Origin","*");
    resHeaders.set("Access-Control-Allow-Methods","*");
    resHeaders.set("Access-Control-Allow-Headers","*");
    resHeaders.set("Cache-Control","no-store");

    // コンテンツタイプ引き継ぎ
    const ct=res.headers.get("Content-Type")||"";
    if(ct) resHeaders.set("Content-Type",ct);

    // リダイレクト（3xx）を手動でプロキシ経由に書き換え
    if(res.status>=300&&res.status<400){
      const location=res.headers.get("Location");
      if(location){
        const abs=new URL(location,target).href;
        resHeaders.set("Location",BASE+"?url="+encode(abs));
        return new Response(null,{status:res.status,headers:resHeaders});
      }
    }

    const finalUrl=res.url||target;

    if(ct.includes("text/html")){
      // HTMLを書き換えてリンク・リソースをプロキシ経由にする
      const rewriter=new HTMLRewriter()
        .on("a,link",new UrlRewriter(finalUrl))
        .on("script[src]",new UrlRewriter(finalUrl))
        .on("img,iframe,video,audio,source",new UrlRewriter(finalUrl))
        .on("form",new UrlRewriter(finalUrl))
        .on("input[formaction]",new UrlRewriter(finalUrl))
        .on("base",{element(el){el.remove();}}) // <base>タグを除去
        .on("meta[http-equiv='refresh']",{
          element(el){
            const content=el.getAttribute("content");
            if(content){
              const m=content.match(/url=(.+)/i);
              if(m){
                const redirectUrl=new URL(m[1].trim(),finalUrl).href;
                el.setAttribute("content",content.replace(m[1],"0;url="+BASE+"?url="+encode(redirectUrl)));
              }
            }
          }
        })
        // window.location系のJS書き換えは制限があるが、インラインscriptにナビ検知を注入
        .on("head",{
          element(el){
            el.prepend(`<script>
(function(){
  const _BASE=${JSON.stringify(BASE)};
  function enc(u){return btoa(unescape(encodeURIComponent(u)));}
  function abs(u){try{return new URL(u,location.href).href;}catch{return u;}}
  // window.location書き換えをフック
  const nav=function(u){location.href=_BASE+"?url="+enc(abs(u));};
  try{
    const desc=Object.getOwnPropertyDescriptor(window,'location');
    if(desc&&desc.set){const orig=desc.set.bind(window);desc.set=function(v){nav(v);};Object.defineProperty(window,'location',desc);}
  }catch{}
  // pushState/replaceStateをフック
  ['pushState','replaceState'].forEach(m=>{
    const orig=history[m].bind(history);
    history[m]=function(state,title,url){
      if(url) url=_BASE+"?url="+enc(abs(url));
      return orig(state,title,url);
    };
  });
  // fetch/XHRのURLをプロキシ経由にフック
  const origFetch=window.fetch;
  window.fetch=function(input,init){
    if(typeof input==="string"&&!input.startsWith(_BASE)&&!input.startsWith("data:")&&!input.startsWith("blob:")){
      input=_BASE+"?url="+enc(abs(input));
    }
    return origFetch.call(this,input,init);
  };
  const origOpen=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(method,url,...rest){
    if(url&&typeof url==="string"&&!url.startsWith(_BASE)&&!url.startsWith("data:")&&!url.startsWith("blob:")){
      url=_BASE+"?url="+enc(abs(url));
    }
    return origOpen.call(this,method,url,...rest);
  };
})();
</script>`,{html:true});
          }
        });
      return rewriter.transform(new Response(res.body,{status:res.status,headers:resHeaders}));
    }

    // CSS内のURLも書き換え
    if(ct.includes("text/css")){
      const text=await res.text();
      const rewritten=text.replace(/url\(\s*(['"]?)([^'"\)\s]+)\1\s*\)/gi,(m,q,u)=>{
        if(u.startsWith("data:")) return m;
        try{return`url(${q}${BASE}?url=${encode(new URL(u,finalUrl).href)}${q})`;}catch{return m;}
      });
      return new Response(rewritten,{status:res.status,headers:resHeaders});
    }

    return new Response(res.body,{status:res.status,headers:resHeaders});
  }
};