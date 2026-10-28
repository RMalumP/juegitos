// Rival por ordenador para Ajedrez y Damas.
//
// Los motores (ChessEngine y CheckersEngine) son funciones puras sobre una
// copia del tablero, independientes de la interfaz, para poder probarlos
// aparte. Al final del archivo está la integración con la página.

// ===================== MOTOR DE AJEDREZ =====================
// Tablero plano de 64 casillas con las mismas letras que el juego
// ('P','n',' '...); índice = fila*8 + columna, fila 0 = octava fila.
const ChessEngine = (() => {
  const VAL = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };
  // Tablas de posición (punto de vista de las blancas, fila 0 = fila 8).
  // prettier-ignore
  const PST = {
    P: [0,0,0,0,0,0,0,0, 50,50,50,50,50,50,50,50, 10,10,20,30,30,20,10,10, 5,5,10,25,25,10,5,5,
        0,0,0,20,20,0,0,0, 5,-5,-10,0,0,-10,-5,5, 5,10,10,-20,-20,10,10,5, 0,0,0,0,0,0,0,0],
    N: [-50,-40,-30,-30,-30,-30,-40,-50, -40,-20,0,0,0,0,-20,-40, -30,0,10,15,15,10,0,-30, -30,5,15,20,20,15,5,-30,
        -30,0,15,20,20,15,0,-30, -30,5,10,15,15,10,5,-30, -40,-20,0,5,5,0,-20,-40, -50,-40,-30,-30,-30,-30,-40,-50],
    B: [-20,-10,-10,-10,-10,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,10,10,5,0,-10, -10,5,5,10,10,5,5,-10,
        -10,0,10,10,10,10,0,-10, -10,10,10,10,10,10,10,-10, -10,5,0,0,0,0,5,-10, -20,-10,-10,-10,-10,-10,-10,-20],
    R: [0,0,0,0,0,0,0,0, 5,10,10,10,10,10,10,5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5,
        -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, -5,0,0,0,0,0,0,-5, 0,0,0,5,5,0,0,0],
    Q: [-20,-10,-10,-5,-5,-10,-10,-20, -10,0,0,0,0,0,0,-10, -10,0,5,5,5,5,0,-10, -5,0,5,5,5,5,0,-5,
        0,0,5,5,5,5,0,-5, -10,5,5,5,5,5,0,-10, -10,0,5,0,0,0,0,-10, -20,-10,-10,-5,-5,-10,-10,-20],
    K: [-30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30, -30,-40,-40,-50,-50,-40,-40,-30,
        -20,-30,-30,-40,-40,-30,-30,-20, -10,-20,-20,-20,-20,-20,-20,-10, 20,20,0,0,0,0,20,20, 20,30,10,0,0,10,30,20],
  };
  const MATE = 100000;
  const KNIGHT = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  const KING = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  const DIAG = [[-1,-1],[-1,1],[1,-1],[1,1]];
  const ORTHO = [[-1,0],[1,0],[0,-1],[0,1]];

  const colorOf = (p) => (p === " " ? null : p === p.toUpperCase() ? "w" : "b");
  const inB = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

  // ¿Ataca algún pieza del color `by` la casilla (r,c)?
  function attacked(B, r, c, by) {
    const own = (t) => (by === "w" ? t : t.toLowerCase());
    const pr = by === "w" ? r + 1 : r - 1;
    for (const dc of [-1, 1])
      if (inB(pr, c + dc) && B[pr * 8 + c + dc] === own("P")) return true;
    for (const [dr, dc] of KNIGHT)
      if (inB(r + dr, c + dc) && B[(r + dr) * 8 + c + dc] === own("N")) return true;
    for (const [dr, dc] of KING)
      if (inB(r + dr, c + dc) && B[(r + dr) * 8 + c + dc] === own("K")) return true;
    for (const [dirs, a, b] of [[DIAG, "B", "Q"], [ORTHO, "R", "Q"]])
      for (const [dr, dc] of dirs)
        for (let i = 1; i < 8; i++) {
          const tr = r + dr * i, tc = c + dc * i;
          if (!inB(tr, tc)) break;
          const p = B[tr * 8 + tc];
          if (p === " ") continue;
          if (p === own(a) || p === own(b)) return true;
          break;
        }
    return false;
  }

  function kingSquare(B, side) {
    return B.indexOf(side === "w" ? "K" : "k");
  }
  function inCheck(S, side) {
    const k = kingSquare(S.B, side);
    return k >= 0 && attacked(S.B, k >> 3, k & 7, side === "w" ? "b" : "w");
  }

  // Movimientos pseudo-legales; `capturesOnly` para la búsqueda de quietud.
  function pseudo(S, capturesOnly) {
    const { B, turn: side } = S, moves = [];
    const enemy = side === "w" ? "b" : "w";
    const push = (from, to, flag, promo) =>
      moves.push({ from, to, flag: flag || "", promo: promo || null, cap: B[to] });
    for (let i = 0; i < 64; i++) {
      const p = B[i];
      if (p === " " || colorOf(p) !== side) continue;
      const r = i >> 3, c = i & 7, t = p.toUpperCase();
      if (t === "P") {
        const up = side === "w" ? -1 : 1, last = side === "w" ? 0 : 7;
        const r1 = r + up;
        if (inB(r1, c) && B[r1 * 8 + c] === " " && (!capturesOnly || r1 === last)) {
          push(i, r1 * 8 + c, "", r1 === last ? "Q" : null);
          const start = side === "w" ? 6 : 1;
          if (!capturesOnly && r === start && B[(r + 2 * up) * 8 + c] === " ")
            push(i, (r + 2 * up) * 8 + c, "double");
        }
        for (const dc of [-1, 1]) {
          if (!inB(r1, c + dc)) continue;
          const to = r1 * 8 + c + dc;
          if (colorOf(B[to]) === enemy) push(i, to, "capture", r1 === last ? "Q" : null);
          else if (S.ep === to) push(i, to, "ep");
        }
      } else if (t === "N" || t === "K") {
        for (const [dr, dc] of t === "N" ? KNIGHT : KING) {
          if (!inB(r + dr, c + dc)) continue;
          const to = (r + dr) * 8 + c + dc, q = B[to];
          if (q === " " ? !capturesOnly : colorOf(q) === enemy) push(i, to);
        }
        if (t === "K" && !capturesOnly) {
          const row = side === "w" ? 7 : 0, R = side === "w" ? "R" : "r";
          const [kk, qq] = side === "w" ? ["K", "Q"] : ["k", "q"];
          if (r === row && c === 4 && !attacked(B, row, 4, enemy)) {
            if (S.castling[kk] && B[row * 8 + 5] === " " && B[row * 8 + 6] === " " &&
                B[row * 8 + 7] === R && !attacked(B, row, 5, enemy))
              push(i, row * 8 + 6, "castle-k");
            if (S.castling[qq] && B[row * 8 + 3] === " " && B[row * 8 + 2] === " " &&
                B[row * 8 + 1] === " " && B[row * 8] === R && !attacked(B, row, 3, enemy))
              push(i, row * 8 + 2, "castle-q");
          }
        }
      } else {
        const dirs = t === "B" ? DIAG : t === "R" ? ORTHO : DIAG.concat(ORTHO);
        for (const [dr, dc] of dirs)
          for (let k = 1; k < 8; k++) {
            const tr = r + dr * k, tc = c + dc * k;
            if (!inB(tr, tc)) break;
            const to = tr * 8 + tc, q = B[to];
            if (q === " ") {
              if (!capturesOnly) push(i, to);
              continue;
            }
            if (colorOf(q) === enemy) push(i, to);
            break;
          }
      }
    }
    return moves;
  }

  function make(S, m) {
    const B = S.B, piece = B[m.from], side = S.turn;
    const undo = { piece, cap: B[m.to], ep: S.ep, castling: { ...S.castling }, epCap: -1 };
    B[m.to] = m.promo ? (side === "w" ? m.promo : m.promo.toLowerCase()) : piece;
    B[m.from] = " ";
    if (m.flag === "ep") {
      undo.epCap = (m.from & ~7) | (m.to & 7);
      undo.epPiece = B[undo.epCap];
      B[undo.epCap] = " ";
    }
    const row = m.from & ~7;
    if (m.flag === "castle-k") (B[row + 5] = B[row + 7]), (B[row + 7] = " ");
    if (m.flag === "castle-q") (B[row + 3] = B[row]), (B[row] = " ");
    S.ep = m.flag === "double" ? (m.from + m.to) >> 1 : null;
    const t = piece.toUpperCase();
    if (t === "K") side === "w" ? (S.castling.K = S.castling.Q = false) : (S.castling.k = S.castling.q = false);
    for (const sq of [m.from, m.to]) {
      if (sq === 63) S.castling.K = false;
      if (sq === 56) S.castling.Q = false;
      if (sq === 7) S.castling.k = false;
      if (sq === 0) S.castling.q = false;
    }
    S.turn = side === "w" ? "b" : "w";
    return undo;
  }
  function unmake(S, m, u) {
    const B = S.B;
    S.turn = S.turn === "w" ? "b" : "w";
    B[m.from] = u.piece;
    B[m.to] = u.cap;
    if (u.epCap >= 0) B[u.epCap] = u.epPiece;
    const row = m.from & ~7;
    if (m.flag === "castle-k") (B[row + 7] = B[row + 5]), (B[row + 5] = " ");
    if (m.flag === "castle-q") (B[row] = B[row + 3]), (B[row + 3] = " ");
    S.ep = u.ep;
    S.castling = u.castling;
  }

  function legal(S, capturesOnly) {
    const side = S.turn;
    return pseudo(S, capturesOnly).filter((m) => {
      const u = make(S, m), ok = !inCheck(S, side);
      unmake(S, m, u);
      return ok;
    });
  }

  // Evaluación desde el punto de vista del bando que mueve.
  function evaluate(S) {
    let score = 0;
    for (let i = 0; i < 64; i++) {
      const p = S.B[i];
      if (p === " ") continue;
      const t = p.toUpperCase();
      if (p === t) score += VAL[t] + PST[t][i];
      else score -= VAL[t] + PST[t][(7 - (i >> 3)) * 8 + (i & 7)];
    }
    return S.turn === "w" ? score : -score;
  }

  const victim = (m) => (m.cap !== " " ? VAL[m.cap.toUpperCase()] : m.flag === "ep" ? 100 : 0);
  function order(S, moves, first) {
    for (const m of moves)
      m.order =
        (first && m.from === first.from && m.to === first.to ? 1e6 : 0) +
        (m.promo ? 800 : 0) +
        (victim(m) ? 10 * victim(m) - VAL[S.B[m.from].toUpperCase()] / 10 + 1000 : 0);
    return moves.sort((a, b) => b.order - a.order);
  }

  class Timeout extends Error {}

  function bestMove(state, { depth = 3, timeMs = 1000, noise = 0 } = {}) {
    const S = {
      B: state.board.flat(),
      turn: state.turn,
      castling: { ...state.castling },
      ep: state.enPassant ? state.enPassant[0] * 8 + state.enPassant[1] : null,
    };
    const deadline = Date.now() + timeMs;
    let nodes = 0;

    function quiesce(alpha, beta, qd) {
      const stand = evaluate(S);
      if (stand >= beta) return beta;
      if (stand > alpha) alpha = stand;
      if (qd >= 6) return alpha;
      for (const m of order(S, legal(S, true))) {
        const u = make(S, m);
        const score = -quiesce(-beta, -alpha, qd + 1);
        unmake(S, m, u);
        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
      }
      return alpha;
    }
    function search(d, alpha, beta, ply) {
      if ((++nodes & 1023) === 0 && Date.now() > deadline) throw new Timeout();
      if (d <= 0) {
        // Justo tras la jugada candidata, detectar mate o ahogado aunque la
        // profundidad sea 1 (si no, el nivel fácil ahoga al rival ganando).
        if (ply === 1 && !legal(S).length) return inCheck(S, S.turn) ? -MATE + ply : 0;
        return quiesce(alpha, beta, 0);
      }
      const moves = legal(S);
      if (!moves.length) return inCheck(S, S.turn) ? -MATE + ply : 0;
      for (const m of order(S, moves)) {
        const u = make(S, m);
        const score = -search(d - 1, -beta, -alpha, ply + 1);
        unmake(S, m, u);
        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
      }
      return alpha;
    }

    const rootMoves = legal(S);
    if (!rootMoves.length) return null;
    let best = rootMoves[0];
    // Profundización iterativa: si se acaba el tiempo, vale la última
    // profundidad completada.
    for (let d = 1; d <= depth; d++) {
      try {
        let alpha = -Infinity, iterBest = null;
        for (const m of order(S, rootMoves, best)) {
          const u = make(S, m);
          let score;
          try {
            score = -search(d - 1, -Infinity, noise ? Infinity : -alpha, 1);
          } finally {
            unmake(S, m, u);
          }
          // Un poco de azar en los niveles fáciles para que no juegue siempre igual.
          if (noise) score += Math.random() * noise;
          if (score > alpha) (alpha = score), (iterBest = m);
        }
        best = iterBest || best;
        if (alpha > MATE - 100) break; // mate encontrado
      } catch (e) {
        if (!(e instanceof Timeout)) throw e;
        break;
      }
    }
    return {
      fr: best.from >> 3, fc: best.from & 7,
      tr: best.to >> 3, tc: best.to & 7,
      promo: best.promo,
    };
  }

  return { bestMove, _legal: (state) => legal(state) };
})();

