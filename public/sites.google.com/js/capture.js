/* capture.js
  前提: capture.html で読み込まれる
  動作:
   - 今すぐ撮影（画面選択して即撮影）
   - セルフタイマー（画面選択 → カウントダウン → 撮影）
   - ギャラリー保存（localStorage）
   - タブタイトル・通知でカウントダウンを通知
*/

// ---- ユーティリティ ----
const q = sel => document.querySelector(sel);
const now = () => new Date();

function formatFilename(date, ext = "png") {
  const pad = n => String(n).padStart(2, "0");
  const YYYY = date.getFullYear();
  const MM = pad(date.getMonth() + 1);
  const DD = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `screenshot_${YYYY}${MM}${DD}-${hh}${mm}${ss}.${ext}`;
}

function formatDatetime(d) {
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ---- DOM ----
const nowBtn = q("#nowBtn");
const timerBtn = q("#timerBtn");
const delayInput = q("#delayInput");
const formatSelect = q("#formatSelect");
const notifyCheckbox = q("#notifyCheckbox");
const beepCheckbox = q("#beepCheckbox");
const countdownOverlay = q("#countdownOverlay");
const countdownBig = q("#countdownBig");
const captureVideo = q("#captureVideo");
const galleryList = q("#galleryList");
const clearGalleryBtn = q("#clearGallery");
const tabs = document.querySelectorAll(".tab");
const views = document.querySelectorAll(".view");

// ---- ギャラリー保存キー ----
const STORAGE_KEY = "apphub_capture_gallery_v1";

// ---- state ----
let gallery = []; // {dataUrl, width, height, dateIso}
let originalTitle = document.title;
let notificationPermission = Notification ? Notification.permission : "denied";

// ---- 初期化 ----
function loadGallery() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) gallery = JSON.parse(raw);
  } catch(e) {
    console.error(e);
    gallery = [];
  }
  renderGallery();
}

function saveGallery() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(gallery));
  } catch (e) {
    console.error("保存失敗", e);
  }
}

function renderGallery() {
  galleryList.innerHTML = "";
  if (gallery.length === 0) {
    galleryList.innerHTML = `<div class="hint">まだ撮影された画像はありません。</div>`;
    return;
  }
  gallery.slice().reverse().forEach((item, idx) => {
    const d = new Date(item.dateIso);
    const card = document.createElement("div");
    card.className = "gallery-card";
    card.innerHTML = `
      <img class="gallery-thumb" src="${item.dataUrl}" alt="screenshot-${idx}">
      <div class="gallery-meta">
        <div class="meta-left">
          <div class="meta-res">${item.width}×${item.height}</div>
          <div class="meta-time">${formatDatetime(d)}</div>
        </div>
        <div class="meta-actions small">クリックでダウンロード</div>
      </div>
    `;
    // クリックでダウンロード（既定は PNG）
    card.addEventListener("click", () => {
      downloadDataUrl(item.dataUrl, item.dateIso, "png");
    });
    galleryList.appendChild(card);
  });
}

// ---- ダウンロード処理 ----
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function dataURLtoBlob(dataurl) {
  const arr = dataurl.split(",");
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new Blob([u8arr], { type: mime });
}

function downloadDataUrl(dataUrl, dateIsoOrStr, ext = "png") {
  const date = new Date(dateIsoOrStr);
  const filename = formatFilename(date, ext);
  const blob = dataURLtoBlob(dataUrl);
  downloadBlob(blob, filename);
}

// ---- 音 ----
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.value = 0.05;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    setTimeout(() => { o.stop(); ctx.close(); }, 120);
  } catch (e) {
    // ignore
  }
}

// ---- 通知 ----
async function maybeRequestNotificationPerm() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    try {
      const perm = await Notification.requestPermission();
      notificationPermission = perm;
    } catch (e) {
      notificationPermission = "denied";
    }
  } else {
    notificationPermission = Notification.permission;
  }
}

function showNotification(title, body) {
  if (!("Notification" in window)) return;
  if (notificationPermission !== "granted") return;
  try {
    new Notification(title, { body, silent: true });
  } catch (e) {
    console.warn("通知エラー", e);
  }
}

