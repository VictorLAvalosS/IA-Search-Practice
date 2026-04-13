export const WIN_LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]

export function checkWinner(b) {
  for (const [a,c,d] of WIN_LINES) if (b[a] && b[a]===b[c] && b[a]===b[d]) return b[a]
  return b.every(x=>x!==null) ? 'draw' : null
}

export function getWinCells(b) {
  for (const [a,c,d] of WIN_LINES) if (b[a] && b[a]===b[c] && b[a]===b[d]) return [a,c,d]
  return []
}

export function minimax(board, aiSym, player, depth) {
  const r = checkWinner(board)
  if (r===aiSym)   return { score:10-depth, nodes:1, move:-1 }
  if (r==='draw')  return { score:0,        nodes:1, move:-1 }
  if (r)           return { score:depth-10, nodes:1, move:-1 }
  const moves = board.map((v,i)=>v===null?i:-1).filter(i=>i>=0)
  if (!moves.length) return { score:0, nodes:1, move:-1 }
  const opp = player==='X'?'O':'X'
  let best = player===aiSym?-Infinity:Infinity, bestMove=moves[0], nodes=1
  for (const m of moves) {
    const nb=[...board]; nb[m]=player
    const res=minimax(nb,aiSym,opp,depth+1); nodes+=res.nodes
    if (player===aiSym){ if(res.score>best){best=res.score;bestMove=m} }
    else               { if(res.score<best){best=res.score;bestMove=m} }
  }
  return { score:best, nodes, move:bestMove }
}

export function alphaBeta(board, aiSym, alpha, beta, isMax, player) {
  const r = checkWinner(board)
  if (r===aiSym)  return { score:10,  nodes:1, move:-1, prunes:0 }
  if (r==='draw') return { score:0,   nodes:1, move:-1, prunes:0 }
  if (r)          return { score:-10, nodes:1, move:-1, prunes:0 }
  const moves = board.map((v,i)=>v===null?i:-1).filter(i=>i>=0)
  if (!moves.length) return { score:0, nodes:1, move:-1, prunes:0 }
  const opp = player==='X'?'O':'X'
  let best=isMax?-Infinity:Infinity, bestMove=moves[0], nodes=1, prunes=0
  for (const m of moves) {
    const nb=[...board]; nb[m]=player
    const res=alphaBeta(nb,aiSym,alpha,beta,!isMax,opp); nodes+=res.nodes; prunes+=res.prunes
    if (isMax){ if(res.score>best){best=res.score;bestMove=m} alpha=Math.max(alpha,best) }
    else      { if(res.score<best){best=res.score;bestMove=m} beta=Math.min(beta,best)   }
    if (beta<=alpha){ prunes++; break }
  }
  return { score:best, nodes, move:bestMove, prunes }
}
