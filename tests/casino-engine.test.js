// Motor de la mesa online de Póquer (Ruleta y Blackjack online usan los juegos originales).
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/online/casino-engine.js');
const { Poker } = C;
const rngDe = semilla => { let a = semilla >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const carta = (r, p) => r + 13 * p;                              // r: 0 = «2» … 12 = «A»
const J = n => Array.from({ length: n }, (_, i) => ({ id: 'j' + i, nombre: 'J' + i }));

/* ---------------- póquer ---------------- */
test('póquer: ranking de manos', () => {
  const m = cs => C.mejorMano(cs), mayor = (a, b) => C.cmpArr(m(a), m(b)) > 0;
  const escReal = [0, 1, 2, 3, 4].map(r => carta(r + 8, 0)), poquer = [carta(7, 0), carta(7, 1), carta(7, 2), carta(7, 3), carta(0, 0)];
  const full = [carta(5, 0), carta(5, 1), carta(5, 2), carta(2, 0), carta(2, 1)], color = [0, 2, 4, 6, 8].map(r => carta(r, 1)), escalera = [carta(3, 0), carta(4, 1), carta(5, 2), carta(6, 3), carta(7, 0)];
  const trio = [carta(9, 0), carta(9, 1), carta(9, 2), carta(0, 0), carta(2, 1)], dp = [carta(9, 0), carta(9, 1), carta(4, 2), carta(4, 0), carta(2, 1)], par = [carta(9, 0), carta(9, 1), carta(4, 2), carta(0, 0), carta(2, 1)], alta = [carta(11, 0), carta(9, 1), carta(4, 2), carta(0, 0), carta(2, 1)];
  const orden = [escReal, poquer, full, color, escalera, trio, dp, par, alta];
  for (let i = 0; i < orden.length - 1; i++) assert.ok(mayor(orden[i], orden[i + 1]), 'categoría ' + i);
  assert.equal(m([carta(12, 0), carta(0, 1), carta(1, 2), carta(2, 3), carta(3, 0)])[0], 4, 'la rueda A-2-3-4-5 es escalera');
  assert.deepEqual(m([carta(12, 0), carta(0, 1), carta(1, 2), carta(2, 3), carta(3, 0)]), [4, 3]);
  assert.ok(mayor([carta(5, 0), carta(6, 1), carta(7, 2), carta(8, 3), carta(9, 0)], [carta(12, 0), carta(0, 1), carta(1, 2), carta(2, 3), carta(3, 0)]), 'la rueda es la escalera más baja');
  assert.equal(C.cmpArr(m([carta(12, 0), carta(11, 1), carta(3, 2), carta(2, 0), carta(0, 1), carta(5, 2), carta(7, 3)]), m([carta(12, 1), carta(11, 2), carta(7, 0), carta(5, 1), carta(3, 3), carta(1, 2), carta(0, 0)])), 0, 'empate real: el mismo juego de 5 cartas');
  assert.equal(m([carta(1, 0), carta(1, 1), carta(3, 2), carta(3, 3), carta(8, 0), carta(8, 1), carta(12, 2)])[0], 2, 'de 7 cartas se elige la mejor (doble pareja con las dos mayores)');
  assert.deepEqual(m([carta(1, 0), carta(1, 1), carta(3, 2), carta(3, 3), carta(8, 0), carta(8, 1), carta(12, 2)]), [2, 8, 3, 12]);
});
const fichasTotales = s => s.jug.reduce((t, j) => t + j.coins, 0) + s.bote;
test('póquer: heads-up, todos se retiran y el bote va al que queda', () => {
  const s = Poker.nueva(J(2), { fichas: 100, ciegaG: 10 }); const t0 = fichasTotales(s);
  Poker.repartir(s, rngDe(4));
  assert.equal(s.fase, 'preflop'); assert.equal(s.bote, 15, 'ciegas 5 + 10'); assert.equal(s.turno, s.boton, 'en heads-up el botón (ciega pequeña) actúa primero');
  const id = s.jug[s.turno].id;
  assert.equal(Poker.accion(s, s.jug[1 - s.turno].id, { a: 'check' }).ok, false, 'fuera de turno');
  assert.equal(Poker.accion(s, id, { a: 'check' }).ok, false, 'no puede pasar: debe igualar');
  assert.equal(Poker.accion(s, id, { a: 'raise', m: 12 }).ok, false, 'subida mínima');
  assert.equal(Poker.accion(s, id, { a: 'fold' }).ok, true);
  assert.equal(s.fase, 'showdown'); assert.equal(s.resultado.motivo, 'todos se retiran'); assert.equal(fichasTotales(s), t0);
  assert.equal(s.jug[1 - s.jug.findIndex(j => j.id === id)].coins, 105);
});
test('póquer: una mano completa hasta el enfrentamiento reparte el bote', () => {
  const s = Poker.nueva(J(3), { fichas: 200, ciegaG: 10 }); const t0 = fichasTotales(s);
  Poker.repartir(s, rngDe(5));
  let guardia = 0; while (['preflop', 'flop', 'turn', 'river'].includes(s.fase) && guardia++ < 40) { const op = Poker.opciones(s, s.jug[s.turno].id); Poker.accion(s, s.jug[s.turno].id, { a: op.puedeCheck ? 'check' : 'call' }); }
  assert.equal(s.fase, 'showdown'); assert.equal(s.com.length, 5); assert.equal(fichasTotales(s), t0);
  assert.ok(s.resultado.ganadores.length >= 1);
  const v = Poker.vista(s); assert.equal(v.mazo, undefined); assert.ok(v.jug.every(j => j.hole && j.nCartas === 2), 'en el enfrentamiento se ven las cartas de los que siguen');
});
test('póquer: all-in y botes secundarios conservan las fichas', () => {
  const s = Poker.nueva(J(3), { fichas: 100, ciegaG: 10 });
  s.jug[0].coins = 30; s.jug[1].coins = 100; s.jug[2].coins = 300; const t0 = fichasTotales(s);
  Poker.repartir(s, rngDe(6));
  // todos se juegan todo
  let guardia = 0; while (['preflop', 'flop', 'turn', 'river'].includes(s.fase) && guardia++ < 40) Poker.accion(s, s.jug[s.turno].id, { a: 'allin' });
  assert.equal(s.fase, 'showdown'); assert.equal(fichasTotales(s), t0, 'no se crea ni se pierde ninguna ficha');
  assert.ok(s.resultado.botes.length >= 2, 'hay bote principal y secundarios');
  assert.equal(s.com.length, 5);
});
test('póquer: 400 manos aleatorias con acciones legales conservan las fichas y terminan', () => {
  const rng = rngDe(77);
  for (let partida = 0; partida < 40; partida++) {
    const n = 2 + (partida % 5), s = Poker.nueva(J(n), { fichas: 200, ciegaG: 10 }); const t0 = fichasTotales(s);
    for (let m = 0; m < 10; m++) {
      if (!Poker.repartir(s, rng).ok) break;
      let guardia = 0;
      while (['preflop', 'flop', 'turn', 'river'].includes(s.fase)) {
        assert.ok(guardia++ < 80, 'la ronda de apuestas no termina');
        const j = s.jug[s.turno], op = Poker.opciones(s, j.id), x = rng(); let a;
        if (x < 0.15) a = { a: 'fold' }; else if (x < 0.6) a = { a: op.puedeCheck ? 'check' : 'call' };
        else if (x < 0.9 && op.puedeSubir) a = { a: 'raise', m: Math.min(op.maxSubida, op.minSubida + Math.floor(rng() * 40)) }; else a = { a: op.puedeSubir ? 'allin' : 'call' };
        const r = Poker.accion(s, j.id, a); assert.ok(r.ok, JSON.stringify(a) + ' ' + r.error);
      }
      assert.equal(s.fase, 'showdown'); assert.equal(fichasTotales(s), t0); assert.ok(s.jug.every(j => j.coins >= 0));
    }
  }
});
test('póquer: reglas como en el offline (escalera real, enseñar al retirarse, all-in corto, ciegas marcadas)', () => {
  assert.equal(C.nombreMano(C.mejorMano([8, 9, 10, 11, 12].map(r => carta(r, 0)))), 'Escalera real');
  assert.equal(C.nombreMano(C.mejorMano([7, 8, 9, 10, 11].map(r => carta(r, 0)))), 'Escalera de color');
  const s = Poker.nueva(J(2), { fichas: 100, ciegaG: 10 }); Poker.repartir(s, rngDe(9));
  assert.ok(s.sb >= 0 && s.bb >= 0 && s.sb !== s.bb && s.sb === s.boton, 'heads-up: el repartidor pone la ciega pequeña');
  const sale = s.jug[s.turno]; assert.equal(Poker.accion(s, sale.id, { a: 'fold', ver: true }).ok, true);
  const v = Poker.vista(s), vj = v.jug.find(j => j.id === sale.id);
  assert.equal(s.fase, 'showdown'); assert.equal(vj.hole.length, 2, 'quien se retira enseñando muestra sus cartas');
  assert.ok(v.jug.find(j => j.id !== sale.id).hole === undefined, 'el ganador sin enfrentamiento no las enseña');
  assert.equal(s.resultado.ganancias[s.jug.find(j => j.id !== sale.id).id], 15);
  const t = Poker.nueva(J(2), { fichas: 100, ciegaG: 10 }); Poker.repartir(t, rngDe(3));
  const corto = t.jug[t.turno], otro = t.jug[1 - t.turno]; corto.coins = 4;
  assert.equal(Poker.accion(t, corto.id, { a: 'allin' }).ok, true, 'all-in por menos de lo que hay que igualar');
  assert.equal(corto.allin, true); assert.ok(otro.coins >= 0);
});
