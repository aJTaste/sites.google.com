// チャット状態管理

// チャンネル定義
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
  unreadCounts:{},
  
  // リアルタイム購読
  messagesSubscription:null,
  typingSubscription:null,
  profilesSubscription:null,
  
  // 入力中タイマー
  typingTimer:null,
  lastOnlineUpdateTimer:null,
  
  // メッセージ関連
  replyToMessage:null,
  selectedImage:null,
  isSending:false
};

// 状態更新
export function setState(key,value){
  state[key]=value;
}

export function resetMessageState(){
  state.replyToMessage=null;
  state.selectedImage=null;
  state.isSending=false;
}

// DM IDを生成（ユーザーID順でソート）
export function getDmId(userId1,userId2){
  return[userId1,userId2].sort().join('_');
}