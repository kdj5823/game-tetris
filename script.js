"use strict";

const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;

const boardCanvas = document.getElementById("board");
const nextCanvas = document.getElementById("next");
const holdCanvas = document.getElementById("hold");
const boardCtx = boardCanvas.getContext("2d");
const nextCtx = nextCanvas.getContext("2d");
const holdCtx = holdCanvas.getContext("2d");

const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");
const timeEl = document.getElementById("time");
const mobileScoreEl = document.getElementById("mobileScore");
const mobileLinesEl = document.getElementById("mobileLines");
const mobileLevelEl = document.getElementById("mobileLevel");
const mobileComboEl = document.getElementById("mobileCombo");
const mobileLastScoreEl = document.getElementById("mobileLastScore");
const statusEl = document.getElementById("statusText");
const popupLayer = document.getElementById("scorePopupLayer");
const boardWrap = document.getElementById("boardWrap");
const holdPanel = document.getElementById("holdPanel");
const holdStatusEl = document.getElementById("holdStatus");
const holdEmptyTextEl = document.getElementById("holdEmptyText");

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const restartBtn = document.getElementById("restartBtn");
const sfxToggle = document.getElementById("sfxToggle");
const bgmToggle = document.getElementById("bgmToggle");
const volumeSlider = document.getElementById("volume");
const touchLeftBtn = document.getElementById("touchLeft");
const touchRightBtn = document.getElementById("touchRight");
const touchDownBtn = document.getElementById("touchDown");
const touchHoldBtn = document.getElementById("touchHold");
const touchPauseBtn = document.getElementById("touchPause");
const touchResetBtn = document.getElementById("touchReset");
const touchRotateBtn = document.getElementById("touchRotate");
const touchDropBtn = document.getElementById("touchDrop");

const COLORS = {
  I: "#35d7ff",
  O: "#ffe066",
  T: "#b27cff",
  S: "#52d273",
  Z: "#ff6f6f",
  J: "#5f8bff",
  L: "#ffad5a"
};

const SHAPES = {
  I: [[1, 1, 1, 1]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1]],
  S: [[0, 1, 1], [1, 1, 0]],
  Z: [[1, 1, 0], [0, 1, 1]],
  J: [[1, 0, 0], [1, 1, 1]],
  L: [[0, 0, 1], [1, 1, 1]]
};

const SCORE_TABLE = { 1: 100, 2: 300, 3: 700, 4: 1500 };
const STORAGE_KEY = "gameTetrisSoundSettings";

let board = createEmptyBoard();
let current = null;
let next = null;
let score = 0;
let lines = 0;
let level = 1;
let gameTimeMs = 0;
let lastScoreGain = 0;

let isRunning = false;
let isPaused = false;
let isGameOver = false;
let lastFrameTime = 0;
let dropAccumulator = 0;
let softDropPressed = false;
let comboCount = 0;
let activeComboPopup = null;
let activeLineClearPopup = null;
let heldType = null;
let canHold = true;
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
let touchMoved = false;
const TOUCH_DEBUG = true;

const soundSettings = {
  sfxEnabled: true,
  bgmEnabled: true,
  volume: 0.5
};

const audio = {
  ctx: null,
  master: null,
  sfxGain: null,
  bgmGain: null,
  backgroundMusicInterval: null,
  backgroundMusicTimeout: null,
  bgmSchedulerId: null,
  activeOscillators: [],
  activeGains: [],
  bgmStepSeconds: 0.2,
  bgmLookaheadMs: 90,
  bgmScheduleAheadSec: 0.38,
  bgmNextNoteTime: 0,
  bgmStep: 0,
  isBgmRunning: false
};

const BGM_NOTE_FREQ = {
  A2: 110.0,
  B2: 123.47,
  C3: 130.81,
  D3: 146.83,
  E3: 164.81,
  G2: 98.0,
  E4: 329.63,
  G4: 392.0,
  A4: 440.0,
  C5: 523.25,
  D4: 293.66
};

function createEmptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function cloneShape(shape) {
  return shape.map((row) => row.slice());
}

function randomType() {
  const keys = Object.keys(SHAPES);
  return keys[Math.floor(Math.random() * keys.length)];
}

function createPiece(type = randomType()) {
  const matrix = cloneShape(SHAPES[type]);
  return {
    type,
    matrix,
    color: COLORS[type],
    x: Math.floor((COLS - matrix[0].length) / 2),
    y: 0
  };
}

function clonePiece(piece) {
  return {
    type: piece.type,
    matrix: cloneShape(piece.matrix),
    color: piece.color,
    x: piece.x,
    y: piece.y
  };
}

function resetPiecePosition(piece) {
  const fixed = clonePiece(piece);
  fixed.matrix = cloneShape(SHAPES[fixed.type]);
  fixed.color = COLORS[fixed.type];
  fixed.x = Math.floor((COLS - fixed.matrix[0].length) / 2);
  fixed.y = 0;
  return fixed;
}

function rotateMatrix(matrix) {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const rotated = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      rotated[x][rows - 1 - y] = matrix[y][x];
    }
  }
  return rotated;
}

function collides(piece, offX = 0, offY = 0, testMatrix = piece.matrix) {
  for (let y = 0; y < testMatrix.length; y += 1) {
    for (let x = 0; x < testMatrix[y].length; x += 1) {
      if (!testMatrix[y][x]) continue;
      const nx = piece.x + x + offX;
      const ny = piece.y + y + offY;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function mergePiece(piece) {
  piece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value && piece.y + y >= 0) {
        board[piece.y + y][piece.x + x] = piece.color;
      }
    });
  });
}

