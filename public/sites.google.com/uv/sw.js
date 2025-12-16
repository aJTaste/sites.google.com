self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // /proxy に来た通信だけ処理
  if (url.pathname === '/proxy') {
    event.respondWith(handleProxy(url));
  }
});

async function handleProxy(url) {
  const target = url.searchParams.get('url');
  if (!target) {
    return new Response('no url', { status: 400 });
  }

  const realUrl = decodeURIComponent(target);

  // ★ここが核心：SW が直接外部URLを取得
  const res = await fetch(realUrl);

  const text = await res.text();

  // まだ何も書き換えない（完成形ではない）
  return new Response(text, {
    headers: { 'Content-Type': 'text/html' }
  });
}
