// チャットアプリの状態管理
import{supabase}from'../common/supabase-config.js';

export const DEFAULT_COMMUNITY_ID='00000000-0000-0000-0000-000000000001';

// チャンネル一覧をDBから取得
export async function fetchChannels(communityId=DEFAULT_COMMUNITY_ID){
  const{data,error}=await supabase
    .from('channels')
    .select('id,name,description,icon,required_role')
    .eq('community_id',communityId)
    .order('created_at');
  if(error){console.error('[fetchChannels]',error);return[];}
  // 旧コードとの互換性のため desc / requiredRole も付与
  return(data||[]).map(ch=>({
    ...ch,
    desc:ch.description||'',
    requiredRole:ch.required_role
  }));
}

export async function fetchUserCommunities(userId){
  const{data,error}=await supabase
    .from('community_members')
    .select('community_id,role,communities(id,name)')
    .eq('user_id',userId);
  if(error){console.error('[fetchUserCommunities]',error);return[];}
  return(data||[]).map(m=>({
    id:m.community_id,
    role:m.role,
    name:m.communities?.name||'界隈'
  }));
}

// グローバル状態
export const state={
  currentProfile:null,
  allUsers:[],
  channels:[],           // ← NEW: DBから取得したチャンネル一覧
  communities:[],
  currentCommunityId:DEFAULT_COMMUNITY_ID,
  selectedUserId:null,
  selectedChannelId:null,
  messageSubscription:null,
  typingSubscription:null,
  profilesSubscription:null,
  isSending:false,
  unreadCounts:{},
  lastOnlineUpdateInterval:null,
  onlineHeartbeatInterval:null,
  selectedImage:null,
  replyToMessage:null,
  editingMessageId:null
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