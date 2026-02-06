// チャットアプリの状態管理

// ========================================
// 共有チャンネル定義
// ========================================

export const CHANNELS=[
  {
    id:'general',
    name:'連絡',
    desc:'報連相大事',
    icon:'campaign',
    requiredRole:'user'
  },
  {
    id:'random',
    name:'共用チャット',
    desc:'全員見れます',
    icon:'chat_bubble',
    requiredRole:'user'
  },
  {
    id:'tech',
    name:'to管理人',
    desc:'欲しいツールとかなんでも',
    icon:'code',
    requiredRole:'user'
  },
  {
    id:'moderators',
    name:'教育委員会対策課',
    desc:'モデレーターのみ',
    icon:'shield',
    requiredRole:'moderator'
  }
];

// ========================================
// グローバル状態
// ========================================

export const state={
  // ユーザー情報
  currentProfile:null,        // 現在ログイン中のユーザー
  allUsers:[],                // 全ユーザー一覧
  
  // 選択状態
  selectedUserId:null,        // 選択中のユーザーID（DM）
  selectedChannelId:null,     // 選択中のチャンネルID
  
  // Supabase購読
  messageSubscription:null,   // メッセージのリアルタイム購読
  typingSubscription:null,    // 入力中状態の購読
  profilesSubscription:null,  // プロフィール変更の購読
  
  // UI状態
  isSending:false,            // 送信中フラグ
  unreadCounts:{},            // 未読件数マップ {userId/channelId: count}
  lastOnlineUpdateInterval:null, // 最終ログイン時刻の定期更新タイマー
  
  // メッセージ入力状態
  selectedImage:null,         // 選択中の画像（Base64）
  replyToMessage:null,        // 返信先メッセージ {id, text, senderId}
  editingMessageId:null       // 編集中のメッセージID
};

// ========================================
// 状態更新関数
// ========================================

// 状態を更新
export function updateState(key,value){
  state[key]=value;
}

// 状態を取得
export function getState(key){
  return state[key];
}

// メッセージ関連の状態をリセット（送信後などに使用）
export function resetMessageState(){
  state.selectedImage=null;
  state.replyToMessage=null;
}