self.__uv$config={
  prefix:'/sites.google.com/service/',
  bare:'https://uv.holy.how/bare/',
  encodeUrl:url=>{
    if(typeof Ultraviolet==='undefined'){
      return btoa(url);
    }
    return Ultraviolet.codec.xor.encode(url);
  },
  decodeUrl:encoded=>{
    if(typeof Ultraviolet==='undefined'){
      return atob(encoded);
    }
    return Ultraviolet.codec.xor.decode(encoded);
  },
  handler:'/sites.google.com/uv.handler.js',
  bundle:'/sites.google.com/uv.bundle.js',
  config:'/sites.google.com/uv.config.js',
  sw:'/sites.google.com/uv.sw.js'
};
