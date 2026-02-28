export default async function handler(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','*');
  if(req.method==='OPTIONS'){res.status(200).end();return;}

  const{url}=req.query;
  if(!url){res.status(400).json({error:'url required'});return;}

  let targetUrl;
  try{targetUrl=decodeURIComponent(url);}
  catch(e){targetUrl=url;}

  // URLの正規化
  try{new URL(targetUrl);}
  catch(e){res.status(400).json({error:'invalid url'});return;}

  try{
    const response=await fetch(targetUrl,{
      headers:{
        'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept':'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language':'ja,en;q=0.9',
        'Accept-Encoding':'identity',
      },
      redirect:'follow'
    });

    const ct=response.headers.get('content-type')||'application/octet-stream';
    const finalUrl=response.url||targetUrl;

    // レスポンスヘッダー設定
    res.setHeader('Content-Type',ct);
    res.setHeader('X-Final-Url',finalUrl);
    // キャッシュ無効化（フィルタリング回避）
    res.setHeader('Cache-Control','no-store');

    // CSSの場合：url()内の相対パスをproxy経由に書き換え
    if(ct.includes('text/css')){
      let css=await response.text();
      css=rewriteCss(css,finalUrl);
      res.status(response.status).send(css);
      return;
    }

    // HTMLの場合：クライアント側で処理するのでそのまま返す
    // バイナリ・その他：そのまま返す
    const buf=await response.arrayBuffer();
    res.status(response.status).send(Buffer.from(buf));

  }catch(e){
    res.status(500).json({error:e.message});
  }
}

// CSSのurl()を絶対URL化してproxy経由に書き換え
function rewriteCss(css,baseUrl){
  return css.replace(
    /url\(\s*(['"]?)([^'"\)\s]+)\1\s*\)/gi,
    (match,q,rawUrl)=>{
      // dataURIはスキップ
      if(rawUrl.startsWith('data:'))return match;
      try{
        const abs=new URL(rawUrl,baseUrl).href;
        const proxied='/api/proxy?url='+encodeURIComponent(abs);
        return'url('+q+proxied+q+')';
      }catch(e){
        return match;
      }
    }
  );
}
