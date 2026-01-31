// Ultraviolet Configuration - 簡素化版

self.__uv$config={
  prefix:'/uv/service/',
  bare:'/bare/',
  encodeUrl:Ultraviolet.codec.xor.encode,
  decodeUrl:Ultraviolet.codec.xor.decode,
  handler:'/uv/uv.handler.js',
  client:'/uv/uv.client.js',
  bundle:'/uv/uv.bundle.js',
  config:'/uv/uv.config.js',
  sw:'/uv/uv.sw.js'
};

console.log('✅ UV設定完了',self.__uv$config);
