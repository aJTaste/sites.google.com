/* capture.js
 - File System Access API で保存（優先）
 - 未対応時は blob URL + フラグメント '#sites.google.com' を付与してダウンロードするフォールバック
 - ギャラリーには **保存に成功したもののみ** を追加（要求どおり）
 - カウントダウン中は Notification を出さない（撮影後のみ任意で通知）
 - 画面共有選択 UI が映り込まないように共有確定後に短い遅延を入れてから撮影
*/

(() => {
  const q = s => document.querySelector(s);
  const nowBtn = q("#nowBtn");
  const timerBtn = q("#timerBtn");
  const delayInput = q("#delayInput");
  const formatSelect = q("#formatSelect");
  const useNotification = q("#useNotification");
  const useBeep = q("#useBeep");
  const countdownOverlay = q("#countdownOverlay");
  const countdownBig = q("#countdownBig");
  const captureVideo = q("#captureVideo");
  const galleryList = q("#galleryList");
  const clearGalleryBtn = q("#clearGallery");
  const tabs = document.querySelectorAll(".tab");
  const views = document.querySelectorAll(".view");
  const originalTitle = document.title;
  const STORAGE_KEY = "apphub_capture_gallery_v1";

  let gallery = []; // 保存済みファイルのみ入る
  let notificationPermission = (("Notification" in window) ? Notification.permission : "denied");

  /* ----- util ----- */
  function pad(n){ return String(n).padStart(2,"0"); }
  function formatFilename(date, ext){
    return `screenshot_${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}.${ext}`;
  }
  function formatDatetime(d){
    return `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  /* load/save gallery (保存済みのみ) */
  function loadGallery(){ try{ const r = localStorage.getItem(STORAGE_KEY); gallery = r ? JSON.parse(r) : []; }catch(e){gallery=[];} renderGallery(); }
  function saveGallery(){ try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(gallery)); }catch(e){console.error("保存失敗",e);} }

  function renderGallery(){
    galleryList.innerHTML = "";
    if(gallery.length === 0){ galleryList.innerHTML = `<div class="hint">まだ保存された画像はありません。</div>`; return; }
    gallery.slice().reverse().forEach(item => {
      const d = new Date(item.dateIso);
      const card = document.createElement("div");
      card.className = "gallery-card";
      card.innerHTML = `
        <img class="gallery-thumb" src="${item.dataUrl}" alt="">
        <div class="gallery-meta">
          <div>
            <div class="meta-res">${item.width}×${item.height}</div>
            <div class="meta-time">${formatDatetime(d)}</div>
          </div>
          <div class="small">クリックで保存</div>
        </div>
      `;
      card.addEventListener("click", async () => {
        // 再保存（ファイル名は元日時）
        const blob = dataURLtoBlob(item.dataUrl);
        const ext = item.dataUrl.startsWith("data:image/webp") ? "webp" : (item.dataUrl.startsWith("data:image/jpeg") ? "jpg" : "png");
        const filename = formatFilename(new Date(item.dateIso), ext);
        await saveBlob(blob, filename);
      });
      galleryList.appendChild(card);
    });
  }

  function dataURLtoBlob(dataurl){
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8 = new Uint8Array(n);
    while(n--) u8[n] = bstr.charCodeAt(n);
    return new Blob([u8], { type: mime });
  }

  /* File System Access を使って保存（優先） */
  async function saveBlob(blob, filename){
    // ファイル picker が開いてユーザーが保存したら resolve (true), キャンセルなら false
    if ('showSaveFilePicker' in window) {
      try {
        const opts = {
          suggestedName: filename,
          types: [{ description: 'Image', accept: { [blob.type]: [`.${filename.split('.').pop()}`] } }]
        };
        const handle = await window.showSaveFilePicker(opts);
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return true;
      } catch (e) {
        // ユーザーキャンセルなど
        console.warn("FileSystem save failed/cancelled", e);
        return false;
      }
    } else {
      // フォールバック: blob URL に '#sites.google.com' を付ける
      try {
        const url = URL.createObjectURL(blob) + "#sites.google.com";
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        // ブラウザがDLをブロックする環境だと意味がないが、環境ではフラグメントで通る想定
        return true;
      } catch (e) {
        console.error("フォールバックダウンロード失敗", e);
        return false;
      }
    }
  }

  function downloadBlobImmediate(blob, filename){
    // 直接DL（未使用。saveBlob を使う）
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
  }

  /* beep */
  function beep(){
    try{
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine"; o.frequency.value = 880;
      g.gain.value = 0.03;
      o.connect(g); g.connect(ctx.destination);
      o.start();
      setTimeout(()=>{ o.stop(); ctx.close(); }, 120);
    }catch(e){}
  }

  /* Notification permission ラッパー（撮影後のみ使用する） */
  async function ensureNotificationPerm(){
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') { notificationPermission = 'granted'; return true; }
    if (Notification.permission === 'default') {
      try {
        const r = await Notification.requestPermission();
        return r === 'granted';
      } catch(e){ return false; }
    }
    return false;
  }
  function showNotification(title, body){
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    try { new Notification(title, { body, silent: true }); } catch(e){ console.warn(e); }
  }

  /* capture: video -> canvas -> blob */
  async function captureFromStream(stream, mimeType, quality = 0.92){
    return new Promise(async (resolve, reject) => {
      try {
        captureVideo.srcObject = stream;
        // play (some platforms restrict autoplay; user gesture has been used)
        await captureVideo.play().catch(()=>{});
        // wait a little for first frame to be ready
        await new Promise(r => setTimeout(r, 80));
        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings ? track.getSettings() : {};
        const width = settings.width || captureVideo.videoWidth || 1280;
        const height = settings.height || captureVideo.videoHeight || 720;
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(captureVideo, 0, 0, width, height);
        canvas.toBlob(blob => {
          if (!blob) return reject(new Error('toBlob failed'));
          const reader = new FileReader();
          reader.onload = () => resolve({ blob, dataUrl: reader.result, width, height });
          reader.onerror = e => reject(e);
          reader.readAsDataURL(blob);
        }, mimeType, quality);
      } catch(e) { reject(e); }
    });
  }

  async function stopStream(stream){
    try { stream.getTracks().forEach(t => t.stop()); } catch(e){}
  }

  /* カウントダウン（タブタイトルを変えて、overlay 表示） */
  function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
  async function doCountdown(sec){
    countdownOverlay.classList.remove('hidden');
    let t = sec;
    while (t > 0) {
      countdownBig.textContent = t;
      // タブタイトルに表示（要件：撮影後はすぐ元に戻す）
      document.title = `撮影まで ${t}秒 — ${originalTitle}`;
      await sleep(1000);
      t--;
    }
    countdownBig.textContent = "撮影…";
    document.title = `撮影中… — ${originalTitle}`;
    // 小さい猶予
    await sleep(300);
    countdownOverlay.classList.add('hidden');
  }

  /* main flow: select & capture (delaySec: initial timer before capture) */
  async function flowSelectAndCapture({ delaySec = 0, mimeType = 'image/png' } = {}) {
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    } catch (e) {
      alert('画面共有がキャンセルされました。');
      return;
    }

    // 少し待って「選択ダイアログが消える」時間を確保（重要）
    await sleep(350);

    if (delaySec > 0) {
      // カウントダウンはページ上のオーバーレイ + タブタイトルのみ（通知は出さない）
      await doCountdown(delaySec);
    } else {
      // 即撮影でもわずかな余裕（選択 UI の残像対策）
      await sleep(150);
    }

    try {
      const { blob, dataUrl, width, height } = await captureFromStream(stream, mimeType);
      // 保存ダイアログ（File System API 優先）
      const ext = mimeType === 'image/png' ? 'png' : (mimeType === 'image/webp' ? 'webp' : 'jpg');
      const filename = formatFilename(new Date(), ext);
      const saved = await saveBlob(blob, filename);
      // 保存成功ならギャラリーに追加（要件A）
      if (saved) {
        gallery.push({ dataUrl, width, height, dateIso: new Date().toISOString() });
        saveGallery();
        renderGallery();
      }
      // 撮影後の通知（ユーザー許可があれば）
      if (useBeep.checked) beep();
      if (useNotification.checked) {
        // permission を必要に応じて要求（ここは撮影後の通知のみ）
        await ensureNotificationPerm();
        // 表示してもスクショには映らないはず（撮影は既に終わっている）
        showNotification('撮影完了', `${filename} を保存しました`);
      }
    } catch (e) {
      console.error('キャプチャ失敗', e);
      alert('キャプチャに失敗しました: ' + (e && e.message));
    } finally {
      if (stream) stopStream(stream);
      // 必ずすぐにタイトルを戻す（要件）
      document.title = originalTitle;
    }
  }

  /* ----- イベント ----- */
  nowBtn.addEventListener('click', async () => {
    const mime = formatSelect.value || 'image/png';
    await flowSelectAndCapture({ delaySec: 0, mimeType: mime });
  });

  timerBtn.addEventListener('click', async () => {
    const delay = Math.max(1, parseInt(delayInput.value || '3'));
    const mime = formatSelect.value || 'image/png';
    await flowSelectAndCapture({ delaySec: delay, mimeType: mime });
  });

  clearGalleryBtn.addEventListener('click', () => {
    if (!confirm('ギャラリーを削除しますか？')) return;
    gallery = [];
    saveGallery();
    renderGallery();
  });

  // タブ切替
  tabs.forEach(t => {
    t.addEventListener('click', () => {
      tabs.forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      const target = t.getAttribute('data-target');
      views.forEach(v => {
        if (v.id === target) v.classList.remove('hidden'); else v.classList.add('hidden');
      });
    });
  });

  /* 初期化 */
  function init(){
    loadGallery();
    // 余計なスクロールを防ぐ（AppHub と一貫）
    document.documentElement.style.height = '100%';
    document.body.style.height = '100%';
    document.body.style.overflow = 'hidden';
  }
  init();
})();
