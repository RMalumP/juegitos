// Motores de las mesas online: Ruleta, Blackjack y Póquer.
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../js/online/casino-engine.js');
const { Ruleta, Blackjack, Poker } = C;
const rngDe = semilla => { let a = semilla >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const carta = (r, p) => r + 13 * p;                              // r: 0 = «2» … 12 = «A»
const J = n => Array.from({ length: n }, (_, i) => ({ id: 'j' + i, nombre: 'J' + i }));

/* ---------------- ruleta ---------------- */
test('ruleta: pagos de cada tipo de apuesta', () => {
  const gana = (a, n) => C.rulGana(a, n);
  assert.ok(gana({ t: 'pleno', v: 17 }, 17) && !gana({ t: 'pleno', v: 17 }, 18));
  assert.ok(gana({ t: 'color', v: 'rojo' }, 1) && gana({ t: 'color', v: 'negro' }, 2) && !gana({ t: 'color', v: 'rojo' }, 0));
  assert.ok(gana({ t: 'paridad', v: 'par' }, 2) && gana({ t: 'paridad', v: 'impar' }, 35) && !gana({ t: 'paridad', v: 'par' }, 0));
  assert.ok(gana({ t: 'mitad', v: 'falta' }, 18) && gana({ t: 'mitad', v: 'pasa' }, 19) && !gana({ t: 'mitad', v: 'falta' }, 0));
  assert.ok(gana({ t: 'docena', v: 1 }, 12) && gana({ t: 'docena', v: 2 }, 13) && gana({ t: 'docena', v: 3 }, 36));
  assert.ok(gana({ t: 'columna', v: 1 }, 1) && gana({ t: 'columna', v: 2 }, 5) && gana({ t: 'columna', v: 3 }, 36) && !gana({ t: 'columna', v: 3 }, 35));
  assert.equal(C.colorNum(0), 'verde'); assert.equal(C.colorNum(32), 'rojo'); assert.equal(C.colorNum(33), 'negro');
});
test('ruleta: una ronda completa reparte los pagos y respeta el saldo', () => {
  const s = Ruleta.nueva(J(2), { fichas: 100 });
  assert.equal(Ruleta.apostar(s, 'j0', { t: 'pleno', v: 7, m: 10 }).ok, true);
  assert.equal(Ruleta.apostar(s, 'j0', { t: 'color', v: 'rojo', m: 91 }).ok, false);     // 10 + 91 > 100
  assert.equal(Ruleta.apostar(s, 'j0', { t: 'color', v: 'rojo', m: 20 }).ok, true);
  assert.equal(Ruleta.apostar(s, 'j1', { t: 'docena', v: 9, m: 5 }).ok, false);
  assert.equal(Ruleta.apostar(s, 'j1', { t: 'pleno', v: 40, m: 5 }).ok, false);
  assert.equal(Ruleta.apostar(s, 'j1', { t: 'color', v: 'negro', m: -5 }).ok, false);
  assert.equal(Ruleta.apostar(s, 'x', { t: 'pleno', v: 1, m: 1 }).ok, false);
  Ruleta.listo(s, 'j0'); assert.equal(Ruleta.todosListos(s), false); Ruleta.listo(s, 'j1'); assert.equal(Ruleta.todosListos(s), true);
  assert.equal(Ruleta.apostar(s, 'j0', { t: 'pleno', v: 1, m: 1 }).ok, false, 'tras «listo» no se apuesta');
  const r = Ruleta.girar(s, () => 7 / 37 + 1e-9);           // sale el 7 (rojo)
  assert.equal(r.n, 7); assert.equal(s.jug.j0.coins, 100 + 10 * 35 + 20);
  assert.equal(s.jug.j1.coins, 100);
  assert.equal(s.fase, 'resultado'); assert.equal(Ruleta.girar(s, Math.random).ok, false);
  Ruleta.siguiente(s); assert.equal(s.fase, 'apuestas'); assert.equal(s.jug.j0.apuestas.length, 0); assert.equal(s.ronda, 2);
});
test('ruleta: el cero se lleva las apuestas exteriores y 1000 giros dan 0–36', () => {
  const s = Ruleta.nueva(J(1), { fichas: 100 }); Ruleta.apostar(s, 'j0', { t: 'color', v: 'rojo', m: 50 }); Ruleta.apostar(s, 'j0', { t: 'pleno', v: 0, m: 1 });
  Ruleta.girar(s, () => 0); assert.equal(s.jug.j0.coins, 100 - 50 + 35);
  const rng = rngDe(3), vistos = new Set();
  for (let i = 0; i < 1000; i++) { const t = Ruleta.nueva(J(1)); const r = Ruleta.girar(t, rng); assert.ok(r.n >= 0 && r.n <= 36); vistos.add(r.n); }
  assert.equal(vistos.size, 37);
});

/* ---------------- blackjack ---------------- */
test('blackjack: valor de manos y ases', () => {
  const v = m => C.valorMano(m);
  assert.deepEqual(v([carta(12, 0), carta(7, 0)]), { total: 20, blando: true });          // A + 9
  assert.deepEqual(v([carta(12, 0), carta(8, 0)]), { total: 21, blando: true });          // A + 10 = 21
  assert.equal(v([carta(12, 0), carta(12, 1)]).total, 12);                                   // A + A
  assert.equal(v([carta(12, 0), carta(9, 0), carta(10, 1)]).total, 21);                      // A + J + Q = 21
  assert.equal(v([carta(11, 0), carta(10, 0), carta(2, 0)]).total, 24);
  assert.ok(C.esBlackjack([carta(12, 0), carta(11, 3)]) && !C.esBlackjack([carta(5, 0), carta(4, 0), carta(8, 1)]));
});
test('blackjack: una ronda con pagos de victoria, empate, derrota y blackjack', () => {
  const s = Blackjack.nueva(J(4), { fichas: 100 });
  ['j0', 'j1', 'j2', 'j3'].forEach(id => Blackjack.apostar(s, id, 10));
  assert.equal(Blackjack.listosParaRepartir(s), true);
  Blackjack.repartir(s, rngDe(1));
  // se fuerza la mesa: banca 18 (10+8), j0 20, j1 18, j2 17, j3 blackjack
  s.banca = [carta(8, 0), carta(6, 1)]; s.jug.j0.mano = [carta(8, 1), carta(9, 1)]; s.jug.j1.mano = [carta(8, 2), carta(6, 2)]; s.jug.j2.mano = [carta(8, 3), carta(5, 3)];
  s.jug.j3.mano = [carta(12, 0), carta(11, 0)];
  s.jug.j0.estado = s.jug.j1.estado = s.jug.j2.estado = 'juega'; s.jug.j3.estado = 'blackjack'; s.fase = 'turnos'; s.turno = 'j0';
  assert.equal(Blackjack.accion(s, 'j1', 'plantar').ok, false, 'no es su turno');
  Blackjack.accion(s, 'j0', 'plantar'); assert.equal(s.turno, 'j1'); Blackjack.accion(s, 'j1', 'plantar'); Blackjack.accion(s, 'j2', 'plantar');
  assert.equal(s.fase, 'resultado');
  assert.equal(s.banca.length, 2, 'la banca se planta con 18');
  assert.equal(s.jug.j0.coins, 110); assert.equal(s.jug.j1.coins, 100); assert.equal(s.jug.j2.coins, 90); assert.equal(s.jug.j3.coins, 115);
  Blackjack.siguiente(s); assert.equal(s.fase, 'apuestas'); assert.equal(s.jug.j0.apuesta, 0);
});
test('blackjack: pedir, pasarse, doblar y la banca pide hasta 17', () => {
  const s = Blackjack.nueva(J(2), { fichas: 100 }); Blackjack.apostar(s, 'j0', 10); Blackjack.apostar(s, 'j1', 20);
  Blackjack.repartir(s, rngDe(2));
  s.banca = [carta(3, 0), carta(2, 1)];                    // 5 + 4 = 9
  s.jug.j0.mano = [carta(8, 0), carta(7, 0)]; s.jug.j0.estado = 'juega'; s.jug.j1.mano = [carta(4, 0), carta(5, 0)]; s.jug.j1.estado = 'juega'; s.turno = 'j0';
  s.mazo = [carta(8, 0), carta(6, 0), carta(10, 1)];     // se roba desde el final: Q♥ (j0 se pasa), 8♠ (j1 dobla y hace 21), 10♠ (la banca llega a 19)
  Blackjack.accion(s, 'j0', 'pedir'); assert.equal(s.jug.j0.estado, 'pasa');
  assert.equal(Blackjack.accion(s, 'j1', 'doblar').ok, true); assert.equal(s.jug.j1.apuesta, 40);
  assert.equal(s.fase, 'resultado'); assert.equal(C.valorMano(s.banca).total, 19);
  assert.equal(s.jug.j0.coins, 90); assert.equal(s.jug.j1.coins, 140, 'doblar 20 → 40 y gana a 19');
  assert.equal(Blackjack.accion(s, 'j1', 'pedir').ok, false);
});
test('blackjack: vista oculta la carta de la banca y el mazo; 300 rondas sin errores', () => {
  const s = Blackjack.nueva(J(3), { fichas: 1e6 }); const rng = rngDe(9);
  for (let r = 0; r < 300; r++) {
    s.orden.forEach(id => Blackjack.apostar(s, id, 5)); Blackjack.repartir(s, rng);
    const v = Blackjack.vista(s); assert.equal(v.mazo, undefined);
    if (s.fase === 'turnos') assert.equal(v.banca[1], null);
    let guardia = 0; while (s.fase === 'turnos' && guardia++ < 50) Blackjack.accion(s, s.turno, rng() < 0.5 ? 'pedir' : 'plantar');
    assert.equal(s.fase, 'resultado'); Blackjack.siguiente(s);
  }
});

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
