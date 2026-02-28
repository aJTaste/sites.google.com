import https from'https';
import http from'http';

export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  if(req.method==='OPTIONS'){res.status(200).end();return;}

  const{url}=req.query;
  if(!url){res.status(400).json({error:'url required'});return;}

  let target;
  try{target=decodeURIComponent(url);}catch(e){target=url;}
  try{new URL(target);}catch(e){res.status(400).json({error:'invalid url'});return;}

  try{
    const r=await req2(target);
    const ct=r.headers['content-type']||'application/octet-stream';
    res.setHeader('Content-Type',ct);
    res.setHeader('X-Final-Url',r.finalUrl);
    res.setHeader('Cache-Control','no-store');
    if(ct.includes('text/css')){
      res.status(r.status).send(rewriteCss(r.body.toString('utf-8'),r.finalUrl));
    }else{
      res.status(r.status).send(r.body);
    }
  }catch(e){
    res.status(500).json({error:e.message});
  }
}

function req2(url,n=0){
  return new Promise((ok,ng)=>{
    if(n>5){ng(new Error('too many redirects'));return;}
    let u;
    try{u=new URL(url);}catch(e){ng(e);return;}
    const lib=u.protocol==='https:'?https:http;
    const r=lib.request({
      hostname:u.hostname,
      port:u.port||undefined,
      path:u.pathname+u.search,
      method:'GET',
      headers:{
        'User-Agent':'Mozilla/5.0',
        'Accept':'*/*',
      },
      timeout:15000
    },res=>{
      if([301,302,303,307,308].includes(res.statusCode)&&res.headers.location){
        res.resume();
        ok(req2(new URL(res.headers.location,url).href,n+1));
        return;
      }
      const chunks=[];
      res.on('data',c=>chunks.push(c));
      res.on('end',()=>ok({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks),finalUrl:url}));
      res.on('error',ng);
    });
    r.on('error',ng);
    r.on('timeout',()=>{r.destroy();ng(new Error('timeout'));});
    r.end();
  });
}

function rewriteCss(css,base){
  return css.replace(/url\(\s*(['"]?)([^'"\)\s]+)\1\s*\)/gi,(m,q,u)=>{
    if(u.startsWith('data:'))return m;
    try{return'url('+q+'/api/proxy?url='+encodeURIComponent(new URL(u,base).href)+q+')';}
    catch(e){return m;}
  });
}
