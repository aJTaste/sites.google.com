export const config={runtime:'edge'};

export default async function handler(req){
  const origin=req.headers.get('origin')||'*';
  const corsHeaders={
    'Access-Control-Allow-Origin':origin,
    'Access-Control-Allow-Methods':'GET,OPTIONS',
    'Access-Control-Allow-Headers':'*',
  };

  if(req.method==='OPTIONS'){
    return new Response(null,{status:204,headers:corsHeaders});
  }

  const{searchParams}=new URL(req.url);
  const url=searchParams.get('url');
  if(!url){
    return new Response(JSON.stringify({error:'url required'}),{
      status:400,headers:{...corsHeaders,'Content-Type':'application/json'}
    });
  }

  let target;
  try{target=decodeURIComponent(url);}catch{target=url;}
  try{new URL(target);}catch{
    return new Response(JSON.stringify({error:'invalid url'}),{
      status:400,headers:{...corsHeaders,'Content-Type':'application/json'}
    });
  }

  try{
    const res=await fetch(target,{
      method:'GET',
      headers:{
        'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language':'ja,en;q=0.9',
        'Accept-Encoding':'gzip, deflate, br',
        'Cache-Control':'no-cache',
        'Pragma':'no-cache',
      },
      redirect:'follow',
    });

    const ct=res.headers.get('content-type')||'application/octet-stream';
    const finalUrl=res.url||target;

    const resHeaders={
      ...corsHeaders,
      'Content-Type':ct,
      'X-Final-Url':finalUrl,
      'Cache-Control':'no-store',
    };

    if(ct.includes('text/css')){
      const text=await res.text();
      const rewritten=rewriteCss(text,finalUrl);
      return new Response(rewritten,{status:res.status,headers:resHeaders});
    }

    const body=await res.arrayBuffer();
    return new Response(body,{status:res.status,headers:resHeaders});

  }catch(e){
    const detail=e?.cause?.message||e?.message||'unknown';
    return new Response(JSON.stringify({error:'fetch failed',detail}),{
      status:500,headers:{...corsHeaders,'Content-Type':'application/json'}
    });
  }
}

function rewriteCss(css,base){
  return css.replace(/url\(\s*(['"]?)([^'"\)\s]+)\1\s*\)/gi,(m,q,u)=>{
    if(u.startsWith('data:'))return m;
    try{
      const abs=new URL(u,base).href;
      return'url('+q+'/api/proxy?url='+encodeURIComponent(abs)+q+')';
    }catch{return m;}
  });
}