function clearLines() {
  let cleared = 0;
  const clearedRows = [];
  for (let y = ROWS - 1; y >= 0; y -= 1) {
    if (board[y].every(Boolean)) {
      clearedRows.push(y);
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(null));
      cleared += 1;
      y += 1;
    }
  }
  if (cleared > 0) {
    const gained = (SCORE_TABLE[cleared] || 0) * level;
    lastScoreGain = gained;
    score += gained;
    lines += cleared;
    level = Math.floor(lines / 10) + 1;
    comboCount += 1;
    showScorePopup(cleared, gained, clearedRows, comboCount);
    showLineClearPopup(cleared, gained);
    playLineClearImpactSound(cleared);
  } else {
    lastScoreGain = 0;
    comboCount = 0;
  }
}

function lockCurrentPiece() {
  mergePiece(current);
  playSfxPattern([220, 110], 0.09, "square");
  clearLines();
  spawnNextPiece();
}

function spawnNextPiece() {
  current = resetPiecePosition(next || createPiece());
  next = createPiece();
  canHold = true;
  if (collides(current)) {
    isGameOver = true;
    isRunning = false;
    setStatus("게임 오버! R 키 또는 재시작 버튼을 눌러 다시 시작하세요.");
    playSfxPattern([260, 180, 120], 0.22, "triangle");
    stopBackgroundMusic();
  }
}

function tryMove(dx, dy) {
  if (!current || isPaused || !isRunning) return false;
  if (!collides(current, dx, dy)) {
    current.x += dx;
    current.y += dy;
    return true;
  }
  return false;
}

function tryRotate() {
  if (!current || isPaused || !isRunning) return;
  const rotated = rotateMatrix(current.matrix);
  const kicks = [0, -1, 1, -2, 2];
  for (const k of kicks) {
    if (!collides(current, k, 0, rotated)) {
      current.matrix = rotated;
      current.x += k;
      playSfxPattern([480, 660], 0.05, "triangle");
      return;
    }
  }
}

function actionMoveLeft() {
  if (tryMove(-1, 0)) playSfxPattern([330], 0.05, "square");
}

function actionMoveRight() {
  if (tryMove(1, 0)) playSfxPattern([330], 0.05, "square");
}

function actionSoftDrop() {
  if (tryMove(0, 1)) playSfxPattern([180], 0.03, "square");
}

function actionRotate() {
  tryRotate();
}

function actionHardDrop() {
  hardDrop();
}

function hardDrop() {
  if (!current || isPaused || !isRunning) return;
  let moved = 0;
  while (tryMove(0, 1)) moved += 1;
  if (moved > 0) playSfxPattern([360, 240, 120], 0.08, "square");
  lockCurrentPiece();
}

function tickDrop() {
  if (!current || isPaused || !isRunning) return;
  if (!tryMove(0, 1)) lockCurrentPiece();
}

function computeDropInterval() {
  const base = 900;
  const levelBonus = (level - 1) * 65;
  const timeBonus = Math.floor(gameTimeMs / 12000) * 15;
  const min = 110;
  return Math.max(min, base - levelBonus - timeBonus);
}

function drawCell(ctx, x, y, color, size = BLOCK_SIZE) {
  ctx.fillStyle = color;
  ctx.fillRect(x * size, y * size, size, size);
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fillRect(x * size + 2, y * size + 2, size - 4, 5);
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.strokeRect(x * size + 0.5, y * size + 0.5, size - 1, size - 1);
}

function drawBoard() {
  boardCtx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
  boardCtx.fillStyle = "#0b0d12";
  boardCtx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);

  boardCtx.strokeStyle = "rgba(255,255,255,0.05)";
  for (let x = 0; x <= COLS; x += 1) {
    boardCtx.beginPath();
    boardCtx.moveTo(x * BLOCK_SIZE + 0.5, 0);
    boardCtx.lineTo(x * BLOCK_SIZE + 0.5, ROWS * BLOCK_SIZE);
    boardCtx.stroke();
  }
  for (let y = 0; y <= ROWS; y += 1) {
    boardCtx.beginPath();
    boardCtx.moveTo(0, y * BLOCK_SIZE + 0.5);
    boardCtx.lineTo(COLS * BLOCK_SIZE, y * BLOCK_SIZE + 0.5);
    boardCtx.stroke();
  }

  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      const color = board[y][x];
      if (color) drawCell(boardCtx, x, y, color);
    }
  }

  if (current) {
    current.matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value) drawCell(boardCtx, current.x + x, current.y + y, current.color);
      });
    });
  }
}

function drawNext() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  nextCtx.fillStyle = "#0d1018";
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (!next) return;

  drawCenteredPreview(nextCtx, nextCanvas, next.matrix, next.color);
}

function drawHoldPiece() {
  holdCtx.clearRect(0, 0, holdCanvas.width, holdCanvas.height);
  holdCtx.fillStyle = "#0d1018";
  holdCtx.fillRect(0, 0, holdCanvas.width, holdCanvas.height);

  holdStatusEl.textContent = "LOCKED";
  holdStatusEl.classList.toggle("is-locked", !canHold);
  holdEmptyTextEl.style.display = heldType ? "none" : "block";
  if (!heldType) return;

  const preview = createPiece(heldType);
  drawCenteredPreview(holdCtx, holdCanvas, preview.matrix, preview.color);
}

function drawCenteredPreview(ctx, canvas, matrix, color) {
  const size = 24;
  const bounds = getShapeBounds(matrix);
  if (!bounds) return;

  const shapeCols = bounds.maxCol - bounds.minCol + 1;
  const shapeRows = bounds.maxRow - bounds.minRow + 1;
  const shapePixelW = shapeCols * size;
  const shapePixelH = shapeRows * size;
  const startPxX = Math.floor((canvas.width - shapePixelW) / 2);
  const startPxY = Math.floor((canvas.height - shapePixelH) / 2);

  matrix.forEach((row, r) => {
    row.forEach((value, c) => {
      if (!value) return;
      const localX = c - bounds.minCol;
      const localY = r - bounds.minRow;
      drawPreviewCell(ctx, startPxX + localX * size, startPxY + localY * size, color, size);
    });
  });
}

