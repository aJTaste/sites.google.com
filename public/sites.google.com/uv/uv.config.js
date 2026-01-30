// Ultraviolet Configuration

console.log('⚙️ [UV-CONFIG] 設定ファイル読み込み');

self.__uv$config={
  prefix:'/sites.google.com/uv/service/',
  bare:'/bare/',
  encodeUrl:Ultraviolet.codec.xor.encode,
  decodeUrl:Ultraviolet.codec.xor.decode,
  handler:'/sites.google.com/uv/uv.handler.js',
  client:'/sites.google.com/uv/uv.client.js',
  bundle:'/sites.google.com/uv/uv.bundle.js',
  config:'/sites.google.com/uv/uv.config.js',
  sw:'/sites.google.com/uv/uv.sw.js'
};

console.log('✅ [UV-CONFIG] 設定完了',self.__uv$config);
