// ── Maze generation: Recursive Backtracker or Empty ──
export function generateGrid(size, empty = false) {
  const g = Array.from({ length: size }, () => Array(size).fill(empty ? 0 : 1))
  if (empty) {
    // Just add borders
    for (let i = 0; i < size; i++) {
      g[0][i] = 1; g[size-1][i] = 1
      g[i][0] = 1; g[i][size-1] = 1
    }
    return g
  }
  function carve(r, c) {
    g[r][c] = 0
    shuffle([[0,2],[0,-2],[2,0],[-2,0]]).forEach(([dr, dc]) => {
      const nr = r + dr, nc = c + dc
      if (nr > 0 && nr < size-1 && nc > 0 && nc < size-1 && g[nr][nc] === 1) {
        g[r+dr/2][c+dc/2] = 0; carve(nr, nc)
      }
    })
  }
  carve(1, 1)
  g[1][1] = 0; g[size-2][size-2] = 0
  
  // Connect the goal to the nearest empty cell to ensure a path exists
  // The recursive backtracker usually covers most of the grid, but we must be 100% sure.
  let r = size-2, c = size-2
  if (g[r-1][c] === 1 && g[r][c-1] === 1) {
    // Goal is isolated, force a connection
    if (Math.random() > 0.5) g[r-1][c] = 0
    else g[r][c-1] = 0
  }
  return g
}

function shuffle(a) {
  for (let i = a.length-1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]
  }
  return a
}

export function neighbors(r, c, grid) {
  return [[r-1,c],[r+1,c],[r,c-1],[r,c+1]]
    .filter(([nr,nc]) => nr>=0 && nr<grid.length && nc>=0 && nc<grid[0].length && grid[nr][nc]===0)
}

export function manhattan(r, c, goal) { return Math.abs(r-goal.r)+Math.abs(c-goal.c) }

// ── BFS ──
export function initBFS(start) {
  const k = `${start.r},${start.c}`
  return { queue:[{r:start.r,c:start.c,path:[k],g:0}], visited:new Set([k]) }
}
export function stepBFS(st, grid, goal, closed, frontier, metricsMap) {
  if (!st.queue.length) return { done:true, found:false }
  const node = st.queue.shift()
  const k = `${node.r},${node.c}`
  closed.add(k)
  if (metricsMap) metricsMap[k] = { g: node.g }
  if (node.r===goal.r && node.c===goal.c) {
    node.path.forEach(p=>frontier.path.add(p))
    return { done:true, found:true }
  }
  for (const [nr,nc] of neighbors(node.r,node.c,grid)) {
    const nk=`${nr},${nc}`
    if (!st.visited.has(nk)) {
      st.visited.add(nk); frontier.open.add(nk)
      st.queue.push({r:nr,c:nc,path:[...node.path,nk],g:node.g+1})
      if (metricsMap) metricsMap[nk] = { g: node.g + 1 }
    }
  }
  frontier.open.forEach(k=>{ if(closed.has(k)) frontier.open.delete(k) })
  return { done:false }
}

// ── DFS ──
export function initDFS(start) {
  const k = `${start.r},${start.c}`
  return { stack:[{r:start.r,c:start.c,visited:new Set([k])}] }
}
export function stepDFS(st, grid, goal, closed, frontier, metricsMap) {
  if (!st.stack.length) return { done:true, found:false }
  const node = st.stack.pop()
  const k = `${node.r},${node.c}`
  closed.add(k)
  if (metricsMap) metricsMap[k] = { g: node.visited.size - 1 }
  if (node.r===goal.r && node.c===goal.c) {
    node.visited.forEach(p=>frontier.path.add(p))
    return { done:true, found:true }
  }
  for (const [nr,nc] of neighbors(node.r,node.c,grid)) {
    const nk=`${nr},${nc}`
    if (!node.visited.has(nk)) {
      const nv=new Set(node.visited); nv.add(nk); frontier.open.add(nk)
      st.stack.push({r:nr,c:nc,visited:nv})
      if (metricsMap) metricsMap[nk] = { g: nv.size - 1 }
    }
  }
  frontier.open.forEach(k=>{ if(closed.has(k)) frontier.open.delete(k) })
  return { done:false }
}

// ── A* ──
export function initAstar(start, goal) {
  const k = `${start.r},${start.c}`
  const h = manhattan(start.r, start.c, goal)
  return { open:[{r:start.r,c:start.c,g:0,f:h,h:h,key:k}], openMap:{[k]:0}, closed:new Set(), parentMap:{} }
}
export function stepAstar(st, grid, goal, closed, frontier, metricsMap) {
  if (!st.open.length) return { done:true, found:false }
  st.open.sort((a,b)=>a.f-b.f)
  const node = st.open.shift(); delete st.openMap[node.key]
  st.closed.add(node.key); closed.add(node.key)
  if (metricsMap) metricsMap[node.key] = { f: node.f, g: node.g, h: node.h }
  if (node.r===goal.r && node.c===goal.c) {
    let cur=node.key; while(cur){frontier.path.add(cur);cur=st.parentMap[cur]}
    return { done:true, found:true }
  }
  for (const [nr,nc] of neighbors(node.r,node.c,grid)) {
    const nk=`${nr},${nc}`; if(st.closed.has(nk)) continue
    const ng=node.g+1
    const nh=manhattan(nr,nc,goal)
    const nf=ng+nh
    if(!(nk in st.openMap)||ng<st.openMap[nk]){
      st.openMap[nk]=ng; st.parentMap[nk]=node.key; frontier.open.add(nk)
      st.open.push({r:nr,c:nc,g:ng,f:nf,h:nh,key:nk})
      if (metricsMap) metricsMap[nk] = { f: nf, g: ng, h: nh }
    }
  }
  frontier.open.forEach(k=>{ if(closed.has(k)) frontier.open.delete(k) })
  return { done:false }
}

// ── Greedy ──
export function initGreedy(start, goal) {
  const k = `${start.r},${start.c}`
  const h = manhattan(start.r, start.c, goal)
  return { open:[{r:start.r,c:start.c,h:h,key:k}], visited:new Set([k]), parentMap:{} }
}
export function stepGreedy(st, grid, goal, closed, frontier, metricsMap) {
  if (!st.open.length) return { done:true, found:false }
  st.open.sort((a,b)=>a.h-b.h)
  const node = st.open.shift(); closed.add(node.key)
  if (metricsMap) metricsMap[node.key] = { h: node.h }
  if (node.r===goal.r && node.c===goal.c) {
    let cur=node.key; while(cur){frontier.path.add(cur);cur=st.parentMap[cur]}
    return { done:true, found:true }
  }
  for (const [nr,nc] of neighbors(node.r,node.c,grid)) {
    const nk=`${nr},${nc}`
    if (!st.visited.has(nk)){
      const nh = manhattan(nr,nc,goal)
      st.visited.add(nk); st.parentMap[nk]=node.key; frontier.open.add(nk)
      st.open.push({r:nr,c:nc,h:nh,key:nk})
      if (metricsMap) metricsMap[nk] = { h: nh }
    }
  }
  frontier.open.forEach(k=>{ if(closed.has(k)) frontier.open.delete(k) })
  return { done:false }
}
