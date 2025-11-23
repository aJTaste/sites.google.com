/* Web Piano — 88 keys / Keyboard + Click */

const AudioCtx = window.AudioContext || window.webkitAudioContext;
const ctx = new AudioCtx();

let masterGain = ctx.createGain();
masterGain.gain.value = 0.3;
masterGain.connect(ctx.destination);

document.getElementById("volume").addEventListener("input", e => {
  masterGain.gain.value = parseFloat(e.target.value);
});

const keyboardEl = document.getElementById("keyboard");

// A0 (21) ~ C8 (108)
const WHITE_NUMBERS = [0, 2, 4, 5, 7, 9, 11];
function isWhite(i) {
  return WHITE_NUMBERS.includes(i % 12);
}

let active = {};
let shift = 0;
const shiftEl = document.getElementById("octShift");

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Keyboard mapping (JIS対応版)
const keyMap = {
  // 2オクターブ目
  "z": { idx: 0,  oct: 2 }, "s": { idx: 1,  oct: 2 },
  "x": { idx: 2,  oct: 2 }, "d": { idx: 3,  oct: 2 },
  "c": { idx: 4,  oct: 2 },
  "v": { idx: 5,  oct: 2 }, "g": { idx: 6,  oct: 2 },
  "b": { idx: 7,  oct: 2 }, "h": { idx: 8,  oct: 2 },
  "n": { idx: 9,  oct: 2 }, "j": { idx:10, oct: 2 },
  "m": { idx:11, oct: 2 },

  // 3オクターブ目
  ",": { idx: 0,  oct: 3 }, ".": { idx: 1,  oct: 3 },
  "/": { idx: 2,  oct: 3 }, "q": { idx: 0,  oct: 3 },
  "w": { idx: 2,  oct: 3 }, "e": { idx: 4,  oct: 3 },
  "r": { idx: 5,  oct: 3 }, "t": { idx: 7,  oct: 3 },
  "y": { idx: 9,  oct: 3 }, "u": { idx:10, oct: 3 },

  // 黒鍵（3〜4）
  "2": { idx: 1,  oct: 3 }, "3": { idx: 3,  oct: 3 },
  "5": { idx: 6,  oct: 3 }, "6": { idx: 8,  oct: 3 },
  "7": { idx:10, oct: 3 },

  "i": { idx: 0,  oct: 4 }, "o": { idx: 2,  oct: 4 },
  "p": { idx: 4,  oct: 4 }, "@": { idx: 5,  oct: 4 }, // JIS @
  "[": { idx: 7,  oct: 4 },

  "0": { idx: 1,  oct: 4 }, "9": { idx: 3,  oct: 4 },
  "^": { idx: 6,  oct: 4 }, // JIS ^
  "\\": { idx: 8, oct: 4 }, "ろ": { idx: 8, oct: 4 } // ろ対応
};

// 88鍵 UI 生成
for (let midi = 21; midi <= 108; midi++) {
  const div = document.createElement("div");
  div.className = "key " + (isWhite(midi) ? "white" : "black");
  div.dataset.midi = midi;
  keyboardEl.appendChild(div);

  div.addEventListener("mousedown", () => play(midi));
  div.addEventListener("mouseup", () => stop(midi));
  div.addEventListener("mouseleave", () => stop(midi));
}

function play(midi) {
  midi += shift * 12;
  if (!active[midi]) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = midiToFreq(midi);
    o.connect(g);
    g.connect(masterGain);
    o.start();
    active[midi] = { o, g };
  }
  const el = document.querySelector(`.key[data-midi="${midi - shift * 12}"]`);
  if (el) el.classList.add("active");
}

function stop(midi) {
  midi += shift * 12;
  const s = active[midi];
  if (s) {
    s.o.stop(ctx.currentTime + 0.03);
    delete active[midi];
  }
  const el = document.querySelector(`.key[data-midi="${midi - shift * 12}"]`);
  if (el) el.classList.remove("active");
}

// Keyboard event
window.addEventListener("keydown", e => {
  if (e.repeat) return;
  if (e.key === "ArrowRight") {
    if (shift < 3) shift++;
    shiftEl.textContent = shift;
    return;
  }
  if (e.key === "ArrowLeft") {
    if (shift > -3) shift--;
    shiftEl.textContent = shift;
    return;
  }

  const k = keyMap[e.key];
  if (k) play(12 * k.oct + k.idx);
});

window.addEventListener("keyup", e => {
  const k = keyMap[e.key];
  if (k) stop(12 * k.oct + k.idx);
});
