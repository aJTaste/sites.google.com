export default {
  async fetch(req) {
    const url=new URL(req.url);
    const encoded=url.searchParams.get("url");
    if(!encoded) return new Response("url param required",{status:400});
    let target;
    try{
      target=atob(encoded);
    }catch{
      return new Response("invalid encoding",{status:400});
    }
    const targetUrl=new URL(target);
    const headers=new Headers(req.headers);
    headers.set("Host",targetUrl.hostname);
    headers.delete("Origin");
    headers.delete("Referer");
    const res=await fetch(targetUrl.toString(),{
      method:req.method,
      headers,
      body:req.method!=="GET"&&req.method!=="HEAD"?req.body:undefined,
      redirect:"follow",
    });
    const resHeaders=new Headers(res.headers);
    resHeaders.set("Access-Control-Allow-Origin","*");
    resHeaders.delete("Content-Security-Policy");
    resHeaders.delete("X-Frame-Options");
    return new Response(res.body,{
      status:res.status,
      headers:resHeaders,
    });
  }
};
