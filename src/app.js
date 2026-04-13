import {
  generateGrid, initBFS, stepBFS, initDFS, stepDFS,
  initAstar, stepAstar, initGreedy, stepGreedy, manhattan
} from './utils/mazeAlgorithms.js'

import {
  checkWinner, getWinCells, minimax, alphaBeta
} from './utils/tttAlgorithms.js'

// ════════════════════════════════════════════════
//  NAV
// ════════════════════════════════════════════════
window.switchTab = function(id, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'))
  document.getElementById('page-' + id).classList.add('active')
  document.querySelectorAll('.navbar .tab-btn').forEach(b => b.classList.remove('active'))
  document.querySelectorAll('.mobile-menu .tab-btn').forEach(b => b.classList.remove('active'))
  if (btn) btn.classList.add('active')
  if (id === 'compare' && !compGrid.length) compNewMaze()
  if (id === 'ttt') tttRenderBoard()
  // show desktop header on ttt
  const dh = document.getElementById('ttt-desktop-header')
  if (dh) dh.style.display = id === 'ttt' ? 'block' : 'none'
}

window.toggleMenu = function() {
  document.getElementById('mobile-menu').classList.toggle('open')
}

window.toggleSidebar = function(id) {
  document.getElementById(id).classList.toggle('open')
}

// detect mobile
function isMobile() { return window.innerWidth <= 768 }

window.addEventListener('resize', () => {
  if (mazeGrid.length) mazeDraw()
  if (compGrid.length) { compDrawA(); compDrawB() }
  tttDrawTree()
})

// show mobile controls for maze
function updateMobileCtrls() {
  const el = document.getElementById('maze-mobile-ctrl')
  if (el) el.style.display = isMobile() ? 'flex' : 'none'
  const ms = document.getElementById('ttt-mobile-scores')
  if (ms) ms.style.display = isMobile() ? 'grid' : 'none'
}
window.addEventListener('resize', updateMobileCtrls)
updateMobileCtrls()

