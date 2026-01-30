// ://sites.google.com

self.__uv$config = {
  prefix: '/://sites.google.com',
  // SW側と同じBare Serverを指定
  bare: 'https://uv.student-portal.workers.dev',
  encodeUrl: Ultraviolet.codec.xor.encode,
  decodeUrl: Ultraviolet.codec.xor.decode,
  handler: 'https://cdn.jsdelivr.net',
  client: 'https://cdn.jsdelivr.net',
  bundle: 'https://cdn.jsdelivr.net',
  config: '/://sites.google.com',
  sw: '/://sites.google.com'
};
