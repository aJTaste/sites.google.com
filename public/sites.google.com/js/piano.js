// piano.js — 高機能ピアノ（88鍵）
// 要点:
// - 88鍵表示（縦分割）
// - JIS指定キーマップ（「ろ」キー対応）
// - 左/右矢印で octave shift（範囲内）
// - 録音 → WAV ダウンロード

(() => {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  const master = ctx.createGain(); master.gain.value = 0.28; master.connect(ctx.destination);

  // DOM
  const keyboardWrap = document.getElementById('keyboardWrap');
  const volEl = document.getElementById('volume');
  const octaveShiftEl = document.getElementById('octaveShift');
  const recBtn = document.getElementById('recBtn');
  const stopBtn = document.getElementById('stopBtn');
  const dlBtn = document.getElementById('dlBtn');

  volEl.addEventListener('input', e => master.gain.value = parseFloat(e.target.value));

  // MIDI range for 88 keys
  const FIRST = 21, LAST = 108;
  function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // Build keys data
  const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  // We'll create an array of key objects {midi, name, isSharp}
  const keyData = [];
  for(let m = FIRST; m <= LAST; m++){
    const name = NOTES[(m+3)%12]; // align so 21 -> A (we'll display name+octave)
    const octave = Math.floor(m/12) - 1;
    keyData.push({ midi: m, name, octave, isSharp: name.includes('#') });
  }

  // Layout: split into rows to avoid horizontal scroll
  const ROWS = 4;
  const perRow = Math.ceil(keyData.length / ROWS);
  const keyEls = [];

  for(let r=0;r<ROWS;r++){
    const row = document.createElement('div');
    row.className = 'row';
    const start = r*perRow, end = Math.min(start+perRow, keyData.length);
    for(let i=start;i<end;i++){
      const k = keyData[i];
      const el = document.createElement('button');
      el.className = 'key' + (k.isSharp ? ' black' : ' white');
      el.dataset.midi = k.midi;
      el.setAttribute('aria-label', `${k.name}${k.octave}`);
      el.innerHTML = `<span class="label">${k.name}${k.octave}</span>`;
      // mouse / touch
      el.addEventListener('pointerdown', e => { e.preventDefault(); noteOn(k.midi); });
      el.addEventListener('pointerup', e => { e.preventDefault(); noteOff(k.midi); });
      el.addEventListener('pointerleave', e => { e.preventDefault(); noteOff(k.midi); });
      row.appendChild(el);
      keyEls.push(el);
    }
    keyboardWrap.appendChild(row);
  }

  // Sound engine: simple piano-like tone using 2 oscillators + envelope
  const active = {}; // midi -> {o1,o2,g}
  function noteOn(midiBase){
    const midi = midiBase + shift*12;
    if(midi < FIRST || midi > LAST) return;
    if(active[midi]) return;
    const o1 = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();

    // richer tone: detuned harmonics
    o1.type = 'sine';
    o2.type = 'sawtooth';
    o1.frequency.value = midiToFreq(midi);
    o2.frequency.value = midiToFreq(midi) * 2.002; // slight detune
    g.gain.value = 0.0001;

    o1.connect(g);
    o2.connect(g);
    g.connect(master);

    const now = ctx.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.9, now + 0.02);
    // release will be ramped later

    o1.start(now);
    o2.start(now);

    active[midi] = { o1, o2, g };
    highlightKey(midi, true);
    recorderPush('on', midi);
  }
  function noteOff(midiBase){
    const midi = midiBase + shift*12;
    const s = active[midi];
    if(!s) return;
    const now = ctx.currentTime;
    s.g.gain.cancelScheduledValues(now);
    s.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    s.o1.stop(now + 0.45);
    s.o2.stop(now + 0.45);
    delete active[midi];
    highlightKey(midi, false);
    recorderPush('off', midi);
  }

  function highlightKey(midi, on){
    // find element with dataset midi = midi - shift*12 (we rendered original base midi)
    const baseMidi = midi - shift*12;
    const el = keyEls.find(k => parseInt(k.dataset.midi,10) === baseMidi);
    if(!el) return;
    if(on) el.classList.add('active'); else el.classList.remove('active');
  }

  // --- Keyboard mapping according to user spec (JIS 'ろ' included) ---
  // Mapping definition: map char -> (noteIndex, octaveBase)
  // We map to midi by: midi = 12 * octave + noteIndex  (noteIndex follows C=0..B=11)
  const noteIndexMap = {'C':0,'C#':1,'D':2,'D#':3,'E':4,'F':5,'F#':6,'G':7,'G#':8,'A':9,'A#':10,'B':11};
  function findMidiByName(note,oct){ return 12*oct + noteIndexMap[note]; }

  // convenience: build mapping per user's specification
  const keyToMidiBase = {}; // maps keyboard key (e.key) -> midi (no shift applied)
  // helper to add mapping for sequence of chars to sequence of notes at given octave (white keys)
  function addSeq(chars, notesArr, octave){
    for(let i=0;i<chars.length && i<notesArr.length;i++){
      const ch = chars[i];
      const midi = findMidiByName(notesArr[i], octave);
      keyToMidiBase[ch] = midi;
    }
  }
  // user mappings (white)
  addSeq('zxcvbnm', ['C','D','E','F','G','A','B'], 2);
  addSeq(',./ろ', ['C','D','E','F'], 3); // 'ろ' corresponds to backslash position in JIS
  addSeq('qwertyu', ['C','D','E','F','G','A','B'], 3);
  addSeq('iop@[', ['C','D','E','F','G'], 4);

  // user mappings (black)
  addSeq('sdghj', ['C#','D#','F#','G#','A#'], 2);
  addSeq('l;', ['C#','D#'], 3);
  addSeq('23567', ['C#','D#','F#','G#','A#'], 3);
  addSeq('90^', ['C#','D#','F#'], 4);

  // also map shifted characters (e.g. shift+2 => '@' etc) if needed — include common JIS shift variants
  const shiftPairs = {'2':'@','3':'#','5':'%','6':'^','7':'&','9':'(','0':')'};
  for(const d in shiftPairs){
    if(keyToMidiBase[d]) keyToMidiBase[shiftPairs[d]] = keyToMidiBase[d];
  }
  // ensure 'ろ' (hiragana) maps too
  keyToMidiBase['ろ'] = keyToMidiBase['ろ'] || keyToMidiBase['\\'] || keyToMidiBase['/'];

  // highlight mapped keys visually
  const mappedSet = new Set(Object.values(keyToMidiBase));
  keyEls.forEach(el => {
    const m = parseInt(el.dataset.midi, 10);
    if(mappedSet.has(m)) el.classList.add('mapped');
  });

  // global octave shift (user-controlled)
  let shift = 0;
  const MIN_SHIFT = -4, MAX_SHIFT = 4;
  function setShift(v){
    shift = Math.max(MIN_SHIFT, Math.min(MAX_SHIFT, v));
    octaveShiftEl.textContent = shift;
  }
  setShift(0);

  // keyboard handlers
  const downSet = new Set();
  window.addEventListener('keydown', e => {
    if(e.repeat) return;
    if(e.key === 'ArrowLeft'){ setShift(shift - 1); return; }
    if(e.key === 'ArrowRight'){ setShift(shift + 1); return; }

    const key = e.key;
    const midiBase = keyToMidiBase[key];
    if(midiBase !== undefined){
      // play
      const target = midiBase;
      if(!downSet.has(key)){
        downSet.add(key);
        noteOn(target);
      }
    }
  });
  window.addEventListener('keyup', e => {
    const key = e.key;
    const midiBase = keyToMidiBase[key];
    if(midiBase !== undefined){
      downSet.delete(key);
      noteOff(midiBase);
    }
  });

  // --- Recorder (WebAudio -> WAV) ---
  // We'll capture the mixed output via ScriptProcessor/AudioWorklet approach.
  // For compatibility, use ScriptProcessor if AudioWorklet unavailable.
  let rec = null;
  let recBuffer = [];
  let recChannels = 1;
  const sampleRate = ctx.sampleRate;

  function startRecording(){
    if(rec) return;
    // create a recorder node by connecting master to a ScriptProcessor
    const bufferSize = 4096;
    const recorderNode = ctx.createScriptProcessor(bufferSize, recChannels, recChannels);
    master.connect(recorderNode);
    recorderNode.connect(ctx.destination); // to keep audio flowing
    recorderNode.onaudioprocess = function(e){
      const input = e.inputBuffer.getChannelData(0);
      recBuffer.push(new Float32Array(input));
    };
    rec = { node: recorderNode };
    recBtn.textContent = '録音中';
    stopBtn.disabled = false;
    dlBtn.disabled = true;
  }

  function stopRecording(){
    if(!rec) return;
    rec.node.disconnect();
    master.disconnect(rec.node);
    rec = null;
    recBtn.textContent = '録音';
    stopBtn.disabled = true;
    dlBtn.disabled = false;
  }

  function clearRecording(){
    recBuffer = [];
    dlBtn.disabled = true;
  }

  function recorderPush(type, midi){
    // push event metadata — we store events separately only, but we are doing sample capture already.
    // We'll capture actual PCM from recBuffer.
  }

  function exportWAV(){
    // flatten buffer
    const length = recBuffer.reduce((s, b) => s + b.length, 0);
    const merged = new Float32Array(length);
    let offset = 0;
    for(const b of recBuffer){ merged.set(b, offset); offset += b.length; }

    // convert to 16-bit PCM
    const buffer = new ArrayBuffer(44 + merged.length * 2);
    const view = new DataView(buffer);

    // WAV header
    function writeString(view, offset, str){ for(let i=0;i<str.length;i++) view.setUint8(offset+i, str.charCodeAt(i)); }
    let pos = 0;
    writeString(view, pos, 'RIFF'); pos += 4;
    view.setUint32(pos, 36 + merged.length * 2, true); pos += 4;
    writeString(view, pos, 'WAVE'); pos += 4;
    writeString(view, pos, 'fmt '); pos += 4;
    view.setUint32(pos, 16, true); pos += 4;
    view.setUint16(pos, 1, true); pos += 2;
    view.setUint16(pos, 1, true); pos += 2;
    view.setUint32(pos, sampleRate, true); pos += 4;
    view.setUint32(pos, sampleRate * 2, true); pos += 4;
    view.setUint16(pos, 2, true); pos += 2;
    view.setUint16(pos, 16, true); pos += 2;
    writeString(view, pos, 'data'); pos += 4;
    view.setUint32(pos, merged.length * 2, true); pos += 4;

    // write PCM samples
    let idx = 0;
    for(let i=0;i<merged.length;i++, pos += 2){
      let s = Math.max(-1, Math.min(1, merged[i]));
      view.setInt16(pos, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      idx++;
    }

    const blob = new Blob([view], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    return { blob, url };
  }

  recBtn.addEventListener('click', () => {
    if(!rec) { clearRecording(); startRecording(); } else { stopRecording(); }
  });
  stopBtn.addEventListener('click', () => {
    if(rec) stopRecording();
  });
  dlBtn.addEventListener('click', () => {
    if(rec) stopRecording();
    if(recBuffer.length === 0){ alert('録音データがありません'); return; }
    const { url } = exportWAV();
    const a = document.createElement('a'); a.href = url; a.download = 'piano_recording.wav'; a.click();
    URL.revokeObjectURL(url);
  });

  // convenience: stop all on blur
  window.addEventListener('blur', () => {
    // release all active notes
    for(const m of Object.keys(active).map(x=>parseInt(x,10))) noteOff(m - shift*12);
  });

  // expose for debug
  window._piano = { keyData, keyEls, keyToMidiBase: keyToMidiBase || {}, setShift };

})();