// ════════════════════════════════════════════════
//  MAZE DRAW UTILITY
// ════════════════════════════════════════════════
function drawGrid(canvas, grid, start, goal, closed, openSet, pathSet, pathColor, frontColor, metricsMap) {
  if (!canvas || !grid.length) return
  const wrap     = canvas.parentElement
  const avail    = wrap ? wrap.clientWidth - 4 : 500
  const cs       = Math.max(6, Math.min(Math.floor(avail / grid[0].length), 38))
  canvas.width   = grid[0].length * cs
  canvas.height  = grid.length    * cs
  const ctx      = canvas.getContext('2d')

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[0].length; c++) {
      const x = c * cs, y = r * cs, k = `${r},${c}`
      
      // Default cell color (white background)
      ctx.fillStyle = '#ffffff'
      
      if (grid[r][c] === 1) {
        ctx.fillStyle = '#4b2c20' // Brown Wall
      } else if (r === start.r && c === start.c) {
        ctx.fillStyle = '#10b981' // Mouse BG (Strong Green)
      } else if (r === goal.r && c === goal.c) {
        ctx.fillStyle = '#f59e0b' // Cheese BG (Strong Orange/Yellow)
      } else if (pathSet && pathSet.has(k)) {
        ctx.fillStyle = pathColor || '#059669' // Strong Path Green
      } else if (closed && closed.has(k)) {
        ctx.fillStyle = '#1e3a5f' // Explored (Dark Blue)
      } else if (openSet && openSet.has(k)) {
        ctx.fillStyle = frontColor || '#3b82f6' // Frontier (Blue)
      }
      
      ctx.fillRect(x, y, cs, cs)
      
      // Grid lines
      ctx.strokeStyle = '#e2e8f0'; 
      ctx.lineWidth = .5
      ctx.strokeRect(x, y, cs, cs)
      
      // Metrics (f, g, h)
      if (metricsMap && metricsMap[k] && cs >= 28) {
        const m = metricsMap[k]
        ctx.font = `bold ${Math.floor(cs/4.5)}px Space Mono, monospace`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        let ty = y + 2
        // Background for text visibility if needed, but since we have strong BG colors, we use white text
        ctx.fillStyle = '#ffffff'
        if (m.f !== undefined) { ctx.fillText(`f:${m.f}`, x+2, ty); ty += cs/4 }
        if (m.g !== undefined) { ctx.fillText(`g:${m.g}`, x+2, ty); ty += cs/4 }
        if (m.h !== undefined) { ctx.fillText(`h:${m.h}`, x+2, ty) }
      }

      // Icons
      if (cs >= 14) {
        ctx.font = `${Math.max(10, cs-8)}px serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        if (r === start.r && c === start.c) {
          ctx.fillText('🐭', x + cs / 2, y + cs / 2 + 1)
        } else if (r === goal.r && c === goal.c) {
          ctx.fillText('🧀', x + cs / 2, y + cs / 2 + 1)
        }
      }
    }
  }
}

// ════════════════════════════════════════════════
//  MAZE STATE
// ════════════════════════════════════════════════
let mazeGrid = [], mazeSize = 15, mazeAlgo = 'bfs'
let mazeStart = { r:1, c:1 }, mazeGoal = { r:13, c:13 }
let mazeClosed = new Set(), mazeFrontier = { open: new Set(), path: new Set() }
let mazeState = null, mazeDone = false, mazeTimer = null, mazeT0 = 0
let mazeMetrics = {}

const ALGO_INFO = {
  bfs:    { t:'BPA — Primero en Anchura',    d:'Expande nivel por nivel. Cola FIFO. Garantiza el camino más corto.', m:'Completo: Sí | Óptimo: Sí | O(b^d)' },
  dfs:    { t:'BPP — Primero en Profundidad',d:'Pila LIFO. Va tan profundo como sea posible antes de retroceder.',   m:'Completo: No | Óptimo: No | O(b^m)' },
  astar:  { t:'A* — A Estrella',             d:'f(n)=g(n)+h(n). Heurística: Distancia Manhattan. Óptimo y completo.',m:'Completo: Sí | Óptimo: Sí | O(b^d)' },
  greedy: { t:'Voraz — Best-First',          d:'Solo h(n). Más rápido pero no garantiza optimalidad.',               m:'Completo: No | Óptimo: No | O(b^m)' },
}
const ALGO_OPTIMAL = {
  bfs:    '<span style="color:#6ee7b7">✓ Sí — garantizado</span>',
  dfs:    '<span style="color:#f472b6">⚠ No garantizado</span>',
  astar:  '<span style="color:#6ee7b7">✓ Sí — garantizado</span>',
  greedy: '<span style="color:#f472b6">⚠ No garantizado</span>',
}

function mazeDraw() {
  drawGrid(
    document.getElementById('maze-canvas'),
    mazeGrid, mazeStart, mazeGoal,
    mazeClosed, mazeFrontier.open, mazeFrontier.path,
    null, null, mazeMetrics
  )
}

function mazeInitState() {
  mazeMetrics = {}
  switch (mazeAlgo) {
    case 'bfs':    mazeState = initBFS(mazeStart); break
    case 'dfs':    mazeState = initDFS(mazeStart); break
    case 'astar':  mazeState = initAstar(mazeStart, mazeGoal); break
    case 'greedy': mazeState = initGreedy(mazeStart, mazeGoal); break
  }
}

function mazeDoStep() {
  if (mazeDone) return true
  if (!mazeState) mazeInitState()
  let result
  switch (mazeAlgo) {
    case 'bfs':    result = stepBFS(mazeState, mazeGrid, mazeGoal, mazeClosed, mazeFrontier, mazeMetrics);    break
    case 'dfs':    result = stepDFS(mazeState, mazeGrid, mazeGoal, mazeClosed, mazeFrontier, mazeMetrics);    break
    case 'astar':  result = stepAstar(mazeState, mazeGrid, mazeGoal, mazeClosed, mazeFrontier, mazeMetrics);  break
    case 'greedy': result = stepGreedy(mazeState, mazeGrid, mazeGoal, mazeClosed, mazeFrontier, mazeMetrics); break
  }
  const ms = Math.round(performance.now() - mazeT0)
  document.getElementById('m-explored').textContent = mazeClosed.size
  document.getElementById('m-frontier').textContent = mazeFrontier.open.size
  document.getElementById('m-path').textContent     = mazeFrontier.path.size
  document.getElementById('m-time').textContent     = ms
  if (result.done) {
    document.getElementById('m-optimal').innerHTML = ALGO_OPTIMAL[mazeAlgo]
    mazeDone = true
  }
  mazeDraw()
  return result.done
}

function mazeResetState() {
  clearInterval(mazeTimer)
  mazeState    = null
  mazeDone     = false
  mazeClosed   = new Set()
  mazeFrontier = { open: new Set(), path: new Set() }
  mazeMetrics  = {}
  document.getElementById('m-explored').textContent = 0
  document.getElementById('m-frontier').textContent = 0
  document.getElementById('m-path').textContent     = 0
  document.getElementById('m-time').textContent     = 0
  document.getElementById('m-optimal').innerHTML    = '—'
  mazeDraw()
}

window.mazeSelectAlgo = function(algo, btn) {
  mazeAlgo = algo
  document.querySelectorAll('#maze-sidebar .pill').forEach(p => p.classList.remove('active'))
  btn.classList.add('active')
  const info = ALGO_INFO[algo]
  document.getElementById('maze-info-box').innerHTML =
    `<strong>${info.t}</strong>${info.d}<br><br><span style="font-family:'Space Mono',monospace;font-size:.7rem">${info.m}</span>`
  mazeResetState()
}

window.mazeResize = function() {
  mazeSize = parseInt(document.getElementById('maze-size').value)
  mazeGoal = { r: mazeSize-2, c: mazeSize-2 }
  mazeGrid = generateGrid(mazeSize)
  mazeResetState()
}

window.mazeNewGrid = function() {
  mazeGrid = generateGrid(mazeSize, false)
  mazeResetState()
}

window.mazeEmptyGrid = function() {
  mazeGrid = generateGrid(mazeSize, true)
  mazeResetState()
}

window.mazeReset = function() { mazeResetState() }

window.mazeStart = function() {
  if (mazeDone) { mazeResetState(); return }
  if (!mazeState) { mazeInitState(); mazeT0 = performance.now() }
  const spd = parseInt(document.getElementById('maze-speed').value)
  const delay = Math.max(20, 300 - spd * 28)
  clearInterval(mazeTimer)
  mazeTimer = setInterval(() => { if (mazeDoStep()) clearInterval(mazeTimer) }, delay)
}

window.mazeStep = function() {
  if (!mazeState) { mazeInitState(); mazeT0 = performance.now() }
  mazeDoStep()
}

// canvas click = toggle wall or move start/goal
let isDraggingStart = false, isDraggingGoal = false

document.getElementById('maze-canvas').addEventListener('mousedown', function(e) {
  const rect = this.getBoundingClientRect()
  const scaleX = this.width / rect.width
  const scaleY = this.height / rect.height
  const px = (e.clientX - rect.left) * scaleX
  const py = (e.clientY - rect.top) * scaleY
  const cs = this.width / mazeGrid[0].length
  const c = Math.floor(px / cs), r = Math.floor(py / cs)

  if (r === mazeStart.r && c === mazeStart.c) {
    isDraggingStart = true
  } else if (r === mazeGoal.r && c === mazeGoal.c) {
    isDraggingGoal = true
  } else {
    // Normal toggle wall
    if (r <= 0 || r >= mazeGrid.length - 1 || c <= 0 || c >= mazeGrid[0].length - 1) return
    mazeGrid[r][c] = mazeGrid[r][c] === 0 ? 1 : 0
    mazeResetState()
  }
})

window.addEventListener('mousemove', function(e) {
  if (!isDraggingStart && !isDraggingGoal) return
  const canvas = document.getElementById('maze-canvas')
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  const px = (e.clientX - rect.left) * scaleX
  const py = (e.clientY - rect.top) * scaleY
  const cs = canvas.width / mazeGrid[0].length
  const c = Math.floor(px / cs), r = Math.floor(py / cs)

  if (r >= 0 && r < mazeGrid.length && c >= 0 && c < mazeGrid[0].length) {
    if (mazeGrid[r][c] === 0) {
      if (isDraggingStart && (r !== mazeGoal.r || c !== mazeGoal.c)) {
        mazeStart = { r, c }
        mazeResetState()
      } else if (isDraggingGoal && (r !== mazeStart.r || c !== mazeStart.c)) {
        mazeGoal = { r, c }
        mazeResetState()
      }
    }
  }
})

window.addEventListener('mouseup', function() {
  isDraggingStart = false
  isDraggingGoal = false
})

// canvas click = toggle wall
// (Replaced by mousedown/mousemove logic above)
/*
document.getElementById('maze-canvas').addEventListener('click', function(e) {
  ...
})
*/

// Init maze
mazeGrid = generateGrid(mazeSize)
mazeDraw()

// ════════════════════════════════════════════════
//  COMPARE STATE
// ════════════════════════════════════════════════
const CSIZE = 12
let compGrid = [], compTimer = null
let compA = freshComp(), compB = freshComp(), compC = freshComp(), compD = freshComp()
const CSTART = { r:1, c:1 }, CGOAL = { r:CSIZE-2, c:CSIZE-2 }

function freshComp() {
  return { closed:new Set(), frontier:{open:new Set(),path:new Set()},
           state:null, done:false, t0:0, metrics:{},
           stats:{nodes:0,front:0,iter:0,time:0,path:0} }
}

function compDrawA() { drawGrid(document.getElementById('comp-canvas-a'), compGrid, CSTART, CGOAL, compA.closed, compA.frontier.open, compA.frontier.path, null, null, compA.metrics) }
function compDrawB() { drawGrid(document.getElementById('comp-canvas-b'), compGrid, CSTART, CGOAL, compB.closed, compB.frontier.open, compB.frontier.path, 'rgba(56,189,248,.4)', '#dbeafe', compB.metrics) }
function compDrawC() { drawGrid(document.getElementById('comp-canvas-c'), compGrid, CSTART, CGOAL, compC.closed, compC.frontier.open, compC.frontier.path, 'rgba(244,114,182,.4)', '#fdf2f8', compC.metrics) }
function compDrawD() { drawGrid(document.getElementById('comp-canvas-d'), compGrid, CSTART, CGOAL, compD.closed, compD.frontier.open, compD.frontier.path, 'rgba(251,191,36,.4)', '#fffbeb', compD.metrics) }

function compStepA() {
  if (compA.done||!compA.state) return
  const r = stepAstar(compA.state, compGrid, CGOAL, compA.closed, compA.frontier, compA.metrics)
  compA.stats.nodes = compA.closed.size; compA.stats.iter++
  compA.stats.front = compA.frontier.open.size
  compA.stats.time  = Math.round(performance.now()-compA.t0)
  if (r.done) { compA.stats.path = compA.frontier.path.size; compA.done = true }
}
function compStepB() {
  if (compB.done||!compB.state) return
  const r = stepBFS(compB.state, compGrid, CGOAL, compB.closed, compB.frontier, compB.metrics)
  compB.stats.nodes = compB.closed.size; compB.stats.iter++
  compB.stats.front = compB.frontier.open.size
  compB.stats.time  = Math.round(performance.now()-compB.t0)
  if (r.done) { compB.stats.path = compB.frontier.path.size; compB.done = true }
}
function compStepC() {
  if (compC.done||!compC.state) return
  const r = stepDFS(compC.state, compGrid, CGOAL, compC.closed, compC.frontier, compC.metrics)
  compC.stats.nodes = compC.closed.size; compC.stats.iter++
  compC.stats.front = compC.frontier.open.size
  compC.stats.time  = Math.round(performance.now()-compC.t0)
  if (r.done) { compC.stats.path = compC.frontier.path.size; compC.done = true }
}
function compStepD() {
  if (compD.done||!compD.state) return
  const r = stepGreedy(compD.state, compGrid, CGOAL, compD.closed, compD.frontier, compD.metrics)
  compD.stats.nodes = compD.closed.size; compD.stats.iter++
  compD.stats.front = compD.frontier.open.size
  compD.stats.time  = Math.round(performance.now()-compD.t0)
  if (r.done) { compD.stats.path = compD.frontier.path.size; compD.done = true }
}

function compUpdateLive() {
  const set = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=v }
  set('c-iter-a',  compA.stats.iter);  set('c-iter-b',  compB.stats.iter); set('c-iter-c',  compC.stats.iter); set('c-iter-d',  compD.stats.iter)
  set('c-nodes-a', compA.stats.nodes); set('c-nodes-b', compB.stats.nodes); set('c-nodes-c', compC.stats.nodes); set('c-nodes-d', compD.stats.nodes)
  set('c-front-a', compA.stats.front); set('c-front-b', compB.stats.front); set('c-front-c', compC.stats.front); set('c-front-d', compD.stats.front)
  set('c-time-a',  compA.stats.time);  set('c-time-b',  compB.stats.time); set('c-time-c',  compC.stats.time); set('c-time-d',  compD.stats.time)
  set('c-iter-la', compA.stats.iter);  set('c-iter-lb', compB.stats.iter); set('c-iter-lc', compC.stats.iter); set('c-iter-ld', compD.stats.iter)
}

function compBuildTable() {
  const stats = [
    { name: 'A*', s: compA.stats },
    { name: 'BPA', s: compB.stats },
    { name: 'BPP', s: compC.stats },
    { name: 'Voraz', s: compD.stats }
  ]
  
  const metrics = [
    { label: 'Nodos Explorados', key: 'nodes' },
    { label: 'Tiempo (ms)', key: 'time' },
    { label: 'Long. Camino', key: 'path' },
    { label: 'Máx. Frontera', key: 'front' }
  ]

  document.getElementById('comp-tbody').innerHTML = metrics.map(m => {
    const vals = stats.map(st => st.s[m.key])
    const bestVal = Math.min(...vals)
    return `<tr>
      <td>${m.label}</td>
      ${stats.map(st => `<td class="td-mono ${st.s[m.key] === bestVal ? 'ca' : ''}">${st.s[m.key]}</td>`).join('')}
      <td>—</td>
      <td>${stats.find(st => st.s[m.key] === bestVal).name}</td>
    </tr>`
  }).join('')
  document.getElementById('comp-results').style.display = 'block'
}

window.compNewMaze = function() {
  clearInterval(compTimer)
  // Retry until a path exists
  let attempts = 0
  do {
    compGrid = generateGrid(CSIZE, false)
    attempts++
    // Check if goal is reachable from start using a simple BFS check
    const check = initBFS(CSTART)
    const closed = new Set(), frontier = { open: new Set(), path: new Set() }
    let res = { done: false }
    while (!res.done) {
      res = stepBFS(check, compGrid, CGOAL, closed, frontier)
    }
    if (res.found) break
  } while (attempts < 10)
  
  compA = freshComp(); compB = freshComp(); compC = freshComp(); compD = freshComp()
  document.getElementById('comp-results').style.display = 'none'
  compUpdateLive()
  compDrawA(); compDrawB(); compDrawC(); compDrawD()
}

window.compReset = function() {
  clearInterval(compTimer)
  compA = freshComp(); compB = freshComp(); compC = freshComp(); compD = freshComp()
  document.getElementById('comp-results').style.display = 'none'
  compUpdateLive()
  if (compGrid.length) { compDrawA(); compDrawB(); compDrawC(); compDrawD() }
}

window.compRun = function() {
  if (!compGrid.length) compNewMaze()
  compReset()
  compA.state = initAstar(CSTART, CGOAL); compA.t0 = performance.now()
  compB.state = initBFS(CSTART);          compB.t0 = performance.now()
  compC.state = initDFS(CSTART);          compC.t0 = performance.now()
  compD.state = initGreedy(CSTART, CGOAL); compD.t0 = performance.now()
  
  const spd = parseInt(document.getElementById('comp-speed').value)
  const delay = Math.max(25, 250 - spd * 22)
  compTimer = setInterval(() => {
    compStepA(); compStepB(); compStepC(); compStepD()
    compDrawA(); compDrawB(); compDrawC(); compDrawD()
    compUpdateLive()
    if (compA.done && compB.done && compC.done && compD.done) {
      clearInterval(compTimer)
      compBuildTable()
    }
  }, delay)
}

// ════════════════════════════════════════════════
//  TTT STATE
// ════════════════════════════════════════════════
let tttBoard    = Array(9).fill(null)
let tttCurrent  = 'X'
let tttOver     = false
let tttMode     = 'minimax'
let tttHuman    = 'X'
let tttAI       = 'O'
let tttScores   = { X:0, O:0, draw:0 }
let tttLog      = []
let tttLastMove = null
let tttMmNodes  = 0, tttAbNodes = 0, tttAbPrunes = 0

const TTT_INFO = {
  minimax:   { t:'Minimax',         d:'Evalúa todos los estados. MAX maximiza, MIN minimiza.',       m:'Completo: Sí | Óptimo: Sí | O(b^m)' },
  alphabeta: { t:'Alpha-Beta',      d:'Minimax con poda α/β. Descarta ramas que no cambian la decisión.', m:'Completo: Sí | Óptimo: Sí | O(b^m/2)' },
  human:     { t:'Humano vs Humano',d:'Dos jugadores, sin IA. X empieza primero.',                   m:'Sin algoritmo de IA activo.' },
}

function tttRenderBoard(winCells=[]) {
  const board = document.getElementById('ttt-board')
  if (!board) return
  board.innerHTML = ''
  tttBoard.forEach((cell, i) => {
    const btn = document.createElement('button')
    btn.className = 'ttt-cell' +
      (cell ? ' taken' : '') +
      (cell==='X' ? ' sx' : cell==='O' ? ' so' : '') +
      (winCells.includes(i) ? ' winning' : '')
    btn.textContent = cell || ''
    btn.disabled = !!cell || tttOver || (tttMode!=='human' && tttCurrent===tttAI)
    btn.addEventListener('click', () => tttHumanMove(i))
    board.appendChild(btn)
  })
}
window.tttRenderBoard = tttRenderBoard

function tttUpdateScores() {
  ['x','o','d'].forEach(k => {
    const key = k==='x'?'X':k==='o'?'O':'draw'
    const el1 = document.getElementById(`sc-${k}`)
    const el2 = document.getElementById(`m-sc-${k}`)
    if (el1) el1.textContent = tttScores[key]
    if (el2) el2.textContent = tttScores[key]
  })
}

function tttAddLog(who, pos, sym) {
  const row=Math.floor(pos/3)+1, col=(pos%3)+1
  tttLog.push({ who, pos, sym, row, col })
  tttLastMove = pos
  const logEl = document.getElementById('ttt-log')
  if (logEl) {
    logEl.innerHTML = [...tttLog].reverse().slice(0,12).map(e =>
      `<div class="move-entry"><span class="me-sym">[${e.sym}]</span> ${e.who} → (${e.row},${e.col})</div>`
    ).join('')
  }
}

function tttSetStatus(msg, cls='') {
  const el = document.getElementById('ttt-status')
  if (!el) return
  el.textContent = msg
  el.className = 'ttt-status ' + cls
}

function tttEndGame(result, board) {
  tttOver = true
  const wc = getWinCells(board)
  tttRenderBoard(wc)
  if (result==='draw') {
    tttScores.draw++; tttSetStatus('¡Empate! 🤝', 'draw')
  } else if (result===tttHuman) {
    tttScores[tttHuman]++; tttSetStatus('¡Ganaste! 🎉', 'win')
  } else {
    tttScores[tttAI]++; tttSetStatus('¡La IA ganó! 🤖', 'lose')
  }
  tttUpdateScores()
}

function tttHumanMove(idx) {
  if (tttOver || tttBoard[idx]) return
  if (tttMode!=='human' && tttCurrent!==tttHuman) return
  tttBoard[idx] = tttCurrent
  const who = tttMode==='human' ? (tttCurrent==='X'?'Jugador 1':'Jugador 2') : 'Humano'
  tttAddLog(who, idx, tttCurrent)
  const result = checkWinner(tttBoard)
  if (result) { tttEndGame(result, tttBoard); return }
  tttCurrent = tttCurrent==='X'?'O':'X'
  tttRenderBoard()
  if (tttMode!=='human') {
    tttSetStatus('IA pensando…', 'thinking')
    setTimeout(() => tttAiMove([...tttBoard], tttCurrent), 300)
  } else {
    tttSetStatus(`Turno de ${tttCurrent}`)
  }
}

function tttAiMove(board, player) {
  const t0   = performance.now()
  const mmRes = minimax([...board], tttAI, tttAI, 0)
  const abRes = alphaBeta([...board], tttAI, -Infinity, Infinity, true, tttAI)
  const best  = tttMode==='alphabeta' ? abRes.move : mmRes.move
  const ms    = Math.round(performance.now()-t0)

  tttMmNodes   = mmRes.nodes
  tttAbNodes   = abRes.nodes
  tttAbPrunes  = abRes.prunes

  document.getElementById('t-nodes').textContent  = mmRes.nodes
  document.getElementById('t-prunes').textContent = abRes.prunes
  document.getElementById('t-depth').textContent  = board.filter(x=>x).length+1
  document.getElementById('t-time').textContent   = ms

  tttBoard[best] = tttAI
  tttAddLog('IA', best, tttAI)
  tttDrawTree()
  tttUpdateAnalysis(best, mmRes.nodes, abRes.nodes, abRes.prunes)

  const result = checkWinner(tttBoard)
  if (result) { tttEndGame(result, tttBoard); return }
  tttCurrent = tttHuman
  tttRenderBoard()
  tttSetStatus('Tu turno — haz clic en una celda')
}

function tttUpdateAnalysis(move, nm, nab, pab) {
  const r = Math.floor(move/3)+1, c = (move%3)+1
  const reduc = nm>0 ? Math.round((1-nab/nm)*100) : 0
  document.getElementById('ttt-analysis').style.display = 'grid'
  document.getElementById('ttt-mm-analysis').innerHTML =
    `<b style="color:var(--accent)">Movimiento:</b> celda (${r},${c})<br>
     <b>Nodos evaluados:</b> ${nm}<br>
     <b>Garantía:</b> <span style="color:var(--accent)">✓ Óptimo garantizado</span><br>
     <em style="font-size:.75rem">Explora todo el árbol sin optimizar.</em>`
  document.getElementById('ttt-ab-analysis').innerHTML =
    `<b style="color:var(--accent2)">Movimiento:</b> celda (${r},${c})<br>
     <b>Nodos evaluados:</b> ${nab}<br>
     <b>Ramas podadas:</b> ${pab} (~${reduc}% menos)<br>
     <b>Garantía:</b> <span style="color:var(--accent2)">✓ Mismo resultado</span><br>
     <em style="font-size:.75rem">Descarta ramas que no cambian la decisión.</em>`

  // compare table
  const redStr = `${reduc}% menos`
  const rows = [
    ['Nodos Evaluados', nm, nab, redStr, nab<=nm?'ab':'mm'],
    ['Ramas Podadas', 'N/A', pab, '—', 'ab'],
    ['Garantía Óptima', 'Sí', 'Sí', 'Igual', 'tie'],
    ['Complejidad', 'O(b^m)', 'O(b^m/2)', '—', 'ab'],
  ]
  document.getElementById('ttt-cmp-tbody').innerHTML = rows.map(([m,mv,abv,diff,w]) =>
    `<tr>
      <td>${m}</td>
      <td class="td-mono">${mv}</td>
      <td class="td-mono">${abv}</td>
      <td class="td-mono">${diff}</td>
      <td>${w==='ab'?'<span class="bdg-b">✦ Alpha-Beta</span>':w==='mm'?'<span class="bdg-g">✦ Minimax</span>':'<span class="bdg-t">= Empate</span>'}</td>
    </tr>`
  ).join('')
  document.getElementById('ttt-cmp-card').style.display = 'block'
}

// ── TTT Tree ──
function tttDrawTree() {
  const canvas = document.getElementById('ttt-tree')
  if (!canvas) return
  const wrap = canvas.parentElement
  const W = wrap ? Math.max(200, wrap.clientWidth-2) : 300
  const H = Math.round(W * 0.82)
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0,0,W,H)
  ctx.fillStyle = '#1c2333'; ctx.fillRect(0,0,W,H)

  const NR = Math.max(10, Math.round(W*0.052))

  function node(x,y,label,color,score) {
    ctx.beginPath(); ctx.arc(x,y,NR,0,Math.PI*2)
    ctx.fillStyle=color; ctx.fill()
    ctx.strokeStyle='rgba(255,255,255,.1)'; ctx.lineWidth=1.5; ctx.stroke()
    ctx.fillStyle='#fff'
    ctx.font=`bold ${Math.max(8,NR-5)}px Sora,sans-serif`
    ctx.textAlign='center'; ctx.textBaseline='middle'
    ctx.fillText(label,x,y)
    if(score!==undefined){
      ctx.fillStyle='rgba(255,255,255,.4)'
      ctx.font=`${Math.max(7,NR-7)}px monospace`
      ctx.fillText(`f=${score}`,x,y+NR+9)
    }
  }
  function edge(x1,y1,x2,y2){
    ctx.beginPath();ctx.moveTo(x1,y1+NR);ctx.lineTo(x2,y2-NR)
    ctx.strokeStyle='rgba(100,116,139,.4)';ctx.lineWidth=1;ctx.stroke()
  }

  const rootRes = alphaBeta([...tttBoard], tttAI, -Infinity, Infinity, true, tttAI)
  const rx=W/2, ry=NR+6
  node(rx,ry,'MAX','#065f46',rootRes.score)

  const moves1 = tttBoard.map((v,i)=>v===null?i:-1).filter(i=>i>=0).slice(0,5)
  if (!moves1.length) {
    ctx.fillStyle='rgba(100,116,139,.7)';ctx.font='12px Sora,sans-serif'
    ctx.textAlign='center';ctx.textBaseline='middle'
    ctx.fillText('Partida terminada',W/2,H/2); return
  }
  const y1=Math.round(H*.42), step1=W/(moves1.length+1)
  moves1.forEach((m,idx)=>{
    const nb=[...tttBoard];nb[m]=tttAI
    const r1=alphaBeta(nb,tttAI,-Infinity,Infinity,false,tttHuman)
    const x1=step1*(idx+1)
    edge(rx,ry,x1,y1)
    node(x1,y1,`c${m+1}`,m===tttLastMove?'#10b981':'#1e3a5f',r1.score)
    const opp2=nb.map((v,i)=>v===null?i:-1).filter(i=>i>=0).slice(0,2)
    const y2=Math.round(H*.82), step2=(step1*.88)/(opp2.length+1)
    opp2.forEach((m2,idx2)=>{
      const nb2=[...nb];nb2[m2]=tttHuman
      const r2=alphaBeta(nb2,tttAI,-Infinity,Infinity,true,tttAI)
      const x2=x1-step1*.44+step2*(idx2+1)
      edge(x1,y1,x2,y2)
      node(x2,y2,`p${m2+1}`,'#374151',r2.score)
    })
  })
  ctx.fillStyle='rgba(100,116,139,.6)'
  ctx.font=`${Math.max(7,NR-8)}px Sora,sans-serif`
  ctx.textAlign='left';ctx.textBaseline='bottom'
  ctx.fillText('🟢 Elegido  🔵 Alt.  ⬛ Rival',6,H-4)

  document.getElementById('ttt-tree-info').textContent =
    tttMmNodes>0
      ? `Minimax: ${tttMmNodes} nodos | Alpha-Beta: ${tttAbNodes} nodos | ${tttAbPrunes} podas`
      : 'El árbol aparece con el primer movimiento de la IA.'
}

window.tttSelectMode = function(mode, btn) {
  tttMode = mode
  document.querySelectorAll('#ttt-sidebar .pill').forEach(p=>p.classList.remove('active'))
  btn.classList.add('active')
  document.getElementById('ttt-algo-tag').textContent =
    mode==='minimax'?'Minimax':mode==='alphabeta'?'Alpha-Beta':'H vs H'
  const info = TTT_INFO[mode]
  document.getElementById('ttt-info-box').innerHTML =
    `<strong>${info.t}</strong>${info.d}<br><br><span style="font-family:'Space Mono',monospace;font-size:.7rem">${info.m}</span>`
  tttRestart()
}

window.tttRestart = function() {
  tttHuman   = document.getElementById('ttt-sym').value
  tttAI      = tttHuman==='X'?'O':'X'
  tttBoard   = Array(9).fill(null)
  tttCurrent = 'X'
  tttOver    = false
  tttLog     = []
  tttLastMove = null
  tttMmNodes = 0; tttAbNodes = 0; tttAbPrunes = 0
  document.getElementById('ttt-log').innerHTML = '<div class="move-entry">— Sin movimientos —</div>'
  document.getElementById('ttt-analysis').style.display = 'none'
  document.getElementById('ttt-cmp-card').style.display = 'none'
  document.getElementById('t-nodes').textContent  = 0
  document.getElementById('t-prunes').textContent = '—'
  document.getElementById('t-depth').textContent  = 0
  document.getElementById('t-time').textContent   = 0
  tttRenderBoard()
  tttSetStatus('Tu turno — haz clic en una celda')
  tttDrawTree()
  if (tttMode!=='human' && tttCurrent===tttAI) setTimeout(()=>tttAiMove([...tttBoard],tttAI),350)
}

window.tttResetScores = function() {
  tttScores = { X:0, O:0, draw:0 }
  tttUpdateScores()
}

// Init TTT
tttRenderBoard()
tttDrawTree()
tttUpdateScores()