// ---- キャプチャ本体 ----
async function captureFromStream(stream, mimeType = "image/png", quality = 0.92) {
  // video要素に流して canvas 抜き取り（ImageCapture があればそれを使っても可）
  return new Promise(async (resolve, reject) => {
    try {
      captureVideo.srcObject = stream;
      await captureVideo.play().catch(()=>{ /* iOS等で autoplay 制限がある場合がある */ });
      // 少し待ってフレーム確定
      await new Promise(r => setTimeout(r, 80));
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings ? track.getSettings() : {};
      // 解像度取得（fallback）
      const width = settings.width || captureVideo.videoWidth || 1280;
      const height = settings.height || captureVideo.videoHeight || 720;

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      // drawImage を使ってビデオフレームを取り込む
      ctx.drawImage(captureVideo, 0, 0, width, height);

      // toBlob（mimeType を渡す）
      canvas.toBlob(blob => {
        if (!blob) {
          reject(new Error("toBlob failed"));
          return;
        }
        // DataURL を作って返す（ギャラリー表示用）
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result;
          resolve({
            blob,
            dataUrl,
            width,
            height
          });
        };
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(blob);
      }, mimeType, quality);
    } catch (e) {
      reject(e);
    }
  });
}

async function stopStream(stream) {
  try {
    stream.getTracks().forEach(t => t.stop());
  } catch (e) { /* ignore */ }
}

// ---- 主要フロー: 画面選択して直撮影 ----
async function flowSelectAndCapture({ delaySec = 0, mimeType = "image/png", showCountdown = true }) {
  // 画面共有を選ばせる（毎回選択する仕様）
  let stream = null;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  } catch (e) {
    alert("画面共有の選択がキャンセルされました。");
    return;
  }

  // delay がある場合はカウントダウン
  if (delaySec > 0) {
    await doCountdown(delaySec, { mimeType });
    // 撮影処理は下で行う
  }

  // capture
  try {
    const { blob, dataUrl, width, height } = await captureFromStream(stream, mimeType);
    // 自動ダウンロード（ファイル名は日時ベース）
    const date = new Date();
    const ext = mimeType === "image/png" ? "png" : (mimeType === "image/webp" ? "webp" : "jpg");
    const filename = formatFilename(date, ext);
    downloadBlob(blob, filename);

    // ギャラリーに保存（データ量が心配ならサムネイル化に変更可）
    gallery.push({
      dataUrl,
      width,
      height,
      dateIso: date.toISOString()
    });
    saveGallery();
    renderGallery();

    // 通知
    if (notifyCheckbox.checked) showNotification("撮影完了", `${filename} をダウンロードしました`);
    if (beepCheckbox.checked) beep();
  } catch (e) {
    console.error("キャプチャ失敗", e);
    alert("キャプチャに失敗しました: " + (e && e.message));
  } finally {
    if (stream) stopStream(stream);
    // restore title
    document.title = originalTitle;
  }
}

// ---- カウントダウン処理（タブタイトル変更・通知） ----
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

async function doCountdown(sec, { mimeType } = {}) {
  // 通知権限要求（チェックオンなら）
  if (notifyCheckbox.checked) maybeRequestNotificationPerm();

  countdownOverlay.classList.remove("hidden");
  countdownBig.textContent = sec;
  let t = sec;

  // タイトルに秒数表示
  const baseTitle = originalTitle;
  while (t > 0) {
    countdownBig.textContent = t;
    // タブタイトル更新
    document.title = `撮影まで ${t}秒 — ${baseTitle}`;
    // 通知（最後の3秒のみ短く出すのはアリ）
    if (notifyCheckbox.checked && t <= 3) {
      showNotification("カウントダウン", `${t}秒後に撮影します`);
    }
    if (beepCheckbox.checked && t <= 3) beep();

    await sleep(1000);
    t--;
  }
  // 最終表示 "撮影中..."
  countdownBig.textContent = "撮影...";
  document.title = `撮影中… — ${baseTitle}`;
  await sleep(300);
  countdownOverlay.classList.add("hidden");
}

// ---- イベントハンドラ ----
nowBtn.addEventListener("click", async () => {
  const mime = formatSelect.value || "image/png";
  await flowSelectAndCapture({ delaySec: 0, mimeType: mime });
});

timerBtn.addEventListener("click", async () => {
  const delay = Math.max(1, parseInt(delayInput.value || "3"));
  const mime = formatSelect.value || "image/png";
  await flowSelectAndCapture({ delaySec: delay, mimeType: mime });
});

// タブ切替
tabs.forEach(t => {
  t.addEventListener("click", () => {
    tabs.forEach(x => x.classList.remove("active"));
    t.classList.add("active");
    const target = t.getAttribute("data-target");
    views.forEach(v => {
      if (v.id === target) v.classList.remove("hidden");
      else v.classList.add("hidden");
    });
  });
});

// ギャラリー消去
clearGalleryBtn.addEventListener("click", () => {
  if (!confirm("ギャラリーの全データを削除しますか？")) return;
  gallery = [];
  saveGallery();
  renderGallery();
});

// 初期化
(function init(){
  loadGallery();
  // Notification 許諾が未決なら押されたら聞く（遅延で聞く実装）
  if ("Notification" in window && Notification.permission === "default") {
    // 何もしない—ユーザーが通知を使うチェックを入れた場合に権限要求を行う
  }
})();
