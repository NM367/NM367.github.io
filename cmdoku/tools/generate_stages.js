// ちゃぷりミャウドク ステージ生成・唯一解検証スクリプト（開発用 / Node.js）
// 実行: node generate_stages.js
// 出力: stages.js （盤面配列を静的データとして書き出す）

const fs = require('fs');
const path = require('path');

const ANIMALS = ['usagi', 'neko', 'inu', 'kuma', 'kitsune', 'zou', 'saru', 'tanuki', 'lion', 'lioness'];

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// --- 1. 正解パターン生成（行ごとに列を割り当て、列重複禁止＋8方向隣接禁止） ---
function generateSolution(N, maxAttempts = 2000) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const cols = [];
    const colUsed = new Array(N).fill(false);

    function backtrack(row) {
      if (row === N) return true;
      const order = shuffle([...Array(N).keys()]);
      for (const col of order) {
        if (colUsed[col]) continue;
        const prevCol = row > 0 ? cols[row - 1] : null;
        if (prevCol !== null && Math.abs(col - prevCol) <= 1) continue;
        colUsed[col] = true;
        cols[row] = col;
        if (backtrack(row + 1)) return true;
        colUsed[col] = false;
        cols.pop();
      }
      return false;
    }

    if (backtrack(0)) return cols; // cols[row] = col
  }
  throw new Error('正解パターンの生成に失敗しました (N=' + N + ')');
}

// --- 2. 領域拡張法でN個のエリアに分割（正解セルを種にする） ---
// フロンティア全体からランダムに1マスずつ拡張していく方式。
// 領域サイズが不均一・入り組んだ形になりやすく、結果として唯一解になりやすい。
function generateRegions(N, solutionCols) {
  const regionMap = Array.from({ length: N }, () => new Array(N).fill(-1));
  const frontier = []; // [region, r, c]

  function pushNeighbors(r, c, region) {
    const deltas = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of deltas) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < N && nc >= 0 && nc < N && regionMap[nr][nc] === -1) {
        frontier.push([region, nr, nc]);
      }
    }
  }

  for (let r = 0; r < N; r++) {
    const c = solutionCols[r];
    regionMap[r][c] = r;
    pushNeighbors(r, c, r);
  }

  while (frontier.length > 0) {
    const idx = Math.floor(Math.random() * frontier.length);
    const [region, r, c] = frontier.splice(idx, 1)[0];
    if (regionMap[r][c] !== -1) continue;
    regionMap[r][c] = region;
    pushNeighbors(r, c, region);
  }

  return regionMap;
}

// --- 3. 唯一解検証ソルバー（ビットマスクで高速化。行ごとに1つ配置、列・エリア・隣接を検査） ---
function countSolutions(N, regionMap, cap = 2) {
  let count = 0;

  function backtrack(row, colMask, regionMask, prevCol) {
    if (count >= cap) return;
    if (row === N) {
      count++;
      return;
    }
    const rowRegions = regionMap[row];
    for (let col = 0; col < N; col++) {
      if (colMask & (1 << col)) continue;
      if (prevCol !== null && Math.abs(col - prevCol) <= 1) continue;
      const reg = rowRegions[col];
      const regBit = 1 << reg;
      if (regionMask & regBit) continue;
      backtrack(row + 1, colMask | (1 << col), regionMask | regBit, col);
      if (count >= cap) return;
    }
  }

  backtrack(0, 0, 0, null);
  return count;
}

// --- 4. 1ステージ分の生成（唯一解になるまでリトライ） ---
function generateStage(N, maxRegionRetries = 6000, maxSolutionRetries = 100) {
  for (let sAttempt = 0; sAttempt < maxSolutionRetries; sAttempt++) {
    const solutionCols = generateSolution(N);
    for (let rAttempt = 0; rAttempt < maxRegionRetries; rAttempt++) {
      const regionMap = generateRegions(N, solutionCols);
      const solCount = countSolutions(N, regionMap, 2);
      if (solCount === 1) {
        const animals = shuffle(ANIMALS).slice(0, N);
        return {
          size: N,
          regionMap,
          regionAnimals: animals, // regionAnimals[regionId] = 動物名
          solution: solutionCols.map((col, row) => [row, col]),
        };
      }
    }
  }
  throw new Error('唯一解の盤面生成に失敗しました (N=' + N + ')。リトライ回数を増やしてください。');
}

// --- 5. ステージ構成（かんたん5 / ふつう5 / むずかしい5） ---
const PLAN = [
  { level: 'easy', sizes: [5, 5, 5, 6, 6] },
  { level: 'normal', sizes: [7, 7, 8, 8, 8] },
  { level: 'hard', sizes: [9, 9, 10, 10, 10] },
];

const stages = [];
let stageId = 1;
for (const group of PLAN) {
  for (const size of group.sizes) {
    process.stdout.write(`生成中: level=${group.level} size=${size} id=${stageId} ... `);
    const t0 = Date.now();
    const stage = generateStage(size);
    stage.id = stageId;
    stage.level = group.level;
    console.log(`OK (${Date.now() - t0}ms)`);
    stages.push(stage);
    stageId++;
  }
}

// --- 6. 検算：全ステージが唯一解であることを再確認 ---
for (const stage of stages) {
  const c = countSolutions(stage.size, stage.regionMap, 2);
  if (c !== 1) {
    throw new Error(`検算失敗: ステージ${stage.id} の解の数が ${c} 件です`);
  }
}
console.log('全ステージの唯一解検証OK: ' + stages.length + '件');

// --- 7. stages.js として書き出し ---
const outPath = path.join(__dirname, '..', 'stages.js');
const body = 'window.CHAPURI_MEOWDOKU_STAGES = ' + JSON.stringify(stages, null, 2) + ';\n';
fs.writeFileSync(outPath, body, 'utf-8');
console.log('書き出し完了: ' + outPath);
