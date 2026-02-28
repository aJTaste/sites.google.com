export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  if(req.method==='OPTIONS'){res.status(200).end();return;}

  const{url}=req.query;
  if(!url){res.status(400).json({error:'url required'});return;}

  let targetUrl;
  try{targetUrl=decodeURIComponent(url);}
  catch(e){targetUrl=url;}

  try{
    const response=await fetch(targetUrl,{
      headers:{
        'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language':'ja,en;q=0.9',
      },
      redirect:'follow'
    });

    const ct=response.headers.get('content-type')||'text/html';
    res.setHeader('Content-Type',ct);
    res.setHeader('X-Final-Url',response.url||targetUrl);
    res.status(response.status);

    const buf=await response.arrayBuffer();
    res.send(Buffer.from(buf));
  }catch(e){
    res.status(500).json({error:e.message});
  }
}
