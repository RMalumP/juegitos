// Motor del Simon multijugador: rondas por eliminación, empate, validación de respuestas y plazos (sin DOM).
const test = require('node:test');
const assert = require('node:assert');
const Sim = require('../js/online/simon-engine.js');
const rngDe = sem => { let s = sem >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

test('Simon: partida nueva con secuencia de 1 color y todos vivos', () => {
  const e = Sim.nuevo({ n: 3, vel: 2, rng: rngDe(1) });
  assert.strictEqual(e.seq.length, 1); assert.ok(e.seq[0] >= 0 && e.seq[0] <= 3);
  assert.deepStrictEqual(e.vivos, [true, true, true]); assert.deepStrictEqual(e.resp, [null, null, null]);
  assert.strictEqual(e.ronda, 1); assert.strictEqual(e.vel, 2); assert.strictEqual(e.fase, 'jugando');
  assert.strictEqual(Sim.nuevo({ n: 2, vel: 9 }).vel, 1, 'velocidad fuera de rango → Normal');
});

test('Simon: la ronda se cierra cuando responden todos y la secuencia crece', () => {
  const rng = rngDe(7), e = Sim.nuevo({ n: 2, rng });
  assert.ok(Sim.responder(e, 0, 1, e.seq.slice(), rng));
  assert.strictEqual(e.ronda, 1, 'falta el jugador 1'); assert.deepStrictEqual(Sim.pendientes(e), [1]);
  assert.ok(!Sim.responder(e, 0, 1, e.seq.slice(), rng), 'no se responde dos veces');
  assert.ok(Sim.responder(e, 1, 1, e.seq.slice(), rng));
  assert.strictEqual(e.ronda, 2); assert.strictEqual(e.seq.length, 2); assert.deepStrictEqual(e.resp, [null, null]);
  assert.deepStrictEqual(e.alcanzo, [1, 1]);
  assert.ok(!Sim.responder(e, 0, 1, [e.seq[0]], rng), 'una respuesta de otra ronda no vale');
});

test('Simon: quien falla queda eliminado y gana el último en pie', () => {
  const rng = rngDe(3), e = Sim.nuevo({ n: 3, rng });
  Sim.responder(e, 0, 1, e.seq.slice(), rng); Sim.responder(e, 1, 1, [(e.seq[0] + 1) % 4], rng); Sim.responder(e, 2, 1, e.seq.slice(), rng);
  assert.deepStrictEqual(e.vivos, [true, false, true]); assert.strictEqual(e.fase, 'jugando'); assert.strictEqual(e.ronda, 2);
  assert.ok(!Sim.responder(e, 1, 2, e.seq.slice(), rng), 'un eliminado ya no juega');
  Sim.responder(e, 0, 2, e.seq.slice(), rng); Sim.responder(e, 2, 2, e.seq.slice(0, 1), rng);   // respuesta incompleta = fallo
  assert.strictEqual(e.fase, 'fin'); assert.deepStrictEqual(e.ganadores, [0]); assert.deepStrictEqual(e.alcanzo, [2, 0, 1]);
  assert.deepStrictEqual(Sim.clasificacion(e).map(f => f.p), [0, 2, 1]);
  assert.ok(!Sim.responder(e, 0, 3, e.seq.slice(), rng), 'no se juega tras el final');
});

test('Simon: si fallan todos los que quedan, empatan', () => {
  const rng = rngDe(5), e = Sim.nuevo({ n: 3, rng }), mal = [(e.seq[0] + 2) % 4];
  Sim.responder(e, 0, 1, mal, rng); Sim.responder(e, 1, 1, mal, rng); Sim.responder(e, 2, 1, mal, rng);
  assert.strictEqual(e.fase, 'fin'); assert.deepStrictEqual(e.ganadores, [0, 1, 2]);
  assert.ok(Sim.clasificacion(e).every(f => f.gana));
});

test('Simon: cerrar por tiempo elimina a quien no ha contestado', () => {
  const rng = rngDe(9), e = Sim.nuevo({ n: 3, rng });
  Sim.responder(e, 0, 1, e.seq.slice(), rng); Sim.responder(e, 2, 1, e.seq.slice(), rng);
  assert.strictEqual(e.ronda, 1); Sim.cerrar(e, rng);
  assert.deepStrictEqual(e.vivos, [true, false, true]); assert.strictEqual(e.ronda, 2);
  Sim.cerrar(e, rng);
  assert.strictEqual(e.fase, 'fin'); assert.deepStrictEqual(e.ganadores, [0, 2], 'nadie contesta: empate de los que quedaban');
});

test('Simon: jugador inválido, respuestas raras y plazo', () => {
  const e = Sim.nuevo({ n: 2 });
  [-1, 2, 0.5, '0', null].forEach(p => assert.ok(!Sim.responder(e, p, 1, e.seq.slice()), 'jugador ' + p));
  assert.ok(!Sim.correcta(e, 'x') && !Sim.correcta(e, null) && !Sim.correcta(e, [String(e.seq[0])]));
  assert.ok(Sim.plazo(0, 10) > Sim.plazo(2, 10) && Sim.plazo(1, 10) > Sim.plazo(1, 3));
  const r = Sim.ritmo(1, 1); assert.strictEqual(r.dur, 600);
});
