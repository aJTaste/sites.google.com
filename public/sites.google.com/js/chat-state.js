// チャット状態管理（Supabase版）

// チャンネル定義
export const CHANNELS=[
  {
    id:'announcements',
    name:'連絡',
    desc:'管理者からのお知らせ',
    icon:'campaign'
  },
  {
    id:'general',
    name:'共用チャット',
    desc:'全員で自由に会話',
    icon:'chat_bubble'
  },
  {
    id:'to-admin',
    name:'to管理人',
    desc:'管理者への連絡',
    icon:'mail'
  },
  {
    id:'moderators',
    name:'教育委員会対策課',
    desc:'モデレーター専用',
    icon:'shield',
    requiredRole:'moderator'
  }
];

// グローバル状態
export const state={
  currentProfile:null,
  allUsers:[],
  selectedUserId:null,
  selectedChannelId:null,
  messageSubscription:null,
  typingSubscription:null,
  profileSubscription:null,
  isSending:false,
  unreadCounts:{},
  selectedImage:null,
  replyToMessage:null,
  lastActivity:Date.now(),
  activityCheckInterval:null,
  typingTimeout:null
};

// 状態更新
export function updateState(key,value){
  state[key]=value;
}