function getShapeBounds(shape) {
  let minRow = Infinity;
  let maxRow = -Infinity;
  let minCol = Infinity;
  let maxCol = -Infinity;

  shape.forEach((row, r) => {
    row.forEach((value, c) => {
      if (!value) return;
      minRow = Math.min(minRow, r);
      maxRow = Math.max(maxRow, r);
      minCol = Math.min(minCol, c);
      maxCol = Math.max(maxCol, c);
    });
  });

  if (!Number.isFinite(minRow)) return null;
  return { minRow, maxRow, minCol, maxCol };
}

function drawPreviewCell(ctx, px, py, color, size) {
  ctx.fillStyle = color;
  ctx.fillRect(px, py, size, size);
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fillRect(px + 2, py + 2, size - 4, 5);
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);
}

function playHoldSound() {
  playSfxPattern([460, 620, 820], 0.045, "triangle");
}

function playHoldBlockedSound() {
  playSfxPattern([150], 0.04, "square");
}

function holdCurrentPiece() {
  if (!isRunning || isPaused || isGameOver || !current) return;
  if (!canHold) {
    playHoldBlockedSound();
    return;
  }

  if (!heldType) {
    heldType = current.type;
    current = resetPiecePosition(next);
    next = createPiece();
  } else {
    const swapType = heldType;
    heldType = current.type;
    current = createPiece(swapType);
  }

  canHold = false;
  playHoldSound();
  holdPanel.classList.add("hold-active");
  setTimeout(() => holdPanel.classList.remove("hold-active"), 220);

  if (collides(current)) {
    isGameOver = true;
    isRunning = false;
    setStatus("게임 오버! R 키 또는 재시작 버튼을 눌러 다시 시작하세요.");
    stopBackgroundMusic();
  }
}

function renderStats() {
  scoreEl.textContent = String(score);
  linesEl.textContent = String(lines);
  levelEl.textContent = String(level);
  timeEl.textContent = `${Math.floor(gameTimeMs / 1000)}s`;
  if (mobileScoreEl) mobileScoreEl.textContent = String(score);
  if (mobileLinesEl) mobileLinesEl.textContent = String(lines);
  if (mobileLevelEl) mobileLevelEl.textContent = String(level);
  if (mobileComboEl) mobileComboEl.textContent = String(comboCount);
  if (mobileLastScoreEl) mobileLastScoreEl.textContent = `+${lastScoreGain}`;
}

function setStatus(message) {
  statusEl.textContent = message;
}

function makePopupElement(className, text, topPx) {
  const div = document.createElement("div");
  div.className = className;
  div.textContent = text;
  div.style.left = "50%";
  div.style.top = `${Math.max(80, Math.min(520, topPx))}px`;
  popupLayer.appendChild(div);
  return div;
}

function spawnTetrisParticles() {
  const count = 8;
  const centerX = boardCanvas.width / 2;
  const centerY = Math.floor(boardCanvas.height * 0.45);
  for (let i = 0; i < count; i += 1) {
    const spark = document.createElement("div");
    spark.className = "spark";
    const angle = (Math.PI * 2 * i) / count;
    const dist = 18 + Math.random() * 30;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 8;
    spark.style.left = `${centerX}px`;
    spark.style.top = `${centerY}px`;
    spark.style.setProperty("--dx", `${dx}px`);
    spark.style.setProperty("--dy", `${dy}px`);
    popupLayer.appendChild(spark);
    setTimeout(() => spark.remove(), 850);
  }
}

function createComboParticles(comboValue) {
  let count = 0;
  if (comboValue >= 6) count = 10;
  else if (comboValue >= 4) count = 5;
  if (!count) return;

  const centerX = boardCanvas.width / 2;
  const centerY = Math.floor(boardCanvas.height * 0.4);
  const palette = ["#7ddcff", "#ffe56a", "#ffffff"];
  for (let i = 0; i < count; i += 1) {
    const spark = document.createElement("div");
    spark.className = "combo-spark";
    const angle = (Math.PI * 2 * i) / count;
    const dist = 20 + Math.random() * 28;
    spark.style.left = `${centerX}px`;
    spark.style.top = `${centerY}px`;
    spark.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
    spark.style.setProperty("--dy", `${Math.sin(angle) * dist - 6}px`);
    spark.style.setProperty("--spark-color", palette[i % palette.length]);
    popupLayer.appendChild(spark);
    setTimeout(() => spark.remove(), 900);
  }
}

function createLineClearParticles(lineCount) {
  let count = 0;
  if (lineCount === 3) count = 5;
  else if (lineCount >= 4) count = 10;
  if (!count) return;

  const centerX = boardCanvas.width / 2;
  const centerY = Math.floor(boardCanvas.height * 0.46);
  const palette = lineCount >= 4
    ? ["#ffd84a", "#ff9148", "#fff0b0"]
    : ["#8edfff", "#ffe56a", "#ffffff"];

  for (let i = 0; i < count; i += 1) {
    const spark = document.createElement("div");
    spark.className = "combo-spark";
    const angle = (Math.PI * 2 * i) / count;
    const dist = 18 + Math.random() * 26;
    spark.style.left = `${centerX}px`;
    spark.style.top = `${centerY}px`;
    spark.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
    spark.style.setProperty("--dy", `${Math.sin(angle) * dist - 8}px`);
    spark.style.setProperty("--spark-color", palette[i % palette.length]);
    popupLayer.appendChild(spark);
    setTimeout(() => spark.remove(), 850);
  }
}

