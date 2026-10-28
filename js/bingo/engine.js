/* js/bingo/engine.js — Motor del bingo de 90 bolas (sin DOM, probado en Node: tests/bingo-engine.test.js).
   · Cartón español: 3 filas × 9 columnas, 15 números (5 por fila, 1–3 por columna; columna c = decena c, la última lleva el 90). 0 = casilla vacía.
   · Bombo: orden aleatorio de 1..90 fijado al empezar (lo guarda solo quien canta las bolas).
   · Premios: «linea» (una fila completa) y «bingo» (cartón lleno). El primero que canta algo válido gana; empatan los que lo completaron con la misma bola.
   Funciona como módulo de Node (require) y como script de navegador (window.BingoEngine). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BingoEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const MAX_BOLA = 90, FILAS = 3, COLS = 9, POR_FILA = 5;

  /* ---------- aleatoriedad ---------- */
  function semillaAleatoria() {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) return crypto.getRandomValues(new Uint32Array(1))[0];
    return (Math.random() * 4294967296) >>> 0;
  }
  function rngDe(semilla) { // mulberry32
    let a = semilla >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const entero = (rng, n) => Math.floor(rng() * n);
  function barajar(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = entero(rng, i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  /* ---------- números y columnas ---------- */
  const columnaDe = n => (n === 90 ? 8 : Math.floor(n / 10));
  const rangoColumna = c => (c === 0 ? [1, 9] : c === 8 ? [80, 90] : [c * 10, c * 10 + 9]);

  /* ---------- cartones ---------- */
  function generarCarton(rng) {
    rng = rng || Math.random;
    for (;;) {
      const cnt = Array(COLS).fill(1);
      for (let resto = POR_FILA * FILAS - COLS; resto > 0;) { const c = entero(rng, COLS); if (cnt[c] < 3) { cnt[c]++; resto--; } }
      const cap = [POR_FILA, POR_FILA, POR_FILA];
      const carton = [Array(COLS).fill(0), Array(COLS).fill(0), Array(COLS).fill(0)];
      let ok = true;
      for (const c of barajar([...Array(COLS).keys()], rng).sort((x, y) => cnt[y] - cnt[x])) { // primero las columnas con más números
        const libres = [0, 1, 2].filter(f => cap[f] > 0);
        if (libres.length < cnt[c]) { ok = false; break; }
        const filas = barajar(libres, rng).slice(0, cnt[c]).sort((x, y) => x - y);
        const [lo, hi] = rangoColumna(c);
        const nums = barajar(Array.from({ length: hi - lo + 1 }, (_, i) => lo + i), rng).slice(0, cnt[c]).sort((x, y) => x - y);
        filas.forEach((f, i) => { carton[f][c] = nums[i]; cap[f]--; });
      }
      if (ok && cartonValido(carton)) return carton;
    }
  }
  function cartonValido(c) {
    if (!Array.isArray(c) || c.length !== FILAS) return false;
    const vistos = new Set();
    for (let f = 0; f < FILAS; f++) {
      if (!Array.isArray(c[f]) || c[f].length !== COLS) return false;
      let en = 0;
      for (let k = 0; k < COLS; k++) {
        const n = c[f][k];
        if (n === 0) continue;
        if (!Number.isInteger(n) || n < 1 || n > MAX_BOLA || columnaDe(n) !== k || vistos.has(n)) return false;
        vistos.add(n); en++;
      }
      if (en !== POR_FILA) return false;
    }
    for (let k = 0; k < COLS; k++) { // 1–3 por columna y en orden ascendente de arriba abajo
      const col = [c[0][k], c[1][k], c[2][k]].filter(n => n > 0);
      if (col.length < 1 || col.some((n, i) => i && n <= col[i - 1])) return false;
    }
    return vistos.size === FILAS * POR_FILA;
  }
  const clave = c => c.map(f => f.join(',')).join('|');
  function generarCartones(n, rng) { // sin repetir ninguno
    const res = [], claves = new Set();
    while (res.length < n) { const c = generarCarton(rng); const k = clave(c); if (!claves.has(k)) { claves.add(k); res.push(c); } }
    return res;
  }
  const numerosDe = c => c.flat().filter(n => n > 0);

  /* ---------- comprobación de premios ---------- */
  const comoConjunto = bolas => (bolas instanceof Set ? bolas : new Set(bolas));
  function filasCompletas(carton, bolas) {
    const s = comoConjunto(bolas);
    return [0, 1, 2].filter(f => carton[f].every(n => n === 0 || s.has(n)));
  }
  const esBingo = (carton, bolas) => { const s = comoConjunto(bolas); return numerosDe(carton).every(n => s.has(n)); };
  function faltan(carton, bolas) { // cuántos números faltan para línea (la fila más cercana) y para bingo
    const s = comoConjunto(bolas);
    const porFila = carton.map(f => f.filter(n => n > 0 && !s.has(n)).length);
    return { linea: Math.min(...porFila), bingo: porFila.reduce((a, b) => a + b, 0) };
  }
  // Índice (1 = primera bola) de la bola con la que el cartón completó el premio, o 0 si aún no lo ha completado.
  function indiceCompletado(carton, bolas, premio) {
    const s = new Set();
    for (let i = 0; i < bolas.length; i++) {
      s.add(bolas[i]);
      if (premio === 'bingo' ? esBingo(carton, s) : filasCompletas(carton, s).length > 0) return i + 1;
    }
    return 0;
  }

  /* ---------- partida ---------- */
  const PREMIOS = ['linea', 'bingo'];
  const MAX_CARTONES = 6;
  function limpiarPremios(p) {
    const l = PREMIOS.filter(x => (p || PREMIOS).includes(x));
    return l.includes('bingo') ? l : [...l, 'bingo']; // el bingo siempre cierra la partida
  }
  // jugadores: [{ id, nombre, cartones }] (cartones 0 = no juega, solo canta bolas; sin indicar = 1). El anfitrión puede ir en la lista con sus propios cartones.
  // Cada cartón recibe un número único en toda la partida (p.nums[id][k]) para poder nombrarlo («el cartón 7»).
  // Devuelve el estado completo del cantor de bolas (el bombo es secreto).
  function nuevaPartida({ jugadores, premios, semilla }) {
    const sem = semilla === undefined ? semillaAleatoria() : semilla;
    const rng = rngDe(sem);
    const cartones = {}, nums = {};
    const usados = new Set();
    let serie = 0;
    for (const j of jugadores) {
      const n = Math.max(0, Math.min(MAX_CARTONES, j.cartones === undefined ? 1 : j.cartones | 0));
      cartones[j.id] = []; nums[j.id] = [];
      while (cartones[j.id].length < n) { // ningún cartón repetido en toda la sala
        const c = generarCarton(rng), k = clave(c);
        if (!usados.has(k)) { usados.add(k); cartones[j.id].push(c); nums[j.id].push(++serie); }
      }
    }
    return {
      semilla: sem, bombo: barajar(Array.from({ length: MAX_BOLA }, (_, i) => i + 1), rng), bolas: [],
      premios: limpiarPremios(premios), ganados: {}, cartones, nums,
      nombres: Object.fromEntries(jugadores.map(j => [j.id, j.nombre])), fin: false
    };
  }
  function sacar(p) {
    if (p.fin || p.bolas.length >= MAX_BOLA) return null;
    const b = p.bombo[p.bolas.length];
    p.bolas.push(b);
    return b;
  }
  const premioPendiente = p => p.premios.find(x => !p.ganados[x]) || null;
  // Cantar «linea» o «bingo» con el cartón número `idx` del jugador `id`. Muta la partida si es válido.
  function cantar(p, id, premio, idx) {
    if (p.fin) return { ok: false, motivo: 'La partida ya ha terminado.' };
    if (!p.premios.includes(premio)) return { ok: false, motivo: 'Ese premio no está en juego.' };
    if (p.ganados[premio]) return { ok: false, motivo: premio === 'linea' ? 'La línea ya está cantada.' : 'El bingo ya está cantado.' };
    const mis = p.cartones[id];
    const carton = mis && mis[idx];
    if (!carton) return { ok: false, motivo: 'Ese cartón no existe.' };
    const idxGanador = indiceCompletado(carton, p.bolas, premio);
    if (!idxGanador) return { ok: false, motivo: premio === 'linea' ? 'Falso: ese cartón no tiene línea.' : 'Falso: ese cartón no está lleno.' };
    const ganadores = [{ id, nombre: p.nombres[id], carton: idx }];
    for (const otro of Object.keys(p.cartones)) {
      p.cartones[otro].forEach((c, k) => {
        if (otro === id && k === idx) return;
        if (indiceCompletado(c, p.bolas, premio) === idxGanador && !ganadores.some(g => g.id === otro)) ganadores.push({ id: otro, nombre: p.nombres[otro], carton: k });
      });
    }
    p.ganados[premio] = { ganadores, bola: idxGanador, total: p.bolas.length };
    if (premio === 'bingo') p.fin = true;
    return { ok: true, premio, ganadores };
  }

  // Todos los cartones de la partida, con su número, su dueño y lo que les falta: para que el cantor los compruebe.
  function listarCartones(p) {
    const res = [];
    for (const id of Object.keys(p.cartones)) p.cartones[id].forEach((carton, idx) => res.push({ num: p.nums[id][idx], id, nombre: p.nombres[id], idx, carton, faltan: faltan(carton, p.bolas) }));
    return res.sort((a, b) => a.num - b.num);
  }
  // Marcas que no corresponden a ninguna bola salida (para borrarlas tras un canto falso).
  function marcasFalsas(marcas, bolas) { const s = comoConjunto(bolas); return (marcas || []).filter(n => !s.has(n)); }

  return {
    MAX_BOLA, FILAS, COLS, POR_FILA, MAX_CARTONES, PREMIOS,
    semillaAleatoria, rngDe, barajar, columnaDe, rangoColumna,
    generarCarton, generarCartones, cartonValido, numerosDe,
    filasCompletas, esBingo, faltan, indiceCompletado,
    nuevaPartida, sacar, cantar, premioPendiente, listarCartones, marcasFalsas
  };
});
