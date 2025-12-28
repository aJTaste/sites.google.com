// Supabase操作関連
import{supabase}from'../common/supabase-config.js';

// チャンネル定義
export const CHANNELS=[
  {id:'general',name:'連絡',desc:'報連相大事',icon:'campaign',requiredRole:'user'},
  {id:'random',name:'共用チャット',desc:'全員見れます',icon:'chat_bubble',requiredRole:'user'},
  {id:'tech',name:'to管理人',desc:'欲しいツールとかなんでも',icon:'code',requiredRole:'user'},
  {id:'moderators',name:'教育委員会対策課',desc:'モデレーターのみ',icon:'shield',requiredRole:'moderator'}
];

// 全ユーザーを取得
export async function getAllUsers(){
  const{data,error}=await supabase
    .from('profiles')
    .select('*')
    .order('last_online',{ascending:false});
  
  if(error){
    console.error('ユーザー取得エラー:',error);
    return[];
  }
  
  return data||[];
}

// DMメッセージを取得
export async function getDmMessages(dmId){
  const{data,error}=await supabase
    .from('dm_messages')
    .select('*')
    .eq('dm_id',dmId)
    .order('created_at',{ascending:true});
  
  if(error){
    console.error('DM取得エラー:',error);
    return[];
  }
  
  return data||[];
}

// チャンネルメッセージを取得
export async function getChannelMessages(channelId){
  const{data,error}=await supabase
    .from('channel_messages')
    .select('*')
    .eq('channel_id',channelId)
    .order('created_at',{ascending:true});
  
  if(error){
    console.error('チャンネルメッセージ取得エラー:',error);
    return[];
  }
  
  return data||[];
}

// DMメッセージを送信
export async function sendDmMessage(dmId,senderId,text,imageUrl=null,replyTo=null){
  const messageData={
    dm_id:dmId,
    sender_id:senderId,
    text:text,
    image_url:imageUrl,
    reply_to:replyTo
  };
  
  const{data,error}=await supabase
    .from('dm_messages')
    .insert(messageData)
    .select()
    .single();
  
  if(error){
    console.error('DM送信エラー:',error);
    throw error;
  }
  
  return data;
}

// チャンネルメッセージを送信
export async function sendChannelMessage(channelId,senderId,text,imageUrl=null,replyTo=null){
  const messageData={
    channel_id:channelId,
    sender_id:senderId,
    text:text,
    image_url:imageUrl,
    reply_to:replyTo
  };
  
  const{data,error}=await supabase
    .from('channel_messages')
    .insert(messageData)
    .select()
    .single();
  
  if(error){
    console.error('チャンネルメッセージ送信エラー:',error);
    throw error;
  }
  
  return data;
}

// メッセージを編集
export async function editMessage(messageId,newText,isDm){
  const table=isDm?'dm_messages':'channel_messages';
  
  const{error}=await supabase
    .from(table)
    .update({
      text:newText,
      edited_at:new Date().toISOString()
    })
    .eq('id',messageId);
  
  if(error){
    console.error('メッセージ編集エラー:',error);
    throw error;
  }
}

// メッセージを削除
export async function deleteMessage(messageId,isDm){
  const table=isDm?'dm_messages':'channel_messages';
  
  const{error}=await supabase
    .from(table)
    .delete()
    .eq('id',messageId);
  
  if(error){
    console.error('メッセージ削除エラー:',error);
    throw error;
  }
}

// 既読状態を更新
export async function updateReadStatus(userId,targetId){
  const{error}=await supabase
    .from('read_status')
    .upsert({
      user_id:userId,
      target_id:targetId,
      last_read_at:new Date().toISOString()
    });
  
  if(error){
    console.error('既読更新エラー:',error);
  }
}

// 未読件数を取得
export async function getUnreadCounts(userId,allUsers){
  const unreadCounts={};
  
  // 既読状態を取得
  const{data:readStatuses}=await supabase
    .from('read_status')
    .select('*')
    .eq('user_id',userId);
  
  const readMap={};
  if(readStatuses){
    readStatuses.forEach(rs=>{
      readMap[rs.target_id]=new Date(rs.last_read_at).getTime();
    });
  }
  
  // DM未読件数
  for(const user of allUsers){
    if(user.id===userId)continue;
    
    const dmId=getDmId(userId,user.id);
    const{data:messages}=await supabase
      .from('dm_messages')
      .select('created_at,sender_id')
      .eq('dm_id',dmId)
      .eq('sender_id',user.id);
    
    if(messages){
      const lastRead=readMap[user.id]||0;
      const unread=messages.filter(m=>new Date(m.created_at).getTime()>lastRead).length;
      unreadCounts[user.id]=unread;
    }else{
      unreadCounts[user.id]=0;
    }
  }
  
  // チャンネル未読件数
  for(const channel of CHANNELS){
    const{data:messages}=await supabase
      .from('channel_messages')
      .select('created_at,sender_id')
      .eq('channel_id',channel.id)
      .neq('sender_id',userId);
    
    if(messages){
      const lastRead=readMap[channel.id]||0;
      const unread=messages.filter(m=>new Date(m.created_at).getTime()>lastRead).length;
      unreadCounts[channel.id]=unread;
    }else{
      unreadCounts[channel.id]=0;
    }
  }
  
  return unreadCounts;
}

// DM IDを生成
export function getDmId(userId1,userId2){
  return[userId1,userId2].sort().join('_');
}

// 画像をアップロード
export async function uploadChatImage(file,userId){
  const fileExt=file.name.split('.').pop();
  const fileName=`${userId}_${Date.now()}.${fileExt}`;
  
  const{error:uploadError}=await supabase.storage
    .from('chat-images')
    .upload(fileName,file);
  
  if(uploadError){
    console.error('画像アップロードエラー:',uploadError);
    throw uploadError;
  }
  
  const{data:urlData}=supabase.storage
    .from('chat-images')
    .getPublicUrl(fileName);
  
  return urlData.publicUrl;
}

// リアルタイム購読: DMメッセージ
export function subscribeToDmMessages(dmId,callback){
  return supabase
    .channel(`dm:${dmId}`)
    .on('postgres_changes',{
      event:'*',
      schema:'public',
      table:'dm_messages',
      filter:`dm_id=eq.${dmId}`
    },callback)
    .subscribe();
}

// リアルタイム購読: チャンネルメッセージ
export function subscribeToChannelMessages(channelId,callback){
  return supabase
    .channel(`channel:${channelId}`)
    .on('postgres_changes',{
      event:'*',
      schema:'public',
      table:'channel_messages',
      filter:`channel_id=eq.${channelId}`
    },callback)
    .subscribe();
}

// リアルタイム購読: ユーザーのオンライン状態
export function subscribeToProfiles(callback){
  return supabase
    .channel('profiles')
    .on('postgres_changes',{
      event:'UPDATE',
      schema:'public',
      table:'profiles'
    },callback)
    .subscribe();
}