function canPlayGameplaySfx() {
  return Boolean(audio.ctx && soundSettings.sfxEnabled && isRunning && !isPaused && !isGameOver);
}

function createTone(frequency, startTime, duration, type = "square", volume = 0.25) {
  if (!canPlayGameplaySfx()) return;
  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startTime);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(gain);
  gain.connect(audio.sfxGain);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.01);
  osc.onended = () => {
    try { osc.disconnect(); } catch {}
    try { gain.disconnect(); } catch {}
  };
}

function createPitchSweep(startFreq, endFreq, duration, volume = 0.3, type = "triangle") {
  if (!canPlayGameplaySfx()) return;
  const start = audio.ctx.currentTime;
  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(startFreq, start);
  osc.frequency.exponentialRampToValueAtTime(endFreq, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(audio.sfxGain);
  osc.start(start);
  osc.stop(start + duration + 0.01);
  osc.onended = () => {
    try { osc.disconnect(); } catch {}
    try { gain.disconnect(); } catch {}
  };
}

function createNoiseBurst(duration = 0.08, volume = 0.18, filterType = "highpass") {
  if (!canPlayGameplaySfx()) return;
  const sampleRate = audio.ctx.sampleRate;
  const frameCount = Math.max(1, Math.floor(sampleRate * duration));
  const buffer = audio.ctx.createBuffer(1, frameCount, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / frameCount);

  const src = audio.ctx.createBufferSource();
  const filter = audio.ctx.createBiquadFilter();
  const gain = audio.ctx.createGain();
  filter.type = filterType;
  filter.frequency.value = filterType === "bandpass" ? 2100 : 1400;
  if (filterType === "bandpass") filter.Q.value = 1.6;
  gain.gain.setValueAtTime(0.0001, audio.ctx.currentTime);
  gain.gain.linearRampToValueAtTime(volume, audio.ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.ctx.currentTime + duration);
  src.buffer = buffer;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(audio.sfxGain);
  src.start();
  src.stop(audio.ctx.currentTime + duration + 0.01);
  src.onended = () => {
    try { src.disconnect(); } catch {}
    try { filter.disconnect(); } catch {}
    try { gain.disconnect(); } catch {}
  };
}

function playImpactPopSound() {
  if (!canPlayGameplaySfx()) return;
  const t = audio.ctx.currentTime;
  createTone(340, t, 0.07, "square", 0.22);
  createTone(520, t + 0.03, 0.08, "triangle", 0.18);
}

function playBonusSparkSound() {
  if (!canPlayGameplaySfx()) return;
  const t = audio.ctx.currentTime;
  createTone(980, t, 0.05, "triangle", 0.2);
  createTone(1260, t + 0.03, 0.05, "triangle", 0.16);
  createNoiseBurst(0.06, 0.11, "bandpass");
}

function playMetalClangSound(intensity = 1) {
  if (!canPlayGameplaySfx()) return;
  const vol = intensity === 1 ? 0.35 : intensity === 2 ? 0.45 : 0.55;
  const t = audio.ctx.currentTime;
  createPitchSweep(900, 1400 + intensity * 160, 0.18 + intensity * 0.04, vol * 0.42, "triangle");
  createTone(1800 + intensity * 180, t, 0.12 + intensity * 0.04, "square", vol * 0.33);
  createTone(2400 + intensity * 220, t + 0.018, 0.08 + intensity * 0.03, "triangle", vol * 0.25);
  createNoiseBurst(0.06 + intensity * 0.01, vol * 0.18, "highpass");
}

function playBladeSlashSound(intensity = 2) {
  if (!canPlayGameplaySfx()) return;
  const vol = intensity >= 3 ? 0.55 : 0.45;
  const t = audio.ctx.currentTime;
  createPitchSweep(520, 2200 + intensity * 250, 0.22 + intensity * 0.05, vol * 0.5, "sawtooth");
  createTone(2500 + intensity * 180, t + 0.015, 0.1, "square", vol * 0.28);
  createTone(3200 + intensity * 140, t + 0.035, 0.08, "triangle", vol * 0.22);
  createTone(1200, t + 0.18, 0.14, "triangle", vol * 0.16);
  createNoiseBurst(0.08, vol * 0.2, "highpass");
}

function playSharpImpactSound(intensity = 2) {
  if (!canPlayGameplaySfx()) return;
  const vol = intensity >= 3 ? 0.52 : 0.4;
  const t = audio.ctx.currentTime;
  createTone(1100 + intensity * 100, t, 0.08, "square", vol * 0.42);
  createTone(1700 + intensity * 130, t + 0.012, 0.1, "triangle", vol * 0.3);
  createNoiseBurst(0.05, vol * 0.15, "bandpass");
}

function playDoubleSound() {
  if (!canPlayGameplaySfx()) return;
  const t = audio.ctx.currentTime;
  createTone(520, t, 0.11, "square", 0.28);
  createTone(780, t + 0.1, 0.14, "triangle", 0.31);
  playMetalClangSound(1);
  playImpactPopSound();
}

function playTripleSound() {
  if (!canPlayGameplaySfx()) return;
  const t = audio.ctx.currentTime;
  createTone(520, t, 0.1, "square", 0.31);
  createTone(700, t + 0.09, 0.12, "square", 0.36);
  createTone(940, t + 0.2, 0.2, "triangle", 0.4);
  playMetalClangSound(2);
  playSharpImpactSound(2);
}

function playTetrisSound() {
  if (!canPlayGameplaySfx()) return;
  const t = audio.ctx.currentTime;
  createTone(330, t, 0.18, "triangle", 0.2);
  createTone(660, t + 0.04, 0.11, "square", 0.31);
  createTone(880, t + 0.14, 0.12, "square", 0.36);
  createTone(990, t + 0.24, 0.12, "triangle", 0.4);
  createTone(1320, t + 0.36, 0.2, "triangle", 0.47);
  playBladeSlashSound(3);
  playSharpImpactSound(3);
  playBonusSparkSound();
}

function playLineClearSound(lineCount) {
  if (!canPlayGameplaySfx()) return;
  if (lineCount === 1) {
    const t = audio.ctx.currentTime;
    createTone(500, t, 0.11, "square", 0.25);
    createTone(620, t + 0.08, 0.1, "triangle", 0.2);
  } else if (lineCount === 2) {
    playDoubleSound();
  } else if (lineCount === 3) {
    playTripleSound();
  } else if (lineCount >= 4) {
    playTetrisSound();
  }
}

function playComboSound(comboValue) {
  const delayMs = comboValue >= 4 ? 90 : 120;
  setTimeout(() => {
    if (!canPlayGameplaySfx()) return;
    const t = audio.ctx.currentTime;
    if (comboValue >= 6) {
      createTone(700, t, 0.09, "triangle", 0.34);
      createTone(900, t + 0.08, 0.1, "triangle", 0.38);
      createTone(1100, t + 0.16, 0.11, "triangle", 0.41);
      createTone(1400, t + 0.25, 0.14, "square", 0.43);
      playBladeSlashSound(2);
    } else if (comboValue >= 4) {
      createTone(620, t, 0.08, "square", 0.27);
      createTone(780, t + 0.07, 0.09, "triangle", 0.3);
      createTone(980, t + 0.15, 0.1, "triangle", 0.32);
      playMetalClangSound(1);
    } else if (comboValue === 3) {
      createTone(650, t, 0.09, "square", 0.25);
      createTone(820, t + 0.08, 0.11, "triangle", 0.27);
      createNoiseBurst(0.03, 0.04, "bandpass");
    } else {
      createTone(600, t, 0.08, "square", 0.24);
      createTone(760, t + 0.07, 0.1, "triangle", 0.25);
    }
  }, delayMs);
}

function playLineClearImpactSound(lineCount) {
  playLineClearSound(lineCount);
}

function showComboPopup(comboValue, comboBonus) {
  if (comboValue < 2) return;

  if (activeComboPopup && activeComboPopup.parentElement) {
    activeComboPopup.remove();
  }

  const wrap = document.createElement("div");
  wrap.className = "combo-popup";
  wrap.style.top = "36%";
  if (comboValue >= 8) wrap.classList.add("combo-max");
  else if (comboValue >= 6) wrap.classList.add("combo-high");
  else if (comboValue >= 4) wrap.classList.add("combo-mid");
  else wrap.classList.add("combo-low");

  const label = document.createElement("span");
  label.className = "combo-label";
  label.textContent = "Combo";
  const num = document.createElement("span");
  num.className = "combo-number";
  num.textContent = String(comboValue);

  wrap.appendChild(label);
  wrap.appendChild(num);
  popupLayer.appendChild(wrap);
  activeComboPopup = wrap;

  playComboSound(comboValue);
  createComboParticles(comboValue);

  if (comboValue >= 6) {
    boardWrap.classList.add("board-flash", "board-nudge");
    setTimeout(() => boardWrap.classList.remove("board-flash", "board-nudge"), 220);
  } else if (comboValue >= 4) {
    boardWrap.classList.add("board-nudge");
    setTimeout(() => boardWrap.classList.remove("board-nudge"), 170);
  }

  const duration = comboValue >= 6 ? 1450 : 1050;
  setTimeout(() => {
    if (activeComboPopup === wrap) activeComboPopup = null;
    wrap.remove();
  }, duration);
}

function showLineClearPopup(lineCount, earnedScore) {
  if (lineCount < 2) return;

  if (activeLineClearPopup && activeLineClearPopup.parentElement) {
    activeLineClearPopup.remove();
  }

  const wrap = document.createElement("div");
  wrap.className = "line-clear-popup";
  if (lineCount === 2) wrap.classList.add("double");
  else if (lineCount === 3) wrap.classList.add("triple");
  else wrap.classList.add("tetris");

  const label = document.createElement("span");
  label.className = "clear-label";
  label.textContent = lineCount === 2 ? "DOUBLE" : lineCount === 3 ? "TRIPLE" : "TETRIS!";

  const score = document.createElement("span");
  score.className = "clear-score";
  score.textContent = `+${earnedScore}`;

  wrap.appendChild(label);
  wrap.appendChild(score);
  popupLayer.appendChild(wrap);
  activeLineClearPopup = wrap;

  createLineClearParticles(lineCount);

  if (lineCount === 3) {
    boardWrap.classList.add("board-nudge");
    setTimeout(() => boardWrap.classList.remove("board-nudge"), 180);
  } else if (lineCount >= 4) {
    boardWrap.classList.add("board-flash", "board-shake");
    setTimeout(() => boardWrap.classList.remove("board-flash", "board-shake"), 240);
  }

  const duration = lineCount >= 4 ? 1300 : 1120;
  setTimeout(() => {
    if (activeLineClearPopup === wrap) activeLineClearPopup = null;
    wrap.remove();
  }, duration);
}

function showScorePopup(cleared, gained, clearedRows = [], currentCombo = 0) {
  let scoreText = `+${gained}`;

  let baseTop = 270;
  if (cleared === 1 && clearedRows.length > 0) {
    const avgRow = clearedRows.reduce((a, b) => a + b, 0) / clearedRows.length;
    baseTop = avgRow * BLOCK_SIZE + 8;
  } else if (cleared >= 2 && cleared <= 3) {
    baseTop = Math.floor(ROWS * BLOCK_SIZE * 0.45);
  }
  if (cleared === 4) baseTop = Math.floor(ROWS * BLOCK_SIZE * 0.45);

  if (cleared === 1) {
    baseTop = Math.max(90, Math.min(510, baseTop));
  } else {
    baseTop = Math.max(280, Math.min(370, baseTop));
  }

  const scoreDiv = makePopupElement(`score-popup score-${Math.min(4, cleared)}`, scoreText, baseTop);
  if (cleared >= 2) scoreDiv.classList.add("score-glow");
  const duration = cleared === 4 ? 1550 : 1100;
  setTimeout(() => scoreDiv.remove(), duration + 100);

  if (currentCombo >= 2) {
    const comboBonusVisual = (currentCombo - 1) * 50 * level;
    showComboPopup(currentCombo, comboBonusVisual);
  }

  if (cleared === 4) {
    boardWrap.classList.add("board-shake", "board-flash");
    spawnTetrisParticles();
    setTimeout(() => boardWrap.classList.remove("board-shake", "board-flash"), 260);
  } else if (cleared >= 3) {
    boardWrap.classList.add("board-nudge");
    setTimeout(() => boardWrap.classList.remove("board-nudge"), 190);
  }
}

function loadSoundSettings() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    soundSettings.sfxEnabled = parsed.sfxEnabled !== false;
    soundSettings.bgmEnabled = parsed.bgmEnabled !== false;
    soundSettings.volume = Number.isFinite(parsed.volume) ? parsed.volume : 0.5;
  } catch {
    // 설정 데이터가 손상된 경우 기본값 유지
  }
}