// ===================== MOTOR DE DAMAS =====================
// Mismas reglas que el juego: los peones mueven y capturan solo hacia
// delante, las damas una casilla en cualquier diagonal, la captura es
// obligatoria y se encadena salvo que la pieza corone.
const CheckersEngine = (() => {
  const colorOf = (p) => (p === 1 || p === 3 ? 1 : p === 2 || p === 4 ? 2 : 0);
  const isKing = (p) => p === 3 || p === 4;
  const inB = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;

  function dirsOf(p) {
    if (isKing(p)) return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    return colorOf(p) === 1 ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
  }
  function jumps(B, r, c) {
    const p = B[r][c], out = [];
    for (const [dr, dc] of dirsOf(p)) {
      const mr = r + dr, mc = c + dc, jr = r + 2 * dr, jc = c + 2 * dc;
      if (inB(jr, jc) && B[jr][jc] === 0 && B[mr][mc] && colorOf(B[mr][mc]) !== colorOf(p))
        out.push({ fr: r, fc: c, r: jr, c: jc, capR: mr, capC: mc, type: "capture" });
    }
    return out;
  }
  // Aplica un paso y devuelve cómo deshacerlo.
  function step(B, s) {
    const piece = B[s.fr][s.fc], undo = { piece, cap: 0 };
    B[s.r][s.c] = piece;
    B[s.fr][s.fc] = 0;
    if (s.type === "capture") (undo.cap = B[s.capR][s.capC]), (B[s.capR][s.capC] = 0);
    undo.promoted = !isKing(piece) && (s.r === 0 || s.r === 7) && s.r === (colorOf(piece) === 1 ? 0 : 7);
    if (undo.promoted) B[s.r][s.c] = piece + 2;
    return undo;
  }
  function unstep(B, s, u) {
    B[s.fr][s.fc] = u.piece;
    B[s.r][s.c] = 0;
    if (s.type === "capture") B[s.capR][s.capC] = u.cap;
  }
  // Jugadas completas (una captura múltiple es una sola jugada de varios pasos).
  function moves(B, side) {
    const caps = [], quiet = [];
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        if (colorOf(B[r][c]) !== side) continue;
        for (const j of jumps(B, r, c)) extend(B, [j], caps);
        if (caps.length) continue;
        for (const [dr, dc] of dirsOf(B[r][c]))
          if (inB(r + dr, c + dc) && B[r + dr][c + dc] === 0)
            quiet.push([{ fr: r, fc: c, r: r + dr, c: c + dc, type: "move" }]);
      }
    return caps.length ? caps : quiet;
  }
  function extend(B, seq, out) {
    const last = seq[seq.length - 1], u = step(B, last);
    const more = u.promoted ? [] : jumps(B, last.r, last.c);
    if (!more.length) out.push(seq.slice());
    else for (const j of more) extend(B, seq.concat(j), out);
    unstep(B, last, u);
  }
  function evaluate(B, side) {
    let s = 0;
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++) {
        const p = B[r][c];
        if (!p) continue;
        const adv = colorOf(p) === 1 ? 7 - r : r;
        const v = isKing(p) ? 170 : 100 + adv * 4 + (c > 1 && c < 6 ? 3 : 0);
        s += colorOf(p) === side ? v : -v;
      }
    return s;
  }
  function play(B, seq) {
    return seq.map((s) => step(B, s));
  }
  function undoAll(B, seq, undos) {
    for (let i = seq.length - 1; i >= 0; i--) unstep(B, seq[i], undos[i]);
  }

  function bestMove(board, side, { depth = 4, timeMs = 800, noise = 0 } = {}) {
    const B = board.map((row) => [...row]), deadline = Date.now() + timeMs;
    let nodes = 0;
    const timeout = {};
    function search(d, alpha, beta, me) {
      if ((++nodes & 511) === 0 && Date.now() > deadline) throw timeout;
      const ms = moves(B, me);
      if (!ms.length) return -10000 - d;
      if (d <= 0) return evaluate(B, me);
      for (const seq of ms) {
        const u = play(B, seq);
        const score = -search(d - 1, -beta, -alpha, me === 1 ? 2 : 1);
        undoAll(B, seq, u);
        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
      }
      return alpha;
    }
    const root = moves(B, side);
    if (!root.length) return null;
    let best = root[0];
    for (let d = 1; d <= depth; d++) {
      try {
        let alpha = -Infinity, iterBest = null;
        for (const seq of root) {
          const u = play(B, seq);
          let score;
          try {
            score = -search(d - 1, -Infinity, noise ? Infinity : -alpha, side === 1 ? 2 : 1);
          } finally {
            undoAll(B, seq, u);
          }
          if (noise) score += Math.random() * noise;
          if (score > alpha) (alpha = score), (iterBest = seq);
        }
        best = iterBest || best;
      } catch (e) {
        if (e !== timeout) throw e;
        break;
      }
    }
    return best;
  }
  return { bestMove, _moves: moves };
})();

