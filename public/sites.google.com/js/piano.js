import{initPage}from'../common/core.js';

// ページ初期化
await initPage('piano','ピアノ');

// ========================================
// ピアノ機能
// ========================================

const AudioContext=window.AudioContext||window.webkitAudioContext;
const audioContext=new AudioContext();
const masterGain=audioContext.createGain();
masterGain.gain.value=0.5;
masterGain.connect(audioContext.destination);

// 音階定義
const notes={
  'C':261.63,
  'C#':277.18,
  'D':293.66,
  'D#':311.13,
  'E':329.63,
  'F':349.23,
  'F#':369.99,
  'G':392.00,
  'G#':415.30,
  'A':440.00,
  'A#':466.16,
  'B':493.88
};

const noteOrder=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

// キーボードマッピング
const keyMap={
  'a':'C',
  'w':'C#',
  's':'D',
  'e':'D#',
  'd':'E',
  'f':'F',
  't':'F#',
  'g':'G',
  'y':'G#',
  'h':'A',
  'u':'A#',
  'j':'B',
  'k':'C',
  'o':'C#',
  'l':'D'
};

let currentOctave=4;
let isRecording=false;
let recordedNotes=[];
let recordStartTime=0;
let activeOscillators={};

// キーボード生成
function generateKeyboard(){
  const keyboard=document.getElementById('keyboard');
  keyboard.innerHTML='';
  
  // 2オクターブ分を表示
  for(let octave=currentOctave-1;octave<=currentOctave+1;octave++){
    noteOrder.forEach((note,index)=>{
      const isBlack=note.includes('#');
      const key=document.createElement('div');
      key.className=`key ${isBlack?'black':'white'}`;
      key.dataset.note=note;
      key.dataset.octave=octave;
      
      // キーボードマッピングのラベル
      let label='';
      if(octave===currentOctave){
        for(const[k,n]of Object.entries(keyMap)){
          if(n===note){
            label=k.toUpperCase();
            break;
          }
        }
      }
      
      if(label){
        const labelEl=document.createElement('span');
        labelEl.className='key-label';
        labelEl.textContent=label;
        key.appendChild(labelEl);
      }
      
      key.addEventListener('mousedown',()=>playNote(note,octave));
      key.addEventListener('mouseup',()=>stopNote(note,octave));
      key.addEventListener('mouseleave',()=>stopNote(note,octave));
      
      key.addEventListener('touchstart',(e)=>{
        e.preventDefault();
        playNote(note,octave);
      });
      key.addEventListener('touchend',(e)=>{
        e.preventDefault();
        stopNote(note,octave);
      });
      
      keyboard.appendChild(key);
    });
  }
}

// 音を鳴らす
function playNote(note,octave){
  const noteKey=`${note}-${octave}`;
  if(activeOscillators[noteKey])return;
  
  const oscillator=audioContext.createOscillator();
  const gainNode=audioContext.createGain();
  
  const frequency=notes[note]*Math.pow(2,octave-4);
  oscillator.frequency.value=frequency;
  oscillator.type='sine';
  
  gainNode.gain.setValueAtTime(0,audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.3,audioContext.currentTime+0.01);
  
  oscillator.connect(gainNode);
  gainNode.connect(masterGain);
  
  oscillator.start();
  activeOscillators[noteKey]={oscillator,gainNode};
  
  const keyEl=document.querySelector(`.key[data-note="${note}"][data-octave="${octave}"]`);
  if(keyEl)keyEl.classList.add('active');
  
  if(isRecording){
    recordedNotes.push({
      note:note,
      octave:octave,
      time:Date.now()-recordStartTime,
      type:'start'
    });
  }
}

// 音を止める
function stopNote(note,octave){
  const noteKey=`${note}-${octave}`;
  const osc=activeOscillators[noteKey];
  if(!osc)return;
  
  const currentTime=audioContext.currentTime;
  osc.gainNode.gain.cancelScheduledValues(currentTime);
  osc.gainNode.gain.setValueAtTime(osc.gainNode.gain.value,currentTime);
  osc.gainNode.gain.linearRampToValueAtTime(0,currentTime+0.1);
  
  setTimeout(()=>{
    osc.oscillator.stop();
    delete activeOscillators[noteKey];
  },100);
  
  const keyEl=document.querySelector(`.key[data-note="${note}"][data-octave="${octave}"]`);
  if(keyEl)keyEl.classList.remove('active');
  
  if(isRecording){
    recordedNotes.push({
      note:note,
      octave:octave,
      time:Date.now()-recordStartTime,
      type:'stop'
    });
  }
}

// キーボードイベント
const pressedKeys=new Set();

document.addEventListener('keydown',(e)=>{
  if(e.repeat)return;
  
  const key=e.key.toLowerCase();
  
  if(key==='z'){
    changeOctave(-1);
    return;
  }
  if(key==='x'){
    changeOctave(1);
    return;
  }
  
  if(keyMap[key]&&!pressedKeys.has(key)){
    pressedKeys.add(key);
    playNote(keyMap[key],currentOctave);
  }
});

document.addEventListener('keyup',(e)=>{
  const key=e.key.toLowerCase();
  if(keyMap[key]){
    pressedKeys.delete(key);
    stopNote(keyMap[key],currentOctave);
  }
});

// オクターブ変更
function changeOctave(delta){
  const newOctave=currentOctave+delta;
  if(newOctave<1||newOctave>7)return;
  currentOctave=newOctave;
  document.getElementById('octave-display').textContent=currentOctave;
  generateKeyboard();
}

document.getElementById('octave-down').addEventListener('click',()=>changeOctave(-1));
document.getElementById('octave-up').addEventListener('click',()=>changeOctave(1));

// 音量調整
const volumeInput=document.getElementById('volume');
const volumeValue=document.getElementById('volume-value');

volumeInput.addEventListener('input',(e)=>{
  const value=e.target.value;
  masterGain.gain.value=value/100;
  volumeValue.textContent=`${value}%`;
});

// 録音機能
const recordBtn=document.getElementById('record-btn');
const stopBtn=document.getElementById('stop-btn');
const downloadBtn=document.getElementById('download-btn');
const recordingStatus=document.getElementById('recording-status');
const statusText=document.getElementById('status-text');

recordBtn.addEventListener('click',()=>{
  if(!isRecording){
    startRecording();
  }else{
    stopRecording();
  }
});

stopBtn.addEventListener('click',stopRecording);

function startRecording(){
  isRecording=true;
  recordedNotes=[];
  recordStartTime=Date.now();
  
  recordBtn.innerHTML='<span class="material-icons">stop</span>録音中';
  stopBtn.disabled=false;
  downloadBtn.disabled=true;
  
  recordingStatus.classList.add('recording');
  statusText.textContent='録音中...';
}

function stopRecording(){
  isRecording=false;
  
  recordBtn.innerHTML='<span class="material-icons">fiber_manual_record</span>録音';
  stopBtn.disabled=true;
  downloadBtn.disabled=false;
  
  recordingStatus.classList.remove('recording');
  statusText.textContent=`録音完了（${recordedNotes.length}音）`;
}

downloadBtn.addEventListener('click',()=>{
  if(recordedNotes.length===0){
    alert('録音データがありません');
    return;
  }
  
  const data=JSON.stringify(recordedNotes,null,2);
  const blob=new Blob([data],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  
  const a=document.createElement('a');
  a.href=url;
  a.download=`piano-recording-${Date.now()}.json`;
  a.click();
  
  URL.revokeObjectURL(url);
});

// 初期化
generateKeyboard();