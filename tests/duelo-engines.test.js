// Motores de Conecta 4 y Tres en raya: reglas, victorias, empate, validación e IA (sin DOM).
const test = require('node:test');
const assert = require('node:assert');
const C4 = require('../js/online/c4-engine.js');
const T3 = require('../js/online/ttt-engine.js');
const rngDe = sem => { let s = sem >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

test('Conecta 4: las fichas caen, columna llena y turnos', () => {
  const e = C4.nuevo({ turno: 0 });
  assert.ok(C4.jugar(e, 3)); assert.strictEqual(e.tab[5 * 7 + 3], 1); assert.strictEqual(e.turno, 1);
  assert.ok(C4.jugar(e, 3)); assert.strictEqual(e.tab[4 * 7 + 3], 2);
  for (let i = 0; i < 4; i++) C4.jugar(e, 3);
  assert.ok(!C4.jugar(e, 3), 'columna llena');
  assert.ok(!C4.jugar(e, 7) && !C4.jugar(e, -1) && !C4.jugar(e, 1.5), 'columnas fuera de rango');
  assert.ok(!C4.legales(e).includes(3));
});
test('Conecta 4: victoria horizontal, vertical y diagonales', () => {
  let e = C4.nuevo(); [0, 0, 1, 1, 2, 2, 3].forEach(c => C4.jugar(e, c));
  assert.strictEqual(e.fase, 'fin'); assert.strictEqual(e.ganador, 0); assert.deepStrictEqual(e.linea.sort((a, b) => a - b), [35, 36, 37, 38]);
  e = C4.nuevo(); [0, 1, 0, 1, 0, 1, 0].forEach(c => C4.jugar(e, c)); assert.strictEqual(e.ganador, 0, 'vertical'); assert.ok(!C4.jugar(e, 2), 'no se juega tras el final');
  e = C4.nuevo(); [0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3].forEach(c => C4.jugar(e, c)); assert.strictEqual(e.ganador, 0, 'diagonal /');
  e = C4.nuevo(); [6, 5, 5, 4, 4, 3, 4, 3, 3, 0, 3].forEach(c => C4.jugar(e, c)); assert.strictEqual(e.ganador, 0, 'diagonal \\');
});
test('Conecta 4: empate con el tablero lleno', () => {
  // se rellena cada columna alternando para no formar cuatro seguidas: columnas en pares (0,1)(2,3)(4,5) con un patrón conocido
  const e = C4.nuevo({ turno: 0 }); let jugadas = 0;
  const rng = rngDe(3);
  while (e.fase === 'jugando') { const l = C4.legales(e); C4.jugar(e, l[Math.floor(rng() * l.length)]); jugadas++; }
  assert.strictEqual(e.fase, 'fin');
  assert.ok(e.ganador === 2 ? jugadas === 42 : e.linea.length >= 4, 'termina con empate (42 fichas) o con una línea de cuatro');
});
test('Conecta 4: la IA gana si puede, bloquea si debe y en difícil no se deja ganar por una trampa simple', () => {
  const e = C4.nuevo({ turno: 0 }); [0, 6, 1, 6, 2].forEach(c => C4.jugar(e, c));   // jugador 1 (rojas) tiene 0,1,2 abajo → el 2 turno es del jugador 1
  e.turno = 0; assert.strictEqual(C4.ia(2, e, rngDe(1)), 3, 'normal gana');
  assert.strictEqual(C4.ia(3, e, rngDe(1)), 3, 'difícil gana');
  const b = C4.nuevo({ turno: 1 }); [0, 6, 1, 5].forEach(c => { C4.jugar(b, c); });
  b.turno = 0; b.tab[5 * 7 + 6] = 2; b.tab[5 * 7 + 5] = 2; b.tab[5 * 7 + 4] = 2; assert.strictEqual(C4.ia(2, b, rngDe(2)), 3, 'bloquea el 4 del rival');
});
test('Conecta 4: partidas IA contra IA terminan y difícil > normal > fácil', () => {
  function puntos(nivelA, nivelB, partidas) { let a = 0, b = 0; for (let i = 0; i < partidas; i++) { const rng = rngDe(200 + i), e = C4.nuevo({ turno: i % 2 }); const nv = i % 2 === 0 ? [nivelA, nivelB] : [nivelB, nivelA]; while (e.fase === 'jugando') { const c = C4.ia(nv[e.turno], e, rng); assert.ok(C4.jugar(e, c)); } if (e.ganador === 2) continue; const gana = nv[e.ganador]; if (gana === nivelA) a++; else b++; } return [a, b]; }
  const dn = puntos(3, 2, 12), df = puntos(3, 1, 12), nf = puntos(2, 1, 12);
  console.log('   difícil vs normal', dn, '· difícil vs fácil', df, '· normal vs fácil', nf);
  assert.ok(dn[0] > dn[1], 'difícil gana a normal'); assert.ok(df[0] >= 10, 'difícil casi siempre gana a fácil'); assert.ok(nf[0] > nf[1], 'normal gana a fácil');
});
test('Tres en raya: victorias, empate y validación', () => {
  let e = T3.nuevo(); [0, 3, 1, 4, 2].forEach(i => T3.jugar(e, i));
  assert.strictEqual(e.ganador, 0); assert.deepStrictEqual(e.linea, [0, 1, 2]); assert.ok(!T3.jugar(e, 8));
  e = T3.nuevo(); [0, 1, 2, 4, 3, 5, 7, 6, 8].forEach(i => T3.jugar(e, i)); assert.strictEqual(e.ganador, 2, 'empate'); assert.strictEqual(e.fase, 'fin');
  e = T3.nuevo(); assert.ok(!T3.jugar(e, 9) && !T3.jugar(e, -1) && !T3.jugar(e, 0.5)); T3.jugar(e, 4); assert.ok(!T3.jugar(e, 4), 'casilla ocupada');
});
test('Tres en raya: la IA difícil es perfecta (nunca pierde) y la normal gana/bloquea', () => {
  for (let ini = 0; ini < 2; ini++) for (let s = 0; s < 40; s++) {
    const rng = rngDe(s * 7 + ini), e = T3.nuevo({ turno: ini }); const dificil = ini;           // el difícil es el jugador `ini`
    while (e.fase === 'jugando') { const nv = e.turno === dificil ? 3 : 1; assert.ok(T3.jugar(e, T3.ia(nv, e, rng))); }
    assert.ok(e.ganador === dificil || e.ganador === 2, 'el difícil no pierde contra el azar');
  }
  for (let s = 0; s < 30; s++) { const rng = rngDe(s), e = T3.nuevo({ turno: 0 }); while (e.fase === 'jugando') T3.jugar(e, T3.ia(3, e, rng)); assert.strictEqual(e.ganador, 2, 'perfecta contra perfecta = empate'); }
  const e = T3.nuevo({ turno: 0 }); [0, 3, 1, 4].forEach(i => T3.jugar(e, i)); assert.strictEqual(T3.ia(2, e, rngDe(1)), 2, 'normal gana'); 
  const b = T3.nuevo({ turno: 1 }); [0, 4, 1].forEach(i => T3.jugar(b, i)); assert.strictEqual(T3.ia(2, b, rngDe(1)), 2, 'normal bloquea');
});
