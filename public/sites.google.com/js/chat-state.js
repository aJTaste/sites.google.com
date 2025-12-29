// チャットアプリの状態管理

// 共有チャンネル定義
export const CHANNELS=[
  {id:'general',name:'連絡',desc:'報連相大事',icon:'campaign',requiredRole:'user'},
  {id:'random',name:'共用チャット',desc:'全員見れます',icon:'chat_bubble',requiredRole:'user'},
  {id:'tech',name:'to管理人',desc:'欲しいツールとかなんでも',icon:'code',requiredRole:'user'},
  {id:'moderators',name:'教育委員会対策課',desc:'モデレーターのみ',icon:'shield',requiredRole:'moderator'}
];

// グローバル状態
export const state={
  currentUserId:null,
  currentProfile:null,
  allUsers:[],
  selectedUserId:null,
  selectedChannelId:null,
  messageSubscription:null,
  typingSubscription:null,
  userSubscription:null,
  pollingInterval:null,
  isSending:false,
  unreadCounts:{},
  selectedImage:null,
  replyToMessage:null,
  editingMessageId:null,
  typingTimeout:null
};

// 状態更新関数
export function updateState(key,value){
  state[key]=value;
}

export function getState(key){
  return state[key];
}

export function resetMessageState(){
  state.selectedImage=null;
  state.replyToMessage=null;
}