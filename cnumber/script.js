// =========================================================
// ちゃぷり数字パズル - script.js
// =========================================================

const STORAGE_KEY = 'chapuri_puzzle_data';

const PRAISE_MESSAGES = [
  'ちゃぷりすごい！',
  'ちゃぷりさいこう！',
  'ちゃぷり天才！',
  'さすがちゃぷり！',
  'ちゃぷりナイス！',
  'ちゃぷり最強！',
  'やったね、ちゃぷり！',
  'ちゃぷり、かっこいい！',
  'ちゃぷりグッジョブ！',
  'ちゃぷり、えらい！',
  'ちゃぷりキラキラ！',
  'ちゃぷり、すばらしい！'
];

const PRAISE_PERFECT = [
  'ちゃぷり、パーフェクト！',
  'ノーミスのちゃぷり、かんぺき！'
];

const FAIL_MESSAGES = [
  'ちゃぷり、ドンマイ！',
  'ちゃぷり、もう一回！',
  'ちゃぷりファイト！'
];

// ---------------------------------------------------------
// データ保存
// ---------------------------------------------------------
function defaultData(){
  const stages = {};
  for(let i=1;i<=30;i++){
    stages[i] = { cleared:false, bestTime:null, bestMiss:null, stars:0 };
  }
  return { version:1, settings:{ sound:true, theme:'normal' }, stages, lastPlayedStage:null };
}

function sanitizeStageRecord(rec, fallback){
  if(typeof rec !== 'object' || rec === null) return fallback;
  return {
    cleared: rec.cleared === true,
    bestTime: (typeof rec.bestTime === 'number' && isFinite(rec.bestTime) && rec.bestTime >= 0)
      ? Math.floor(rec.bestTime) : null,
    bestMiss: (typeof rec.bestMiss === 'number' && isFinite(rec.bestMiss) && rec.bestMiss >= 0)
      ? Math.floor(rec.bestMiss) : null,
    stars: (typeof rec.stars === 'number' && rec.stars >= 0 && rec.stars <= 3)
      ? Math.floor(rec.stars) : 0
  };
}

function loadData(){
  const base = defaultData();
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return base;

    const parsed = JSON.parse(raw);
    if(!parsed || typeof parsed !== 'object') return base;

    // settings: 既知のキーのみ、型を確認して取り込む
    if(parsed.settings && typeof parsed.settings === 'object'){
      base.settings.sound = parsed.settings.sound !== false;
      base.settings.theme = (parsed.settings.theme === 'dark') ? 'dark' : 'normal';
    }

    // stages: 1〜30の数値キーのみ、各フィールドの型を確認して取り込む
    if(parsed.stages && typeof parsed.stages === 'object'){
      for(let i=1;i<=30;i++){
        if(Object.prototype.hasOwnProperty.call(parsed.stages, i)){
          base.stages[i] = sanitizeStageRecord(parsed.stages[i], base.stages[i]);
        }
      }
    }

    // lastPlayedStage: 1〜30の整数のみ
    const lp = parsed.lastPlayedStage;
    base.lastPlayedStage = (typeof lp === 'number' && lp >= 1 && lp <= 30) ? Math.floor(lp) : null;

    return base;
  }catch(e){ /* 壊れたデータの場合は初期状態を返す */ }
  return base;
}

function saveData(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(appData)); }
  catch(e){ /* ignore */ }
}

let appData = loadData();

// ---------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------
function randomChoice(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

function formatTime(sec){
  if(sec == null) return '--:--';
  const m = Math.floor(sec/60), s = sec%60;
  return String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
}

function starString(n){
  let s='';
  for(let i=0;i<3;i++) s += i < n ? '★' : '☆';
  return s;
}

function missToStars(miss){
  if(miss === 0) return 3;
  if(miss === 1) return 2;
  return 1;
}

function evaluate(A, op, B){
  switch(op){
    case '+': return A + B;
    case '-': return A - B;
    case '×': return A * B;
    case '÷': return (B !== 0 && A % B === 0) ? A / B : null;
  }
  return null;
}

// ---------------------------------------------------------
// 画面切り替え
// ---------------------------------------------------------
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('is-active'));
  document.getElementById(id).classList.add('is-active');
}
function showModal(id){ document.getElementById(id).classList.remove('is-hidden'); }
function hideModal(id){ document.getElementById(id).classList.add('is-hidden'); }

