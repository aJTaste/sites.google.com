// vc-state.js — VC参加者グローバル状態管理 (Phase 3)
// サイドバーのVC itemに参加者数・参加中フラグをリアルタイム反映

// { channelId: { peerId: { user_name, avatar_url, user_id } } }
export const vcParticipants={};

export function addParticipant(channelId,peerId,info){
  if(!vcParticipants[channelId])vcParticipants[channelId]={};
  vcParticipants[channelId][peerId]=info;
  updateVcSidebar();
}

export function removeParticipant(channelId,peerId){
  if(vcParticipants[channelId])delete vcParticipants[channelId][peerId];
  updateVcSidebar();
}

export function clearChannel(channelId){
  delete vcParticipants[channelId];
  updateVcSidebar();
}

export function getCount(channelId){
  return Object.keys(vcParticipants[channelId]||{}).length;
}

// サイドバーのvc-item要素を更新
export function updateVcSidebar(){
  document.querySelectorAll('.vc-item').forEach(item=>{
    const vcId=item.dataset.vcId;
    if(!vcId)return;
    const parts=vcParticipants[vcId]||{};
    const count=Object.keys(parts).length;

    // 参加者数テキスト
    let countEl=item.querySelector('.vc-item-count');
    if(!countEl){
      const info=item.querySelector('.vc-item-info');
      if(info){
        countEl=document.createElement('div');
        countEl.className='vc-item-count';
        info.appendChild(countEl);
      }
    }
    if(countEl)countEl.textContent=count>0?(count+'人参加中'):'';

    // 自分が参加中のチャンネルは joined クラスを付与
    if(window.currentVcChannelId===vcId){
      item.classList.add('joined');
    }else{
      item.classList.remove('joined');
    }
  });
}