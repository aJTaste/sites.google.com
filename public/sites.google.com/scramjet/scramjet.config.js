self.$scramjet={
  prefix:'/sites.google.com/scramjet/service/',
  codec:typeof ScramjetCodecs!=='undefined'?ScramjetCodecs.xor:{
    encode:(str)=>encodeURIComponent(str),
    decode:(str)=>decodeURIComponent(str)
  },
  config:{
    prefix:'/sites.google.com/scramjet/service/',
    files:{
      wasm:'https://unpkg.com/@mercuryworkshop/scramjet/dist/scramjet.wasm.js',
      worker:'https://unpkg.com/@mercuryworkshop/scramjet/dist/scramjet.worker.js',
      client:'https://unpkg.com/@mercuryworkshop/scramjet/dist/scramjet.client.js',
      shared:'https://unpkg.com/@mercuryworkshop/scramjet/dist/scramjet.shared.js',
      sync:'https://unpkg.com/@mercuryworkshop/scramjet/dist/scramjet.sync.js'
    }
  }
};
