// チャットアプリの状態管理（Supabase版）

// 共有チャンネル定義
export const CHANNELS=[
  {id:'general',name:'連絡',desc:'報連相大事',icon:'campaign',requiredRole:'user'},
  {id:'random',name:'共用チャット',desc:'全員見れます',icon:'chat_bubble',requiredRole:'user'},
  {id:'tech',name:'to管理人',desc:'欲しいツールとかなんでも',icon:'code',requiredRole:'user'},
  {id:'moderators',name:'教育委員会対策課',desc:'モデレーターのみ',icon:'shield',requiredRole:'moderator'}
];

// グローバル状態
export const state={
  currentProfile:null,
  allProfiles:[],
  selectedUserId:null,
  selectedChannelId:null,
  isSending:false,
  unreadCounts:{},
  selectedImage:null,
  replyToMessage:null,
  editingMessageId:null,
  editingMessagePath:null,
  subscriptions:[]
};

// 状態更新関数
export function updateState(key,value){
  state[key]=value;
}

export function resetMessageState(){
  state.selectedImage=null;
  state.replyToMessage=null;
}