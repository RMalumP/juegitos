// Motor del UNO: baraja de 108, reparto, cartas de acción, acumular +2/+4, reto al +4, «¡UNO!», rebarajar, puntos, guardado e IA (sin DOM).
const test = require('node:test');
const assert = require('node:assert');
const U = require('../js/online/uno-engine.js');
const rngDe = sem => { let s = sem >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const total = s => s.mazo.length + s.pozo.length + s.manos.reduce((a, m) => a + m.length, 0);
// Mesa preparada a mano: manos, carta de arriba, color y turno
function mesa(manos, top, op) {
  const s = U.crear(Object.assign({ n: manos.length, semilla: 7, repartidor: 0 }, op || {}));
  s.manos = manos.map(m => m.slice()); s.pozo = [top]; s.color = U.colorDe(top) || (op && op.color) || 'r';
  s.turno = 0; s.sentido = 1; s.fase = 'jugando'; s.acum = 0; s.acumTipo = null; s.reto = null; s.robada = null; s.pillable = -1; s.uno = manos.map(() => false);
  s.mazo = ['r1', 'r2', 'r3', 'a1', 'a2', 'a3', 'v1', 'v2', 'z1', 'z2'];
  return s;
}

test('la baraja tiene las 108 cartas de la lista', () => {
  const b = U.baraja(), cuenta = f => b.filter(f).length;
  assert.strictEqual(b.length, 108);
  assert.strictEqual(cuenta(c => U.valorDe(c) === '0'), 4, 'un 0 por color');
  assert.strictEqual(cuenta(c => /^[1-9]$/.test(U.valorDe(c))), 72, '1–9: dos por color');
  assert.strictEqual(cuenta(c => c === 'r7'), 2);
  ['D', 'R', 'S'].forEach(v => assert.strictEqual(cuenta(c => U.valorDe(c) === v), 8, v + ': 2 por color'));
  assert.strictEqual(cuenta(c => c === 'W'), 4); assert.strictEqual(cuenta(c => c === 'W4'), 4);
});

test('reparto: 7 cartas a cada uno, nunca empieza con un +4 y no se pierde ninguna carta', () => {
  for (let k = 0; k < 300; k++) {
    const n = 2 + (k % 9), s = U.crear({ n, semilla: k });
    assert.ok(s.manos.every((m, p) => m.length === 7 || (U.valorDe(s.pozo[0]) === 'D' && m.length === 9)));
    assert.notStrictEqual(s.pozo[0], 'W4');
    assert.strictEqual(total(s), 108);
    assert.ok(U.restaurar(JSON.parse(JSON.stringify(s))), 'el estado se puede guardar y recuperar');
  }
});

test('carta de salida: +2, salta, reversa y comodín', () => {
  let vistos = {};
  for (let k = 0; k < 2000 && Object.keys(vistos).length < 4; k++) {
    const s = U.crear({ n: 4, semilla: k, repartidor: 0 }), v = U.valorDe(s.pozo[0]);
    if (v === 'D' && !vistos.D) { vistos.D = 1; assert.strictEqual(s.manos[1].length, 9); assert.strictEqual(s.turno, 2, 'el primero roba 2 y pierde el turno'); }
    if (v === 'S' && !vistos.S) { vistos.S = 1; assert.strictEqual(s.turno, 2, 'el primero pierde el turno'); }
    if (v === 'R' && !vistos.R) { vistos.R = 1; assert.strictEqual(s.turno, 0, 'empieza quien repartió'); assert.strictEqual(s.sentido, -1); }
    if (s.pozo[0] === 'W' && !vistos.W) {
      vistos.W = 1; assert.strictEqual(s.fase, 'color'); assert.strictEqual(s.turno, 1);
      assert.ok(!U.jugar(s, 1, 0, 'r').ok, 'antes hay que elegir color');
      assert.ok(U.elegirColor(s, 1, 'v').ok); assert.strictEqual(s.color, 'v'); assert.strictEqual(s.fase, 'jugando');
    }
  }
  assert.deepStrictEqual(Object.keys(vistos).sort(), ['D', 'R', 'S', 'W']);
});

test('jugar por color, número o símbolo; comodín siempre', () => {
  const s = mesa([['r5', 'a7', 'z9', 'W', 'v7'], ['r1', 'r2'], ['a1', 'a2']], 'r7');
  assert.ok(U.puedeJugar(s, 0, 0), 'mismo color'); assert.ok(U.puedeJugar(s, 0, 1), 'mismo número'); assert.ok(!U.puedeJugar(s, 0, 2)); assert.ok(U.puedeJugar(s, 0, 3));
  assert.ok(!U.jugar(s, 1, 0).ok, 'fuera de turno');
  assert.ok(!U.jugar(s, 0, 2).ok, 'carta que no encaja');
  assert.ok(!U.jugar(s, 0, 3).ok, 'el comodín pide color');
  assert.ok(U.jugar(s, 0, 3, 'z').ok); assert.strictEqual(s.color, 'z'); assert.strictEqual(s.turno, 1);
  assert.ok(!U.puedeJugar(s, 1, 0), 'sobre un comodín vale el color elegido');
});

test('salta, reversa (y reversa con 2 jugadores) y +2', () => {
  let s = mesa([['rS', 'r1'], ['r2', 'r3'], ['r4', 'r5'], ['r6', 'r7']], 'r9');
  U.jugar(s, 0, 0); assert.strictEqual(s.turno, 2, 'salta al siguiente');
  s = mesa([['rR', 'r1'], ['r2', 'r3'], ['r4', 'r5'], ['r6', 'r7']], 'r9');
  U.jugar(s, 0, 0); assert.strictEqual(s.turno, 3); assert.strictEqual(s.sentido, -1);
  s = mesa([['rR', 'r1'], ['r2', 'r3']], 'r9');
  U.jugar(s, 0, 0); assert.strictEqual(s.turno, 0, 'con 2 jugadores la reversa repite turno');
  s = mesa([['rD', 'r1'], ['a2', 'a3'], ['r4', 'r5']], 'r9');
  U.jugar(s, 0, 0); assert.strictEqual(s.acum, 2); assert.strictEqual(s.turno, 1);
  assert.ok(!U.jugar(s, 1, 0).ok, 'con un +2 pendiente no vale otra carta');
  U.robar(s, 1); assert.strictEqual(s.manos[1].length, 4, 'roba 2'); assert.strictEqual(s.turno, 2, 'y pierde el turno'); assert.strictEqual(s.acum, 0);
});

test('acumular: +2 sobre +2, +4 sobre +2, +4 sobre +4, pero no +2 sobre +4; y sin acumular', () => {
  let s = mesa([['rD', 'r1'], ['aD', 'W4', 'a1'], ['W4', 'v1'], ['v2', 'v3']], 'r9');
  U.jugar(s, 0, 0); assert.ok(U.jugar(s, 1, 0).ok); assert.strictEqual(s.acum, 4);
  assert.ok(U.jugar(s, 2, 0, 'v').ok, '+4 sobre +2'); assert.strictEqual(s.acum, 8);
  assert.strictEqual(s.reto, null, 'un +4 acumulado no se puede retar');
  U.robar(s, 3); assert.strictEqual(s.manos[3].length, 10, 'roba 8');
  s = mesa([['W4', 'r1', 'a5'], ['aD', 'W4', 'a1'], ['v1']], 'z9');
  U.jugar(s, 0, 0, 'a'); assert.ok(!U.puedeJugar(s, 1, 0), 'no +2 sobre +4'); assert.ok(U.puedeJugar(s, 1, 1), '+4 sobre +4');
  s = mesa([['rD', 'r1'], ['aD', 'a1']], 'r9', { acumular: false });
  U.jugar(s, 0, 0); assert.ok(!U.jugar(s, 1, 0).ok, 'sin acumular hay que robar');
});

test('robar: si la robada sirve se juega solo esa o se pasa; si no, pasa el turno', () => {
  let s = mesa([['a5', 'z6'], ['v1']], 'r9');
  s.mazo = ['r4'];
  const r = U.robar(s, 0); assert.ok(r.ok && r.jugable); assert.strictEqual(s.turno, 0);
  assert.ok(!U.jugar(s, 0, 0).ok, 'otra carta de la mano no'); assert.ok(!U.robar(s, 0).ok, 'no se roba dos veces');
  assert.ok(U.jugar(s, 0, 2).ok); assert.strictEqual(s.turno, 1);
  s = mesa([['a5', 'z6'], ['v1']], 'r9'); s.mazo = ['a1'];
  assert.ok(!U.pasar(s, 0).ok, 'no se pasa sin robar');
  U.robar(s, 0); assert.strictEqual(s.turno, 1, 'la robada no sirve: pasa solo');
  s = mesa([['r5'], ['v1']], 'r9'); s.mazo = ['r4'];
  U.robar(s, 0); assert.ok(U.pasar(s, 0).ok, 'puede quedarse la robada aunque sirva'); assert.strictEqual(s.turno, 1);
});

test('se acaba el mazo: se baraja el pozo menos la de arriba', () => {
  const s = mesa([['a5'], ['v1']], 'r9'); s.mazo = []; s.pozo = ['z1', 'z2', 'v3', 'r9'];
  U.robar(s, 0); assert.strictEqual(s.pozo.length, 1); assert.strictEqual(s.pozo[0], 'r9'); assert.strictEqual(s.mazo.length + s.manos[0].length, 2 + 2);
  const t = mesa([['a5'], ['v1']], 'r9'); t.mazo = [];
  assert.ok(U.robar(t, 0).ok, 'sin cartas que robar, pasa'); assert.strictEqual(t.turno, 1);
});

test('reto al +4: ilegal (roba 4 quien lo tiró) y legal (el retador roba 6)', () => {
  let s = mesa([['W4', 'r1', 'a5'], ['v1', 'v2'], ['z1']], 'r9');
  U.jugar(s, 0, 0, 'v'); assert.deepStrictEqual(s.reto, { de: 0, ilegal: true });
  assert.strictEqual(U.vista(s).reto.ilegal, undefined, 'la vista no dice si era ilegal');
  assert.ok(!U.retar(s, 2).ok, 'solo reta el siguiente');
  const r = U.retar(s, 1); assert.ok(r.ok && r.gana); assert.strictEqual(s.manos[0].length, 6); assert.strictEqual(s.turno, 1, 'el retador juega');
  assert.strictEqual(s.acum, 0); assert.ok(U.jugar(s, 1, 0).ok, 'juega normal con el color elegido');
  s = mesa([['W4', 'a1', 'a5'], ['v1', 'v2'], ['z1']], 'r9');
  U.jugar(s, 0, 0, 'v'); assert.strictEqual(s.reto.ilegal, false);
  assert.ok(!U.retar(s, 1).gana); assert.strictEqual(s.manos[1].length, 8, 'roba 4 + 2'); assert.strictEqual(s.turno, 2);
});

test('«¡UNO!»: decirlo antes o después; si le pillan roba 2; el plazo acaba cuando juega el siguiente', () => {
  let s = mesa([['r1', 'r2', 'z5'], ['r3', 'r4', 'a4'], ['r5', 'v6']], 'r9');
  assert.ok(!U.decirUno(s, 0).ok, 'con 3 cartas no');
  U.jugar(s, 0, 0); U.jugar(s, 1, 0);
  assert.ok(U.decirUno(s, 2).ok, 'con 2 en su turno'); U.jugar(s, 2, 0); assert.strictEqual(s.pillable, -1);
  U.jugar(s, 0, 0); assert.strictEqual(s.pillable, 0, 'se le olvidó');
  assert.ok(!U.pillar(s, 0, 0).ok, 'uno mismo no');
  assert.ok(U.pillar(s, 2, 0).ok); assert.strictEqual(s.manos[0].length, 3); assert.strictEqual(s.pillable, -1);
  s = mesa([['r1', 'r2'], ['r3', 'r4', 'a4'], ['r5']], 'r9');
  U.jugar(s, 0, 0); assert.strictEqual(s.pillable, 0);
  assert.ok(U.decirUno(s, 0).ok, 'lo dice tarde, antes de que le pillen'); assert.ok(!U.pillar(s, 1, 0).ok);
  s = mesa([['r1', 'r2'], ['r3', 'r4', 'a4'], ['r5']], 'r9');
  U.jugar(s, 0, 0); U.jugar(s, 1, 0); assert.strictEqual(s.pillable, -1, 'ya jugó el siguiente'); assert.ok(!U.pillar(s, 2, 0).ok);
});

test('partida rápida y por puntos (con el +2 final, que suma)', () => {
  let s = mesa([['r1'], ['a9', 'W'], ['zS', 'v5']], 'r9');
  U.jugar(s, 0, 0); assert.strictEqual(s.fase, 'final'); assert.strictEqual(s.ganador, 0); assert.strictEqual(s.puntosRonda, 9 + 50 + 20 + 5);
  s = mesa([['rD'], ['a9'], ['z5']], 'r9', { meta: 200 });
  U.jugar(s, 0, 0); assert.strictEqual(s.manos[1].length, 3, 'el siguiente roba el +2 final');
  assert.strictEqual(s.fase, 'fin'); assert.strictEqual(s.puntos[0], 9 + 5 + s.manos[1].slice(1).reduce((a, c) => a + U.puntosDe(c), 0));
  assert.ok(U.vista(s).manosFin, 'al final de la ronda se enseñan las manos');
  assert.ok(U.siguienteRonda(s).ok); assert.strictEqual(s.ronda, 2); assert.ok(s.manos.every(m => m.length >= 7)); assert.strictEqual(total(s), 108);
  s.puntos[1] = 195; s.manos = [['a1', 'a2'], ['r1'], ['z5']]; s.turno = 1; s.fase = 'jugando'; s.pozo = ['r9']; s.color = 'r'; s.acum = 0; s.robada = null;
  U.jugar(s, 1, 0); assert.strictEqual(s.fase, 'final'); assert.strictEqual(s.ganador, 1);
});

test('vista: sin manos ni mazo durante la ronda', () => {
  const s = U.crear({ n: 3, semilla: 3 }), v = U.vista(s);
  assert.deepStrictEqual(v.cuantas, s.manos.map(m => m.length));
  assert.strictEqual(v.manosFin, null); assert.ok(!('manos' in v) && !('semilla' in v) && typeof v.mazo === 'number');
});

test('restaurar rechaza estados con cartas de más o de menos', () => {
  const s = U.crear({ n: 3, semilla: 9 });
  assert.ok(U.restaurar(JSON.parse(JSON.stringify(s))));
  const t = JSON.parse(JSON.stringify(s)); t.manos[0].push('W4'); assert.strictEqual(U.restaurar(t), null);
  assert.strictEqual(U.restaurar({}), null);
});

test('IA: 300 partidas de 2 a 8 jugadores en los 3 niveles terminan sin jugadas ilegales ni cartas perdidas', () => {
  for (let k = 0; k < 300; k++) {
    const rng = rngDe(k), n = 2 + (k % 7), niveles = Array.from({ length: n }, (_, p) => 1 + ((p + k) % 3));
    const s = U.crear({ n, semilla: k * 31, meta: k % 3 === 0 ? 200 : 0, acumular: k % 5 !== 0 });
    for (let paso = 0; paso < 6000 && s.fase !== 'final'; paso++) {
      if (s.fase === 'fin') { U.siguienteRonda(s); continue; }
      if (s.pillable >= 0 && rng() < 0.5) { const q = U.sig(s, s.pillable); assert.ok(U.pillar(s, q, s.pillable).ok); }
      const p = s.turno, m = U.ia(s, p, niveles[p], rng);
      assert.ok(m, 'la IA siempre tiene jugada');
      if (m.uno) assert.ok(U.decirUno(s, p).ok);
      const r = U.accion(s, p, m); assert.ok(r.ok, 'jugada válida: ' + JSON.stringify(m) + ' → ' + r.error);
      assert.strictEqual(total(s), 108);
    }
    assert.strictEqual(s.fase, 'final', 'la partida ' + k + ' termina');
  }
});

test('IA: la difícil gana más a menudo que la fácil', () => {
  let dificil = 0;
  for (let k = 0; k < 400; k++) {
    const rng = rngDe(1000 + k), s = U.crear({ n: 2, semilla: k });
    for (let paso = 0; paso < 4000 && s.fase !== 'final'; paso++) { const p = s.turno, m = U.ia(s, p, p === 0 ? 3 : 1, rng); if (m.uno) U.decirUno(s, p); U.accion(s, p, m); if (s.pillable >= 0 && s.pillable !== 0 && rng() < 0.8) U.pillar(s, 0, s.pillable); }
    if (s.ganador === 0) dificil++;
  }
  assert.ok(dificil > 200, 'difícil gana ' + dificil + ' de 400');
});

test('jugablesDe (invitado online) coincide con el árbitro', () => {
  for (let k = 0; k < 200; k++) {
    const rng = rngDe(k), s = U.crear({ n: 3, semilla: k });
    for (let paso = 0; paso < 60 && s.fase === 'jugando'; paso++) {
      const p = s.turno;
      assert.deepStrictEqual(U.jugablesDe(U.vista(s), s.manos[p], p), U.jugables(s, p));
      const m = U.ia(s, p, 2, rng); if (m.uno) U.decirUno(s, p); U.accion(s, p, m);
    }
  }
});
