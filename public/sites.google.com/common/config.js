export const NAV_ITEMS=[
  {id:'hub',icon:'hub',title:'Hub',href:'/sites.google.com/hub.html'},
  {id:'chat',icon:'chat',title:'ChatHub',href:'/sites.google.com/chat.html'},
  {id:'games',icon:'stadia_controller',title:'Games',href:'/sites.google.com/games.html'},
  {id:'proxy',icon:'vpn_key',title:'Proxy',href:'/sites.google.com/proxy.html'},
  {id:'docs',icon:'edit_note',title:'Docs',href:'/sites.google.com/docs.html'},
  {id:'images',icon:'animated_images',title:'Images',href:'/sites.google.com/images.html'},
  {id:'links',icon:'link',title:'Links',href:'/sites.google.com/links.html'},
  {id:'files',icon:'folder',title:'Files',href:'/sites.google.com/files.html'},
  {id:'piano',icon:'piano',title:'Piano',href:'/sites.google.com/piano.html'}
];

export const UPDATE_INFO={
  current:{
    version:'v1.1.2',
    date:'2026-01-19 23:29'
  },
  history:[
    {
      version:'v1.1.2',
      date:'2026-01-19 23:29',
      changes:[
        'いくつかの問題を修正しました。'
      ]
    },
    {
      version:'v1.1.1',
      date:'2026-01-18 15:00',
      changes:[
        'チャット機能のパフォーマンスを改善。',
        'ファイル共有の安定性を向上。'
      ]
    },
    {
      version:'v1.1.0',
      date:'2026-01-17 10:30',
      changes:[
        'Docs機能を追加。',
        'リアルタイム自動保存に対応。'
      ]
    }
  ]
};

export const APP_INFO={
  name:'AppHub aJTaste',
  shortName:'AppHub',
  version:UPDATE_INFO.current.version,
  description:'学生のための便利ツール集'
};