function saveSoundSettings() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(soundSettings));
}

function applySoundSettingsToUi() {
  sfxToggle.checked = soundSettings.sfxEnabled;
  bgmToggle.checked = soundSettings.bgmEnabled;
  volumeSlider.value = String(Math.round(soundSettings.volume * 100));
}

function ensureAudio() {
  if (audio.ctx) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  audio.ctx = new Ctx();
  audio.master = audio.ctx.createGain();
  audio.sfxGain = audio.ctx.createGain();
  audio.bgmGain = audio.ctx.createGain();

  audio.sfxGain.connect(audio.master);
  audio.bgmGain.connect(audio.master);
  audio.master.connect(audio.ctx.destination);
  updateAudioVolumes();
}

function setMasterVolume(value) {
  if (!audio.master) return;
  audio.master.gain.value = Math.max(0, Math.min(1, value));
}

function updateAudioVolumes() {
  if (!audio.master || !audio.sfxGain || !audio.bgmGain) return;
  setMasterVolume(soundSettings.volume);
  audio.sfxGain.gain.value = soundSettings.sfxEnabled ? 1 : 0;
  audio.bgmGain.gain.value = soundSettings.bgmEnabled ? 0.3 : 0;
}

function playSfxPattern(freqs, duration = 0.08, type = "square") {
  if (!audio.ctx || !soundSettings.sfxEnabled) return;
  const now = audio.ctx.currentTime;
  freqs.forEach((f, i) => {
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = type;
    osc.frequency.value = f;
    gain.gain.setValueAtTime(0.0001, now + i * duration);
    gain.gain.exponentialRampToValueAtTime(0.1, now + i * duration + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + i * duration + duration);
    osc.connect(gain);
    gain.connect(audio.sfxGain);
    osc.start(now + i * duration);
    osc.stop(now + i * duration + duration + 0.02);
  });
}

