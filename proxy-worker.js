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

class UrlRewriter{
  constructor(base){this.base=base;}
  element(el){
    for(const attr of["href","src","action","poster","data"]){
      const val=el.getAttribute(attr);
      if(val&&!val.startsWith("#")&&!val.startsWith("javascript:")){
        el.setAttribute(attr,rewriteUrl(val,this.base));
      }
    }
    if(el.getAttribute("srcset")){
      const srcset=el.getAttribute("srcset").split(",").map(s=>{
        const parts=s.trim().split(/\s+/);
        parts[0]=rewriteUrl(parts[0],this.base);
        return parts.join(" ");
      }).join(", ");
      el.setAttribute("srcset",srcset);
    }
  }
}

export default{
  async fetch(req){
    const url=new URL(req.url);
    const encoded=url.searchParams.get("url");
    if(!encoded) return new Response("url param required",{status:400});
    const target=decode(encoded);
    if(!target) return new Response("invalid encoding",{status:400});
    const targetUrl=new URL(target);
    const headers=new Headers();
    for(const[k,v] of req.headers){
      if(!["host","origin","referer"].includes(k.toLowerCase())) headers.set(k,v);
    }
    headers.set("Host",targetUrl.hostname);
    let res;
    try{
      res=await fetch(target,{
        method:req.method,
        headers,
        body:req.method!=="GET"&&req.method!=="HEAD"?req.body:undefined,
        redirect:"follow",
      });
    }catch(e){
      return new Response("Fetch error: "+e.message,{status:502});
    }
    const resHeaders=new Headers(res.headers);
    resHeaders.set("Access-Control-Allow-Origin","*");
    resHeaders.delete("Content-Security-Policy");
    resHeaders.delete("X-Frame-Options");
    resHeaders.delete("X-Content-Type-Options");
    const ct=res.headers.get("Content-Type")||"";
    if(ct.includes("text/html")){
      const rewriter=new HTMLRewriter()
        .on("a,link",new UrlRewriter(target))
        .on("script",new UrlRewriter(target))
        .on("img,iframe,video,audio,source",new UrlRewriter(target))
        .on("form",new UrlRewriter(target))
        .on("meta[http-equiv='refresh']",{
          element(el){
            const content=el.getAttribute("content");
            if(content){
              const m=content.match(/url=(.+)/i);
              if(m) el.setAttribute("content",content.replace(m[1],rewriteUrl(m[1],target)));
            }
          }
        });
      return rewriter.transform(new Response(res.body,{status:res.status,headers:resHeaders}));
    }
    return new Response(res.body,{status:res.status,headers:resHeaders});
  }
};
