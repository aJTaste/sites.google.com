// ================================
// 偽装モード設定
// ================================

// 曜日別スケジュール（24時間表記）
// day: 0=日, 1=月, ..., 6=土
const STEALTH_SCHEDULE = {
  1: { start: '08:25', end: '15:30' }, // 月
  2: { start: '08:25', end: '15:30' }, // 火
  3: { start: '08:25', end: '14:30' }, // 水
  4: { start: '08:25', end: '15:30' }, // 木
  5: { start: '08:25', end: '15:30' }  // 金
};

const STORAGE_KEY = 'stealthModeState';

// ================================
// 状態管理
// ================================

let stealthMode = false;
let originalTitle = document.title;
let originalFavicon = '';
let originalFaviconType = '';

const faviconLink = document.querySelector('link[rel="icon"]');
if (faviconLink) {
  originalFavicon = faviconLink.href;
  originalFaviconType = faviconLink.type || '';
}

// ================================
// 手動切替（Meta + 1）
// ================================

document.addEventListener('keydown', (e) => {
  if (e.metaKey && e.key === '1') {
    e.preventDefault();
    toggleStealthMode(true);
  }
});

// ================================
// 偽装モード制御
// ================================

function toggleStealthMode(isManual = false) {
  stealthMode = !stealthMode;
  applyStealthMode();
  saveState();
}

function activateStealth() {
  document.title = 'まなびポケット';

  if (faviconLink) {
    faviconLink.href = '/sites.google.com/assets/manabi.png';
    faviconLink.type = 'image/png';
  }
}

function deactivateStealth() {
  document.title = originalTitle;

  if (faviconLink && originalFavicon) {
    faviconLink.href = originalFavicon;
    if (originalFaviconType) {
      faviconLink.type = originalFaviconType;
    } else {
      faviconLink.removeAttribute('type');
    }
  }
}

function applyStealthMode() {
  if (stealthMode) {
    activateStealth();
  } else {
    deactivateStealth();
  }
}

// ================================
// 自動スケジュール判定
// ================================

function isWithinSchedule() {
  const now = new Date();
  const day = now.getDay();
  const rule = STEALTH_SCHEDULE[day];
  if (!rule) return false;

  const [sh, sm] = rule.start.split(':').map(Number);
  const [eh, em] = rule.end.split(':').map(Number);

  const start = new Date(now);
  start.setHours(sh, sm, 0, 0);

  const end = new Date(now);
  end.setHours(eh, em, 0, 0);

  return now >= start && now < end;
}

function enforceSchedule() {
  const shouldBeStealth = isWithinSchedule();
  if (stealthMode !== shouldBeStealth) {
    stealthMode = shouldBeStealth;
    applyStealthMode();
    saveState();
  }
}

// ================================
// 永続化
// ================================

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    stealthMode
  }));
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      stealthMode = JSON.parse(saved).stealthMode;
    } catch {}
  }
}

// ================================
// 初期化
// ================================

loadState();
applyStealthMode();

// 起動時にスケジュール強制判定
enforceSchedule();

// 1分ごとに自動判定（指定時間になった瞬間を確実に拾う）
setInterval(enforceSchedule, 60 * 1000);