// ---------------------------------------------------------
// 確認モーダル
// ---------------------------------------------------------
let confirmCallback = null;
function showConfirm(text, cb){
  document.getElementById('confirm-text').textContent = text;
  confirmCallback = cb;
  showModal('modal-confirm');
}
document.getElementById('btn-confirm-ok').addEventListener('click', () => {
  hideModal('modal-confirm');
  const cb = confirmCallback;
  confirmCallback = null;
  if(cb) cb();
});
document.getElementById('btn-confirm-cancel').addEventListener('click', () => {
  hideModal('modal-confirm');
  confirmCallback = null;
});

// ---------------------------------------------------------
// サウンド
// ---------------------------------------------------------
let audioCtx = null;
function getAudioCtx(){
  if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if(audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTone(ctx, freq, startOffset, dur, peak, wave){
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = wave || 'sine';
  osc.frequency.value = freq;
  const t = ctx.currentTime + startOffset;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(peak, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function playSound(type){
  if(!appData.settings.sound) return;
  try{
    const ctx = getAudioCtx();

    if(type === 'tap'){
      // かわいい「ぽこん」音：2音を少しずらして重ねる
      playTone(ctx, 1046.5, 0,    0.09, 0.12, 'triangle'); // C6
      playTone(ctx, 1568.0, 0.04, 0.10, 0.09, 'triangle'); // G6
      return;
    }
    if(type === 'correct'){
      playTone(ctx, 880,  0,    0.14, 0.16, 'sine');
      playTone(ctx, 1318.5, 0.06, 0.14, 0.10, 'sine');
      return;
    }
    if(type === 'wrong'){
      playTone(ctx, 220, 0, 0.22, 0.16, 'sawtooth');
      playTone(ctx, 160, 0.05, 0.22, 0.12, 'sawtooth');
      return;
    }
    if(type === 'clear'){
      // きらびやかな上昇アルペジオ
      const notes = [523.25, 659.25, 784.0, 1046.5, 1318.5]; // C5 E5 G5 C6 E6
      notes.forEach((freq, i) => {
        playTone(ctx, freq, i * 0.10, 0.5, 0.16, 'triangle');
        playTone(ctx, freq * 2, i * 0.10, 0.4, 0.05, 'sine');
      });
      return;
    }
  }catch(e){ /* ignore */ }
}

// ---------------------------------------------------------
// テーマ
// ---------------------------------------------------------
function applyTheme(){
  document.documentElement.setAttribute('data-theme', appData.settings.theme === 'dark' ? 'dark' : 'normal');
}

// ---------------------------------------------------------
// タイトル画面
// ---------------------------------------------------------
function setupTitleScreen(){
  document.getElementById('btn-start').addEventListener('click', () => {
    renderStageSelect();
    showScreen('screen-select');
  });

  const continueBtn = document.getElementById('btn-continue');
  if(appData.lastPlayedStage){
    continueBtn.textContent = `つづきから（ステージ${appData.lastPlayedStage}）`;
    continueBtn.classList.remove('is-hidden');
    continueBtn.addEventListener('click', () => startStage(appData.lastPlayedStage));
  }
}

// ---------------------------------------------------------
// ステージ選択画面
// ---------------------------------------------------------
function renderStageSelect(){
  const grid = document.getElementById('stage-grid');
  grid.innerHTML = '';
  for(let i=1;i<=30;i++){
    const info = appData.stages[i] || { cleared:false, bestTime:null, stars:0 };
    const btn = document.createElement('button');
    btn.className = 'stage-btn' + (info.cleared ? ' is-cleared' : '');
    let inner = `<span class="num">${i}</span>`;
    if(info.cleared){
      inner += `<span class="stars">${starString(info.stars)}</span>`;
      inner += `<span class="best-time">${formatTime(info.bestTime)}</span>`;
    } else {
      inner += `<span class="stars">&nbsp;</span>`;
    }
    btn.innerHTML = inner;
    btn.addEventListener('click', () => startStage(i));
    grid.appendChild(btn);
  }
}

document.getElementById('btn-select-back').addEventListener('click', () => {
  showScreen('screen-title');
});

// ---------------------------------------------------------
// ゲーム画面：状態
// ---------------------------------------------------------
let gameState = null;

function startStage(stageId){
  const stage = STAGES[stageId - 1];

  gameState = {
    stageId,
    stage,
    rows: stage.rows,
    cols: stage.cols,
    cellMap: {},
    pool: [],
    misses: 0,
    hintsUsed: 0,
    timer: 0,
    timerInterval: null,
    selectedCell: null,
    selectedPoolIndex: null,
    finished: false,
    locked: false
  };

  stage.cells.forEach(c => {
    const copy = Object.assign({}, c);
    if(copy.type === 'number' && copy.editable){
      copy.value = null;
      copy.locked = false;
    }
    gameState.cellMap[c.row + ',' + c.col] = copy;
  });

  gameState.pool = stage.numberPool.map((v, idx) => ({ value: v, used: false, origIdx: idx }));
  gameState.pool.sort((a, b) => a.value - b.value);

  document.getElementById('game-title').textContent = stage.title;
  updateMissDisplay();
  updateHintDisplay();
  resetTimer();

  showScreen('screen-game');
  renderPuzzleGrid();
  renderPool();
  startTimer();
}

// ---------------------------------------------------------
// パズルグリッド描画
// ---------------------------------------------------------
function computeCellSize(rows, cols){
  const container = document.querySelector('.grid-scroll');
  const gap = 4;
  const availW = Math.max(container.clientWidth - 16, 0);
  const availH = Math.max(container.clientHeight - 16, 0);
  let size = 56;
  if(cols > 0) size = Math.min(size, Math.floor((availW - gap*(cols-1)) / cols));
  if(rows > 0) size = Math.min(size, Math.floor((availH - gap*(rows-1)) / rows));
  if(!isFinite(size) || size <= 0) size = 28;
  size = Math.max(24, Math.min(56, size));
  return size;
}

function renderPuzzleGrid(){
  const grid = document.getElementById('puzzle-grid');
  grid.innerHTML = '';
  const { rows, cols } = gameState;
  const cellSize = computeCellSize(rows, cols);
  grid.style.setProperty('--cell-size', cellSize + 'px');
  grid.style.gridTemplateColumns = `repeat(${cols}, var(--cell-size))`;
  grid.style.gridTemplateRows = `repeat(${rows}, var(--cell-size))`;

  for(let r=0;r<rows;r++){
    for(let c=0;c<cols;c++){
      const key = r + ',' + c;
      const info = gameState.cellMap[key];
      const div = document.createElement('div');

      if(!info){
        div.className = 'cell cell-void';
      } else if(info.type === 'operator'){
        div.className = 'cell cell-operator';
        div.textContent = info.value;
      } else if(info.type === 'equals'){
        div.className = 'cell cell-equals';
        div.textContent = '=';
      } else if(info.type === 'number' && !info.editable){
        div.className = 'cell cell-number';
        div.textContent = info.value;
      } else if(info.type === 'number' && info.editable){
        let cls = 'cell cell-blank';
        if(info.locked) cls += ' is-correct';
        else if(info._wrong) cls += ' is-wrong';
        else if(info.value != null) cls += ' is-filled';
        if(gameState.selectedCell && gameState.selectedCell.r === r && gameState.selectedCell.c === c) cls += ' is-selected';
        div.className = cls;
        div.textContent = info.value != null ? info.value : '';
        div.addEventListener('click', () => onCellClick(r, c));
      }

      grid.appendChild(div);
    }
  }
}

// ---------------------------------------------------------
// 数字プール描画
// ---------------------------------------------------------
function renderPool(){
  const pool = document.getElementById('number-pool');
  pool.innerHTML = '';
  gameState.pool.forEach((item, idx) => {
    const tile = document.createElement('button');
    let cls = 'pool-tile';
    if(item.used) cls += ' is-used';
    if(gameState.selectedPoolIndex === idx) cls += ' is-selected';
    tile.className = cls;
    tile.textContent = item.value;
    tile.disabled = item.used;
    tile.addEventListener('click', () => onPoolClick(idx));
    pool.appendChild(tile);
  });
}

// ---------------------------------------------------------
// 操作ロジック
// ---------------------------------------------------------
function onCellClick(r, c){
  if(gameState.finished || gameState.locked) return;
  const key = r + ',' + c;
  const info = gameState.cellMap[key];
  if(!info || info.type !== 'number' || !info.editable || info.locked) return;

  playSound('tap');

  if(info.value != null){
    returnToPool(info.value);
    info.value = null;
    gameState.selectedCell = null;
    gameState.selectedPoolIndex = null;
    renderPuzzleGrid();
    renderPool();
    return;
  }

  if(gameState.selectedPoolIndex != null){
    placeNumber(r, c, gameState.selectedPoolIndex);
  } else {
    if(gameState.selectedCell && gameState.selectedCell.r === r && gameState.selectedCell.c === c){
      gameState.selectedCell = null;
    } else {
      gameState.selectedCell = { r, c };
    }
    renderPuzzleGrid();
  }
}

function onPoolClick(idx){
  if(gameState.finished || gameState.locked) return;
  const item = gameState.pool[idx];
  if(item.used) return;

  playSound('tap');

  if(gameState.selectedCell){
    placeNumber(gameState.selectedCell.r, gameState.selectedCell.c, idx);
  } else {
    gameState.selectedPoolIndex = (gameState.selectedPoolIndex === idx) ? null : idx;
    renderPool();
  }
}

function returnToPool(value){
  const item = gameState.pool.find(p => p.used && p.value === value);
  if(item) item.used = false;
}

function placeNumber(r, c, poolIdx){
  const key = r + ',' + c;
  const info = gameState.cellMap[key];
  const item = gameState.pool[poolIdx];

  info.value = item.value;
  item.used = true;
  gameState.selectedCell = null;
  gameState.selectedPoolIndex = null;

  renderPuzzleGrid();
  renderPool();
  checkEquationsForCell(r, c);
}

// ---------------------------------------------------------
// 数式の判定
// ---------------------------------------------------------
function checkEquationsForCell(r, c){
  const stage = gameState.stage;
  const relevantEqs = stage.equations.filter(eq => eq.cells.some(([rr,cc]) => rr === r && cc === c));

  const toLock = new Set();
  const toReset = new Set();
  let anyWrong = false;

  relevantEqs.forEach(eq => {
    const keys = eq.cells.map(([rr,cc]) => rr + ',' + cc);
    const infos = keys.map(key => gameState.cellMap[key]);
    if(infos.some(i => i.value == null)) return; // まだ全部埋まっていない

    const A = infos[0].value;
    const op = infos[1].value;
    const B = infos[2].value;
    const C = infos[4].value;

    if(evaluate(A, op, B) === C){
      infos.forEach((i, idx) => {
        if(i.type === 'number' && i.editable && !i.locked){
          toLock.add(keys[idx]);
        }
      });
    } else {
      anyWrong = true;
      infos.forEach((i, idx) => {
        if(i.type === 'number' && i.editable && !i.locked){
          toReset.add(keys[idx]);
        }
      });
    }
  });

  // 正解として確定したマスは、他の数式でミス扱いになっていてもリセット対象から外す
  toLock.forEach(key => toReset.delete(key));
  toLock.forEach(key => { gameState.cellMap[key].locked = true; });

  if(anyWrong){
    gameState.misses++;
    updateMissDisplay();
    playSound('wrong');
    gameState.locked = true;
    toReset.forEach(key => { gameState.cellMap[key]._wrong = true; });
    renderPuzzleGrid();

    setTimeout(() => {
      toReset.forEach(key => {
        const info = gameState.cellMap[key];
        if(info.value != null) returnToPool(info.value);
        info.value = null;
        delete info._wrong;
      });
      gameState.locked = false;
      renderPuzzleGrid();
      renderPool();

      if(gameState.misses >= 3){
        onFail();
      }
    }, 650);
  } else {
    playSound('correct');
    renderPuzzleGrid();
    checkClear();
  }
}

function checkClear(){
  const allDone = Object.values(gameState.cellMap).every(info => {
    if(info.type === 'number' && info.editable) return info.locked;
    return true;
  });
  if(allDone) onClear();
}

// ---------------------------------------------------------
// クリア / 失敗
// ---------------------------------------------------------
function onClear(){
  gameState.finished = true;
  stopTimer();
  playSound('clear');

  const misses = gameState.misses;
  const time = gameState.timer;
  const stars = missToStars(misses);

  const rec = appData.stages[gameState.stageId] || { cleared:false, bestTime:null, bestMiss:null, stars:0 };
  rec.cleared = true;
  if(rec.bestMiss == null || misses < rec.bestMiss) rec.bestMiss = misses;
  if(rec.bestTime == null || time < rec.bestTime) rec.bestTime = time;
  rec.stars = Math.max(rec.stars || 0, missToStars(rec.bestMiss));
  appData.stages[gameState.stageId] = rec;
  appData.lastPlayedStage = gameState.stageId;
  saveData();

  const praiseList = misses === 0 ? PRAISE_PERFECT.concat(PRAISE_MESSAGES) : PRAISE_MESSAGES;
  document.getElementById('praise-text').textContent = randomChoice(praiseList);
  document.getElementById('clear-time').textContent = formatTime(time);
  document.getElementById('clear-miss').textContent = misses + '回';
  renderStars(document.getElementById('clear-stars'), stars);
  spawnConfetti();

  const nextBtn = document.getElementById('btn-clear-next');
  if(gameState.stageId >= 30){
    nextBtn.classList.add('is-hidden');
  } else {
    nextBtn.classList.remove('is-hidden');
  }

  showModal('modal-clear');
}

function renderStars(container, count){
  container.innerHTML = '';
  for(let i=0;i<3;i++){
    const span = document.createElement('span');
    span.className = 'star' + (i < count ? '' : ' is-empty');
    span.textContent = i < count ? '★' : '☆';
    span.style.animationDelay = (i * 0.15) + 's';
    container.appendChild(span);
  }
}

function spawnConfetti(){
  const container = document.getElementById('confetti');
  container.innerHTML = '';
  const colors = ['#FF6F91', '#FFB6CC', '#FFE066', '#8FE0B7', '#6E7BFF', '#FFFFFF'];
  for(let i=0;i<28;i++){
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.left = (Math.random() * 100) + '%';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = (Math.random() * 0.5) + 's';
    piece.style.animationDuration = (1.1 + Math.random() * 0.9) + 's';
    if(Math.random() < 0.4) piece.style.borderRadius = '50%';
    container.appendChild(piece);
  }
}

function onFail(){
  gameState.finished = true;
  stopTimer();
  document.getElementById('fail-text').textContent = randomChoice(FAIL_MESSAGES);
  showModal('modal-fail');
}

document.getElementById('btn-clear-retry').addEventListener('click', () => {
  hideModal('modal-clear');
  startStage(gameState.stageId);
});
document.getElementById('btn-clear-select').addEventListener('click', () => {
  hideModal('modal-clear');
  renderStageSelect();
  showScreen('screen-select');
});
document.getElementById('btn-clear-next').addEventListener('click', () => {
  hideModal('modal-clear');
  if(gameState.stageId < 30) startStage(gameState.stageId + 1);
  else { renderStageSelect(); showScreen('screen-select'); }
});

document.getElementById('btn-fail-retry').addEventListener('click', () => {
  hideModal('modal-fail');
  startStage(gameState.stageId);
});
document.getElementById('btn-fail-select').addEventListener('click', () => {
  hideModal('modal-fail');
  renderStageSelect();
  showScreen('screen-select');
});

// ---------------------------------------------------------
// タイマー
// ---------------------------------------------------------
function startTimer(){
  gameState.timerInterval = setInterval(() => {
    gameState.timer++;
    document.getElementById('timer-display').textContent = formatTime(gameState.timer);
  }, 1000);
}
function stopTimer(){
  if(gameState && gameState.timerInterval) clearInterval(gameState.timerInterval);
}
function resetTimer(){
  gameState.timer = 0;
  document.getElementById('timer-display').textContent = '00:00';
}

// ---------------------------------------------------------
// ミス表示
// ---------------------------------------------------------
function updateMissDisplay(){
  document.getElementById('miss-count').textContent = gameState.misses;
  document.getElementById('miss-pill').classList.toggle('is-warning', gameState.misses > 0);
}

// ---------------------------------------------------------
// ヒント
// ---------------------------------------------------------
function updateHintDisplay(){
  const remain = gameState.stage.hintLimit - gameState.hintsUsed;
  document.getElementById('hint-remain').textContent = `（残り${Math.max(remain,0)}）`;
  document.getElementById('btn-hint').disabled = remain <= 0;
}

document.getElementById('btn-hint').addEventListener('click', () => {
  if(gameState.finished || gameState.locked) return;
  const remain = gameState.stage.hintLimit - gameState.hintsUsed;
  if(remain <= 0) return;

  const candidates = Object.entries(gameState.cellMap).filter(([k, info]) =>
    info.type === 'number' && info.editable && !info.locked && info.value == null
  );
  if(candidates.length === 0) return;

  const [key] = randomChoice(candidates);
  const [r, c] = key.split(',').map(Number);
  const info = gameState.cellMap[key];

  const poolIdx = gameState.pool.findIndex(p => !p.used && p.value === info.answer);
  if(poolIdx === -1) return;

  gameState.hintsUsed++;
  updateHintDisplay();
  placeNumber(r, c, poolIdx);
});

// ---------------------------------------------------------
// 戻る / リセット
// ---------------------------------------------------------
document.getElementById('btn-game-back').addEventListener('click', () => {
  showConfirm('ステージ選択にもどりますか？\nこのステージの記録は保存されません。', () => {
    stopTimer();
    renderStageSelect();
    showScreen('screen-select');
  });
});

document.getElementById('btn-game-reset').addEventListener('click', () => {
  showConfirm('このステージをはじめからやり直しますか？', () => {
    stopTimer();
    startStage(gameState.stageId);
  });
});

// ---------------------------------------------------------
// 設定
// ---------------------------------------------------------
function openSettings(){
  document.getElementById('setting-sound').checked = appData.settings.sound;
  document.getElementById('setting-theme').value = appData.settings.theme;
  showModal('modal-settings');
}
document.getElementById('btn-title-settings').addEventListener('click', openSettings);
document.getElementById('btn-select-settings').addEventListener('click', openSettings);
document.getElementById('btn-game-settings').addEventListener('click', openSettings);
document.getElementById('btn-settings-close').addEventListener('click', () => hideModal('modal-settings'));

document.getElementById('setting-sound').addEventListener('change', e => {
  appData.settings.sound = e.target.checked;
  saveData();
});
document.getElementById('setting-theme').addEventListener('change', e => {
  appData.settings.theme = e.target.value;
  applyTheme();
  saveData();
});
document.getElementById('btn-reset-data').addEventListener('click', () => {
  showConfirm('進行データ（クリア記録・ベストタイムなど）を初期化しますか？\nこの操作はもとに戻せません。', () => {
    appData = defaultData();
    saveData();
    applyTheme();
    renderStageSelect();
    document.getElementById('btn-continue').classList.add('is-hidden');
    hideModal('modal-settings');
  });
});

// ---------------------------------------------------------
// ウィンドウリサイズ
// ---------------------------------------------------------
window.addEventListener('resize', () => {
  if(gameState && document.getElementById('screen-game').classList.contains('is-active')){
    renderPuzzleGrid();
  }
});

// ---------------------------------------------------------
// 初期化
// ---------------------------------------------------------
applyTheme();
setupTitleScreen();
