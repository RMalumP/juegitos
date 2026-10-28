// Motores de la fase 4: Memoria (parejas) y Wordle en español (evaluación, palabra del día, listas de palabras).
const test = require('node:test');
const assert = require('node:assert');
const Mem = require('../js/games/mem-engine.js');
const W = require('../js/games/wordle-engine.js');
const fs = require('fs'), path = require('path');
const rngDe = sem => { let s = sem >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

test('Memoria: parejas, fallo, turnos y final', () => {
  const e = Mem.crear(4, 4, 2, rngDe(3));
  assert.strictEqual(e.cartas.length, 16); assert.deepStrictEqual([...new Set(e.cartas)].length, 8);
  for (let id = 0; id < 8; id++) assert.strictEqual(e.cartas.filter(c => c === id).length, 2, 'cada figura sale dos veces');
  const a = e.cartas.indexOf(0), b = e.cartas.lastIndexOf(0), x = e.cartas.indexOf(1);
  assert.strictEqual(Mem.voltear(e, a), 'abrir');
  assert.strictEqual(Mem.voltear(e, a), null, 'la misma carta no se abre dos veces');
  assert.strictEqual(Mem.voltear(e, x), 'fallo'); assert.strictEqual(e.pendiente, true);
  assert.strictEqual(Mem.voltear(e, b), null, 'con un fallo pendiente no se abre otra carta');
  assert.ok(Mem.resolver(e)); assert.strictEqual(e.turno, 1, 'en 2 jugadores el fallo pasa el turno');
  assert.strictEqual(Mem.voltear(e, a), 'abrir'); assert.strictEqual(Mem.voltear(e, b), 'par');
  assert.strictEqual(e.puntos[1], 1); assert.strictEqual(e.turno, 1, 'quien acierta repite'); assert.strictEqual(e.halladas[a], true);
  assert.strictEqual(Mem.voltear(e, a), null, 'una carta hallada no se abre');
  for (let id = 1; id < 8; id++) { const i = e.cartas.indexOf(id), j = e.cartas.lastIndexOf(id); Mem.voltear(e, i); Mem.voltear(e, j); }
  assert.strictEqual(e.fase, 'fin'); assert.strictEqual(Mem.ganador(e), 1); assert.strictEqual(e.intentos, 9, '1 fallo + 8 parejas');
});
test('Memoria: 1 jugador no cambia de turno y tamaños 4×5 y 6×6', () => {
  const e = Mem.crear(4, 5, 1, rngDe(1)); assert.strictEqual(e.cartas.length, 20);
  const x = e.cartas.indexOf(0), y = e.cartas.indexOf(1); Mem.voltear(e, x); Mem.voltear(e, y); Mem.resolver(e); assert.strictEqual(e.turno, 0);
  assert.strictEqual(Mem.crear(6, 6, 1).cartas.length, 36); assert.throws(() => Mem.crear(3, 3, 1));
});
test('Wordle: evaluar con letras repetidas como el original', () => {
  assert.deepStrictEqual(W.evaluar('perro', 'perro'), [2, 2, 2, 2, 2]);
  assert.deepStrictEqual(W.evaluar('perro', 'error'), [1, 1, 2, 1, 0], 'e,r amarillas; r verde; o amarilla; sobra una r');
  assert.deepStrictEqual(W.evaluar('arcos', 'sarao'), [1, 1, 1, 0, 1], 'la segunda a es gris porque solo hay una');
  assert.deepStrictEqual(W.evaluar('hotel', 'llave'), [1, 0, 0, 0, 1], 'solo una l amarilla');
  assert.deepStrictEqual(W.evaluar('aaaab', 'baaaa'), [1, 2, 2, 2, 1]);
  assert.deepStrictEqual(W.evaluar('abcde', 'fghij'), [0, 0, 0, 0, 0]);
});
test('Wordle: normalizar tildes y ñ, palabra del día estable, compartir y teclas', () => {
  assert.strictEqual(W.normalizar('CÁMARA'), 'camara'); assert.strictEqual(W.normalizar('Señor'), 'señor'); assert.strictEqual(W.normalizar('pingüino'), 'pinguino');
  assert.strictEqual(W.indiceDelDia('2026-10-26', 1579), W.indiceDelDia('2026-10-26', 1579));
  const dias = new Set(); for (let d = 1; d <= 28; d++) dias.add(W.indiceDelDia('2026-02-' + String(d).padStart(2, '0'), 1579)); assert.ok(dias.size > 24, 'el día cambia la palabra');
  assert.strictEqual(W.fechaHoy(new Date(2026, 9, 6)), '2026-10-06');
  const ev = [[0, 1, 0, 0, 2], [2, 2, 2, 2, 2]];
  assert.strictEqual(W.compartir('Wordle', 6, 6, ev), 'Wordle 2/6\n⬛🟨⬛⬛🟩\n🟩🟩🟩🟩🟩');
  assert.ok(W.compartir('Wordle', 6, 6, [[0, 0, 0, 0, 0]]).startsWith('Wordle X/6'));
  assert.deepStrictEqual(W.estadoTeclas(['ab', 'ba'], [[0, 1], [2, 0]]), { a: 0, b: 2 }, 'se queda el mejor resultado de cada letra');
});
test('listas de palabras de Wordle: 5 letras, sin duplicados y sin palabras malsonantes en las soluciones', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'js/games/wordle-palabras.js'), 'utf8');
  const ctx = { window: {} }; new Function('window', src)(ctx.window);
  const { sol, ok } = ctx.window.WORDLE_PALABRAS, S = sol.split(' '), O = ok.split(' ');
  assert.ok(S.length > 1400 && O.length > 8000, 'tamaño de las listas: ' + S.length + ' + ' + O.length);
  for (const w of [...S, ...O]) assert.ok(/^[a-zñ]{5}$/.test(w), 'palabra válida: ' + w);
  assert.strictEqual(new Set([...S, ...O]).size, S.length + O.length, 'sin repetidas entre soluciones y aceptadas');
  for (const m of ['puta', 'culo', 'joder', 'verga', 'polla', 'semen', 'nazis']) assert.ok(!S.includes(m), 'no debe ser solución: ' + m);
  for (const w of ['ahora', 'mujer', 'nunca', 'tengo']) assert.ok(S.includes(w) || O.includes(w), 'palabra común aceptada: ' + w);
});
