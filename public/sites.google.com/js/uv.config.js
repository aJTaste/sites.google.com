// public/sites.google.com/js/uv.config.js（外部Bareサーバー利用版）
self.__uv$config={
  prefix:'/service/',
  bare:'https://uv.holy.how/bare/', // 外部Bareサーバー
  encodeUrl:Ultraviolet.codec.xor.encode,
  decodeUrl:Ultraviolet.codec.xor.decode,
  handler:'/sites.google.com/js/uv.handler.js',
  bundle:'/sites.google.com/js/uv.bundle.js',
  config:'/sites.google.com/js/uv.config.js',
  sw:'/sites.google.com/js/uv.sw.js'
};
