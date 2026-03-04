// vc-chat.js — ボイスチャンネル内チャット (Phase 4 v1.0.1)
import{supabase}from'../common/supabase-config.js';
import{state}from'./chat-state.js';
import{escapeHtml,formatMessageTime}from'./chat-utils.js';

let _channelId=null;
let _sub=null;

// ==========================================
// 初期化・クリーンアップ
// ==========================================
export function initVcChat(channelId){
  if(_sub){try{supabase.removeChannel(_sub);}catch(e){}  _sub=null;}
  _channelId=channelId;
  loadVcMessages(channelId);
  _sub=supabase
    .channel('vc-chat-'+channelId)
    .on('postgres_changes',{
      event:'INSERT',schema:'public',
      table:'voice_messages',
      filter:'channel_id=eq.'+channelId
    },(payload)=>{
      if(payload.new&&_channelId===channelId){
        _appendMessage(payload.new,true);
      }
    })
    .subscribe();
}

export function cleanupVcChat(){
  if(_sub){try{supabase.removeChannel(_sub);}catch(e){}  _sub=null;}
  _channelId=null;
}

// ==========================================
// メッセージ読み込み
// ==========================================
export async function loadVcMessages(channelId){
  const{data,error}=await supabase
    .from('voice_messages')
    .select('*')
    .eq('channel_id',channelId)
    .order('created_at',{ascending:true})
    .limit(50);
  if(error){console.error('[vcChat] load:',error);return;}
  const area=document.getElementById('vc-chat-messages');
  if(!area)return;
  area.innerHTML='';
  (data||[]).forEach(msg=>_appendMessage(msg,false));
  area.scrollTop=area.scrollHeight;
}

// ==========================================
// メッセージ送信
// ==========================================
export async function sendVcMessage(channelId,text){
  if(!text.trim()||!state.currentProfile?.id)return;
  const{error}=await supabase.from('voice_messages').insert({
    channel_id:channelId,
    user_id:state.currentProfile.id,
    text:text.trim()
  });
  if(error)console.error('[vcChat] send:',error);
}

// ==========================================
// メッセージ描画（内部）
// ==========================================
function _appendMessage(msg,scroll){
  const area=document.getElementById('vc-chat-messages');
  if(!area)return;
  const isMe=msg.user_id===state.currentProfile?.id;
  const name=isMe
    ?(state.currentProfile.display_name||'自分')
    :_getSenderName(msg.user_id);
  const el=document.createElement('div');
  el.className='vc-chat-msg'+(isMe?' vc-chat-msg-me':'');
  el.innerHTML='<span class="vc-chat-author">'+escapeHtml(name||'')+'</span>'
    +'<span class="vc-chat-text">'+escapeHtml(msg.text||'')+'</span>'
    +'<span class="vc-chat-time">'+formatMessageTime(msg.created_at)+'</span>';
  area.appendChild(el);
  if(scroll)area.scrollTop=area.scrollHeight;
}

function _getSenderName(userId){
  // [fix③] window._appState ではなく state.allUsers を使う
  const users=state.allUsers||[];
  const u=users.find(u=>u.id===userId||u.user_id===userId);
  return u?.display_name||'不明';
}