function playLineSound(count) {
  if (count === 1) playSfxPattern([520], 0.08, "square");
  else if (count === 2) playSfxPattern([520, 700], 0.08, "square");
  else if (count === 3) playSfxPattern([520, 680, 820], 0.08, "triangle");
  else if (count >= 4) playSfxPattern([620, 780, 960, 1200], 0.09, "sawtooth");
}

function cleanupAudioNodes() {
  if (audio.backgroundMusicInterval) {
    clearInterval(audio.backgroundMusicInterval);
    audio.backgroundMusicInterval = null;
  }
  if (audio.bgmSchedulerId) {
    clearInterval(audio.bgmSchedulerId);
    audio.bgmSchedulerId = null;
  }
  if (audio.backgroundMusicTimeout) {
    clearTimeout(audio.backgroundMusicTimeout);
    audio.backgroundMusicTimeout = null;
  }

  audio.activeOscillators.forEach((osc) => {
    try { osc.stop(); } catch {}
    try { osc.disconnect(); } catch {}
  });
  audio.activeGains.forEach((gain) => {
    try { gain.disconnect(); } catch {}
  });

  audio.activeOscillators = [];
  audio.activeGains = [];
}

function playScheduledTone(freq, time, duration, type, gainLevel) {
  if (!audio.ctx || !audio.bgmGain || !freq) return;
  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, time);

  const attack = 0.012;
  const release = Math.max(0.02, duration * 0.35);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(gainLevel, time + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration - release * 0.5);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

  osc.connect(gain);
  gain.connect(audio.bgmGain);
  audio.activeOscillators.push(osc);
  audio.activeGains.push(gain);

  osc.start(time);
  osc.stop(time + duration + 0.01);
  osc.onended = () => {
    audio.activeOscillators = audio.activeOscillators.filter((n) => n !== osc);
    audio.activeGains = audio.activeGains.filter((n) => n !== gain);
    try { osc.disconnect(); } catch {}
    try { gain.disconnect(); } catch {}
  };
}

