let mediaStream = null;
const startBtn = document.getElementById("startCapture");
const instantBtn = document.getElementById("instantCapBtn");
const delayBtn = document.getElementById("delayCapBtn");
const delayInput = document.getElementById("delayInput");
const countdownEl = document.getElementById("countdown");
const gallery = document.getElementById("gallery");

// 画面共有開始
startBtn.addEventListener("click", async () => {
  try {
    mediaStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: "browser"
      },
      audio: false
    });

    instantBtn.disabled = false;
    delayBtn.disabled = false;

  } catch (err) {
    alert("画面共有がキャンセルされました");
    console.error(err);
  }
});

// 撮影処理
function captureShot() {
  if (!mediaStream) return;

  const track = mediaStream.getVideoTracks()[0];
  const imageCapture = new ImageCapture(track);

  imageCapture.grabFrame().then(bitmap => {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    const imgURL = canvas.toDataURL("image/png");

    const img = document.createElement("img");
    img.src = imgURL;
    gallery.appendChild(img);
  });
}

// すぐ撮影
instantBtn.addEventListener("click", () => {
  captureShot();
});

// 遅延撮影
delayBtn.addEventListener("click", () => {
  let sec = parseInt(delayInput.value) || 3;
  countdownEl.classList.remove("hidden");

  const timer = setInterval(() => {
    countdownEl.textContent = sec;
    sec--;

    if (sec < 0) {
      clearInterval(timer);
      countdownEl.classList.add("hidden");
      captureShot();
    }
  }, 1000);
});
