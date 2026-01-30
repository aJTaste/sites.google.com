// Ultraviolet Configuration

console.log('⚙️ [UV-CONFIG] 設定ファイル読み込み');

self.__uv$config={
  prefix:'/sites.google.com/uv/service/',
  bare:'/bare/',
  encodeUrl:Ultraviolet.codec.xor.encode,
  decodeUrl:Ultraviolet.codec.xor.decode,
  handler:'https://cdn.jsdelivr.net/npm/@titaniumnetwork-dev/ultraviolet@3.2.7/dist/uv.handler.js',
  client:'https://cdn.jsdelivr.net/npm/@titaniumnetwork-dev/ultraviolet@3.2.7/dist/uv.client.js',
  bundle:'https://cdn.jsdelivr.net/npm/@titaniumnetwork-dev/ultraviolet@3.2.7/dist/uv.bundle.js',
  config:'/public/sites.google.com/uv/uv.config.js',
  sw:'/public/sites.google.com/uv/uv.sw.js'
};

console.log('✅ [UV-CONFIG] 設定完了',self.__uv$config);