function playMelodyNote(note, time, duration) {
  if (!note) return;
  playScheduledTone(BGM_NOTE_FREQ[note], time, duration, "square", 0.055);
}

function playBassNote(note, time, duration) {
  if (!note) return;
  playScheduledTone(BGM_NOTE_FREQ[note], time, duration, "triangle", 0.04);
}

function playSoftBeat(time) {
  playScheduledTone(95, time, 0.045, "sine", 0.018);
}

function scheduleBackgroundLoop() {
  if (!audio.ctx || !audio.isBgmRunning || !soundSettings.bgmEnabled) return;

  const melodyPattern = ["E4", "G4", "A4", "G4", "E4", "D4", "E4", null, "G4", "A4", "C5", "A4", "G4", "E4", "D4", null];
  const bassPattern = ["E3", null, "E3", null, "C3", null, "D3", null, "A2", null, "A2", null, "B2", null, "G2", null];

  while (audio.bgmNextNoteTime < audio.ctx.currentTime + audio.bgmScheduleAheadSec) {
    const stepIndex = audio.bgmStep % melodyPattern.length;
    const noteTime = audio.bgmNextNoteTime;
    const stepDur = audio.bgmStepSeconds;

    playMelodyNote(melodyPattern[stepIndex], noteTime, stepDur * 0.9);
    playBassNote(bassPattern[stepIndex], noteTime, stepDur * 0.95);

    if (stepIndex % 4 === 0 || stepIndex % 4 === 2) {
      playSoftBeat(noteTime);
    }

    audio.bgmStep += 1;
    audio.bgmNextNoteTime += stepDur;
  }
}

function startBackgroundMusic() {
  if (!audio.ctx || !soundSettings.bgmEnabled || !isRunning || isPaused || isGameOver) return;
  if (audio.isBgmRunning || audio.bgmSchedulerId) return;

  audio.isBgmRunning = true;
  audio.bgmStep = 0;
  audio.bgmNextNoteTime = audio.ctx.currentTime + 0.04;
  audio.bgmGain.gain.cancelScheduledValues(audio.ctx.currentTime);
  audio.bgmGain.gain.setValueAtTime(0, audio.ctx.currentTime);
  audio.bgmGain.gain.linearRampToValueAtTime(soundSettings.bgmEnabled ? 0.3 : 0, audio.ctx.currentTime + 0.09);

  scheduleBackgroundLoop();
  audio.bgmSchedulerId = setInterval(scheduleBackgroundLoop, audio.bgmLookaheadMs);
}

function stopBackgroundMusic() {
  if (!audio.ctx) return;
  audio.bgmGain.gain.cancelScheduledValues(audio.ctx.currentTime);
  audio.bgmGain.gain.setValueAtTime(0, audio.ctx.currentTime);
  audio.isBgmRunning = false;
  cleanupAudioNodes();
}

function pauseBackgroundMusic() {
  if (!audio.ctx || !audio.bgmGain) return;
  const now = audio.ctx.currentTime;
  audio.bgmGain.gain.cancelScheduledValues(now);
  audio.bgmGain.gain.setValueAtTime(audio.bgmGain.gain.value, now);
  audio.bgmGain.gain.linearRampToValueAtTime(0, now + 0.08);
  audio.backgroundMusicTimeout = setTimeout(() => stopBackgroundMusic(), 90);
}

function resumeBackgroundMusic() {
  if (!soundSettings.bgmEnabled || !isRunning || isPaused || isGameOver) return;
  if (audio.isBgmRunning || audio.bgmSchedulerId) return;
  startBackgroundMusic();
}

function resetGameState() {
  board = createEmptyBoard();
  current = null;
  next = null;
  score = 0;
  lines = 0;
  level = 1;
  gameTimeMs = 0;
  dropAccumulator = 0;
  comboCount = 0;
  lastScoreGain = 0;
  heldType = null;
  canHold = true;
  isGameOver = false;
  spawnNextPiece();
}

function startGame() {
  ensureAudio();
  if (audio.ctx.state === "suspended") audio.ctx.resume();
  updateAudioVolumes();

  if (!isRunning || isGameOver) resetGameState();
  isRunning = true;
  isPaused = false;
  setStatus("게임 진행 중");
  playSfxPattern([440, 660, 880], 0.08, "triangle");
  startBackgroundMusic();
}

function togglePause() {
  if (!isRunning || isGameOver) return;
  isPaused = !isPaused;
  if (isPaused) {
    setStatus("일시정지됨 (P 키로 재개)");
    playSfxPattern([300, 220], 0.09, "square");
    pauseBackgroundMusic();
  } else {
    setStatus("게임 진행 중");
    playSfxPattern([220, 300], 0.09, "square");
    resumeBackgroundMusic();
  }
}

function restartGame() {
  ensureAudio();
  if (audio.ctx.state === "suspended") audio.ctx.resume();
  updateAudioVolumes();
  stopBackgroundMusic();
  resetGameState();
  isRunning = true;
  isPaused = false;
  setStatus("재시작됨");
  playSfxPattern([520, 740, 980], 0.08, "triangle");
  startBackgroundMusic();
}

function gameLoop(timestamp) {
  if (!lastFrameTime) lastFrameTime = timestamp;
  const delta = timestamp - lastFrameTime;
  lastFrameTime = timestamp;

  if (isRunning && !isPaused && !isGameOver) {
    gameTimeMs += delta;
    dropAccumulator += delta;
    const baseInterval = computeDropInterval();
    const interval = softDropPressed ? Math.max(40, baseInterval * 0.08) : baseInterval;

    if (dropAccumulator >= interval) {
      dropAccumulator = 0;
      tickDrop();
    }
  }

  drawBoard();
  drawNext();
  drawHoldPiece();
  renderStats();
  requestAnimationFrame(gameLoop);
}