// ===================== INTEGRACIÓN CON LA PÁGINA =====================
// Solo en el navegador (en Node se cargan los motores para probarlos).
if (typeof document !== "undefined") {
  const AI_KEY = "mesaDeJuegos_ai";
  const LEVELS = {
    easy: { chess: { depth: 1, timeMs: 300, noise: 120 }, checkers: { depth: 1, noise: 60 } },
    normal: { chess: { depth: 2, timeMs: 700, noise: 25 }, checkers: { depth: 4, noise: 10 } },
    hard: { chess: { depth: 4, timeMs: 1500 }, checkers: { depth: 8, timeMs: 1200 } },
  };
  let ai = { chess: { level: "off", side: "b" }, checkers: { level: "off", side: "b" } };
  try {
    ai = { ...ai, ...JSON.parse(localStorage.getItem(AI_KEY) || "{}") };
  } catch (e) {}
  const saveAi = () => {
    try {
      localStorage.setItem(AI_KEY, JSON.stringify(ai));
    } catch (e) {}
  };

  // Selector "Rival" en el panel lateral de cada juego.
  function addRivalPanel(game, anchorSelector, onChange) {
    const box = document.createElement("div");
    box.className = "ai-panel";
    box.innerHTML =
      '<div class="ai-row"><label for="ai-' + game + '-level">🤖 Rival</label>' +
      '<select id="ai-' + game + '-level">' +
      '<option value="off">👥 2 jugadores</option><option value="easy">Máquina · fácil</option>' +
      '<option value="normal">Máquina · normal</option><option value="hard">Máquina · difícil</option>' +
      "</select></div>" +
      '<div class="ai-row"><label for="ai-' + game + '-side">Juegas con</label>' +
      '<select id="ai-' + game + '-side"><option value="b">♔ Blancas</option><option value="w">♚ Negras</option></select></div>';
    const anchor = document.querySelector(anchorSelector);
    anchor.parentNode.insertBefore(box, anchor);
    const level = box.querySelector("#ai-" + game + "-level"),
      side = box.querySelector("#ai-" + game + "-side");
    level.value = ai[game].level;
    side.value = ai[game].side;
    side.disabled = ai[game].level === "off";
    level.onchange = side.onchange = () => {
      ai[game] = { level: level.value, side: side.value };
      side.disabled = level.value === "off";
      saveAi();
      onChange();
    };
  }
  const style = document.createElement("style");
  style.textContent =
    ".ai-panel{display:flex;flex-wrap:wrap;justify-content:center;gap:6px 14px;margin:0 auto 8px;" +
    "font-size:.78rem;color:var(--text2)}" +
    ".ai-row{display:flex;align-items:center;gap:6px}" +
    ".ai-row select{padding:4px 6px;border-radius:6px;border:1px solid var(--bg3);" +
    "background:var(--bg);color:var(--text);font-size:.78rem}" +
    ".ai-row select:disabled{opacity:.5}";
  document.head.appendChild(style);

  const isAiTurn = (game, turn) => ai[game].level !== "off" && ai[game].side === turn;
  const thinking = (id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = "🤖 Pensando…";
  };

  // ----- Ajedrez -----
  let chessTimer = null;
  function maybeChessAi() {
    clearTimeout(chessTimer);
    if (chess.gameOver || pendingPromo || !isAiTurn("chess", chess.turn)) return;
    if (chess.viewIndex < chess.history.length - 1) return; // revisando el historial
    thinking("chessTurn");
    // Dejar que se pinte el tablero antes de pensar.
    chessTimer = setTimeout(() => {
      const mv = ChessEngine.bestMove(chess, LEVELS[ai.chess.level].chess);
      if (!mv || chess.gameOver || !isAiTurn("chess", chess.turn)) return;
      const flag = legalMoves(chess.board, mv.fr, mv.fc, chess.enPassant, chess.castling).find(
        (m) => m.r === mv.tr && m.c === mv.tc,
      );
      if (flag) executeChessMove(mv.fr, mv.fc, mv.tr, mv.tc, flag.flag, mv.promo || "Q");
    }, 350);
  }
  const _executeChessMove = executeChessMove,
    _initChess = initChess,
    _chessClick = chessClick;
  executeChessMove = function () {
    _executeChessMove.apply(this, arguments);
    maybeChessAi();
  };
  initChess = function () {
    _initChess();
    maybeChessAi();
  };
  chessClick = function (r, c) {
    if (!isAiTurn("chess", chess.turn)) _chessClick(r, c);
  };
  addRivalPanel("chess", "#tab0 > .chess-layout", () => initChess());

  // ----- Damas -----
  let ckTimer = null;
  function maybeCheckersAi() {
    clearTimeout(ckTimer);
    const turnSide = ck.turn === 1 ? "w" : "b";
    if (ck.gameOver || ck.mustCapture || !isAiTurn("checkers", turnSide)) return;
    if (ck.viewIndex < ck.history.length - 1) return;
    thinking("checkersTurn");
    ckTimer = setTimeout(() => {
      const seq = CheckersEngine.bestMove(ck.board, ck.turn, LEVELS[ai.checkers.level].checkers);
      if (!seq) return;
      // Las capturas múltiples se juegan paso a paso para que se vean.
      (function next(i) {
        _executeCkMove(seq[i]);
        if (i + 1 < seq.length) ckTimer = setTimeout(() => next(i + 1), 400);
        else maybeCheckersAi();
      })(0);
    }, 350);
  }
  const _executeCkMove = executeCkMove,
    _initCheckers = initCheckers,
    _checkersClick = checkersClick;
  executeCkMove = function (mv) {
    _executeCkMove(mv);
    maybeCheckersAi();
  };
  initCheckers = function () {
    _initCheckers();
    maybeCheckersAi();
  };
  checkersClick = function (r, c) {
    if (!isAiTurn("checkers", ck.turn === 1 ? "w" : "b")) _checkersClick(r, c);
  };
  addRivalPanel("checkers", "#tab2 > .chess-layout", () => initCheckers());

  // Si la máquina lleva las blancas, empieza ella.
  maybeChessAi();
  maybeCheckersAi();
}