function bindTouchAction(button, handler) {
  if (!button) return;
  let consumedTouch = false;
  button.addEventListener("touchstart", (e) => {
    e.preventDefault();
    consumedTouch = true;
    handler();
  }, { passive: false });
  button.addEventListener("click", (e) => {
    e.preventDefault();
    if (consumedTouch) {
      consumedTouch = false;
      return;
    }
    handler();
  });
}

function handleBoardTouchStart(e) {
  e.preventDefault();
  if (!e.touches || e.touches.length !== 1) return;
  const t = e.touches[0];
  touchStartX = t.clientX;
  touchStartY = t.clientY;
  touchStartTime = Date.now();
  touchMoved = false;
  if (TOUCH_DEBUG) console.log("[touch] start", touchStartX, touchStartY);

  ensureAudio();
  if (audio.ctx && audio.ctx.state === "suspended") audio.ctx.resume();
}

function handleBoardTouchMove(e) {
  e.preventDefault();
  if (!e.touches || e.touches.length !== 1) return;
  const t = e.touches[0];
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;
  if (Math.abs(dx) > 8 || Math.abs(dy) > 8) touchMoved = true;
}

function handleBoardTouchEnd(e) {
  e.preventDefault();
  if (!isRunning || isPaused || isGameOver) return;
  const changed = e.changedTouches && e.changedTouches[0];
  if (!changed) return;

  const dx = changed.clientX - touchStartX;
  const dy = changed.clientY - touchStartY;
  const dt = Math.max(1, Date.now() - touchStartTime);
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  if (TOUCH_DEBUG) console.log("[touch] end", { dx, dy, dt });

  const tapMaxDistance = 12;
  const swipeThreshold = 25;
  const downThreshold = 25;
  const hardDropThreshold = 80;
  const maxTapDuration = 250;
  const fastSwipe = absY / dt > 0.9;

  if (!touchMoved || (absX < tapMaxDistance && absY < tapMaxDistance && dt < maxTapDuration)) {
    if (TOUCH_DEBUG) console.log("[touch] tap rotate");
    actionRotate();
    return;
  }

  if (absY > absX && dy > downThreshold) {
    if (dy > hardDropThreshold || fastSwipe) {
      if (TOUCH_DEBUG) console.log("[touch] hard drop");
      actionHardDrop();
    } else {
      if (TOUCH_DEBUG) console.log("[touch] soft drop");
      actionSoftDrop();
    }
    return;
  }

  if (absX > swipeThreshold) {
    if (dx > 0) {
      if (TOUCH_DEBUG) console.log("[touch] swipe right");
      actionMoveRight();
    } else {
      if (TOUCH_DEBUG) console.log("[touch] swipe left");
      actionMoveLeft();
    }
  }
}

function setupEvents() {
  startBtn.addEventListener("click", startGame);
  pauseBtn.addEventListener("click", togglePause);
  restartBtn.addEventListener("click", restartGame);

  sfxToggle.addEventListener("change", () => {
    soundSettings.sfxEnabled = sfxToggle.checked;
    saveSoundSettings();
    updateAudioVolumes();
  });

  bgmToggle.addEventListener("change", () => {
    soundSettings.bgmEnabled = bgmToggle.checked;
    saveSoundSettings();
    updateAudioVolumes();
    if (!soundSettings.bgmEnabled) stopBackgroundMusic();
    else if (isRunning && !isPaused && !isGameOver) resumeBackgroundMusic();
  });

  volumeSlider.addEventListener("input", () => {
    soundSettings.volume = Number(volumeSlider.value) / 100;
    saveSoundSettings();
    updateAudioVolumes();
  });

  window.addEventListener("keydown", (e) => {
    const k = e.key;
    if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " ", "Shift"].includes(k)) e.preventDefault();

    if (k === "p" || k === "P") {
      togglePause();
      return;
    }
    if (k === "r" || k === "R") {
      restartGame();
      return;
    }
    if (k === "c" || k === "C" || k === "Shift") {
      holdCurrentPiece();
      return;
    }
    if (!isRunning || isPaused || isGameOver) return;

    if (k === "ArrowLeft") {
      actionMoveLeft();
    } else if (k === "ArrowRight") {
      actionMoveRight();
    } else if (k === "ArrowDown") {
      actionSoftDrop();
    } else if (k === "ArrowUp") {
      actionRotate();
    } else if (k === " ") {
      actionHardDrop();
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") softDropPressed = true;
  });

  window.addEventListener("keyup", (e) => {
    if (e.key === "ArrowDown") softDropPressed = false;
  });

  bindTouchAction(touchLeftBtn, actionMoveLeft);
  bindTouchAction(touchRightBtn, actionMoveRight);
  bindTouchAction(touchDownBtn, actionSoftDrop);
  bindTouchAction(touchRotateBtn, actionRotate);
  bindTouchAction(touchDropBtn, actionHardDrop);
  bindTouchAction(touchHoldBtn, holdCurrentPiece);
  bindTouchAction(touchPauseBtn, togglePause);
  bindTouchAction(touchResetBtn, restartGame);

  boardCanvas.addEventListener("touchstart", handleBoardTouchStart, { passive: false });
  boardCanvas.addEventListener("touchmove", handleBoardTouchMove, { passive: false });
  boardCanvas.addEventListener("touchend", handleBoardTouchEnd, { passive: false });
}

function init() {
  loadSoundSettings();
  applySoundSettingsToUi();
  setStatus("시작 버튼을 눌러 게임을 시작하세요.");
  drawBoard();
  drawNext();
  drawHoldPiece();
  renderStats();
  setupEvents();
  requestAnimationFrame(gameLoop);
}

init();
