// Pac-Man: comportamiento de los fantasmas (modos, personalidades, Cruise Elroy, ojos y salida de la casa).
// Se inyecta un gancho de pruebas en js/games/pacman.js (solo en el navegador de la prueba).
const { entorno, wait, ok, fin } = require('./helpers');
const fs = require('fs'), path = require('path');
(async () => {
  const env = await entorno(9392, 9391);
  const ctx = await env.contexto();
  const src = fs.readFileSync(path.join(env.root, 'js/games/pacman.js'), 'utf8');
  const marca = 'R(),W()})();';
  if (!src.includes(marca)) throw new Error('no se encuentra el final de pacman.js');
  const gancho = src.replace(marca, 'window.__pac={w:()=>w,T:()=>T,p:()=>p,E:()=>E,h:()=>h,m:()=>m,setH:v=>{h=v},C:()=>C,setC:v=>{C=v},setK:v=>{k=v},P:()=>P,setP:v=>{P=v},step:z,target:pacTarget,elroy:pacElroy,level:v=>{D(v,!0)},mundo:()=>B};' + marca);
  await ctx.route(/\/js\/games\/pacman\.js/, r => r.fulfill({ contentType: 'text/javascript', body: gancho }));
  const pg = await env.pagina(ctx, 'pacman');
  await pg.locator('#startScreen').evaluate(e => { e.style.display = 'none'; });
  await pg.evaluate(() => window.openGame('pac')); await wait(400);
  ok(await pg.evaluate(() => !!window.__pac), 'gancho de pruebas disponible');

  // Utilidades en la página
  await pg.evaluate(() => {
    const P = window.__pac;
    window.sim = {
      nuevo(n) { P.level(n); },
      vivo() { P.T().alive = true; },
      pasos(n, f) { for (let i = 0; i < n; i++) { P.step(); P.T().alive = true; if (f) f(i); } },
      sacar() { P.w().forEach(g => { g.inHouse = false; g.x = Math.round(g.x); g.y = Math.min(Math.round(g.y), 11); }); }
    };
  });

  // ---- Objetivos de cada personalidad
  const obj = await pg.evaluate(() => {
    const P = window.__pac; sim.nuevo(1);
    const [bl, pi, ik, cl] = P.w();
    [bl, pi, ik, cl].forEach(g => { g.inHouse = false; g.scared = false; g.eaten = false; });
    const T = P.T(); T.x = 14; T.y = 20; T.dir = { x: 1, y: 0 };
    bl.x = 10; bl.y = 20;
    const r = {};
    P.setC(1); // persecución
    r.blinky = P.target(bl); r.pinky = P.target(pi); r.inky = P.target(ik);
    cl.x = 14 - 10; cl.y = 20; r.clydeLejos = P.target(cl);
    cl.x = 14 - 5; r.clydeCerca = P.target(cl);
    P.setC(0); // dispersión
    r.scB = P.target(bl); r.scP = P.target(pi); r.scI = P.target(ik); r.scC = P.target(cl);
    return r;
  });
  const eq = (a, b) => a && a.x === b[0] && a.y === b[1];
  ok(eq(obj.blinky, [14, 20]), 'Blinky persigue la casilla exacta de Pac-Man');
  ok(eq(obj.pinky, [18, 20]), 'Pinky apunta 4 casillas por delante de Pac-Man');
  ok(eq(obj.inky, [16 + (16 - 10), 20]), 'Inky: vector desde Blinky doblado a partir de 2 casillas por delante');
  ok(eq(obj.clydeLejos, [14, 20]), 'Clyde persigue a Pac-Man si está a más de 8 casillas');
  ok(eq(obj.clydeCerca, [0, 30]), 'Clyde huye a su esquina inferior si Pac-Man está a menos de 8 casillas');
  ok(eq(obj.scB, [27, 0]) && eq(obj.scP, [0, 0]) && eq(obj.scI, [27, 30]) && eq(obj.scC, [0, 30]), 'En dispersión cada fantasma va a su esquina');

  // ---- Inversión al cambiar de modo (dispersión → persecución)
  const inv = await pg.evaluate(() => {
    const P = window.__pac; sim.nuevo(1); sim.sacar();
    P.w().forEach(g => { g.dir = { x: 1, y: 0 }; });
    P.setC(0); P.setK(1);
    P.step(); P.T().alive = true;
    return { modo: P.C(), dirs: P.w().map(g => g.dir.x) };
  });
  ok(inv.modo === 1 && inv.dirs.every(x => x === -1), 'Al cambiar de modo los fantasmas invierten su dirección');

  // ---- Asustado: inversión + más lentos + giros aleatorios
  const asus = await pg.evaluate(() => {
    const P = window.__pac; sim.nuevo(1); sim.sacar();
    const g = P.w();
    g.forEach(f => { f.dir = { x: 1, y: 0 }; });
    const T = P.T(); T.x = 1; T.y = 3; T.dir = { x: 0, y: 0 }; T.want = { x: 0, y: 0 };
    P.step(); T.alive = true;
    return { scared: g.every(f => f.scared), dirs: g.map(f => f.dir.x) };
  });
  ok(asus.scared && asus.dirs.every(x => x === -1), 'Al comer una píldora de energía los fantasmas se asustan e invierten 180°');
  const lento = await pg.evaluate(() => {
    const P = window.__pac; const f = P.w()[0];
    const x0 = f.x, y0 = f.y; const v = f.speed;
    f.dir = { x: 0, y: 0 }; f.x = Math.round(f.x); f.y = Math.round(f.y);
    // Medimos un paso recto en un pasillo libre
    f.x = 8; f.y = 5; f.dir = { x: 1, y: 0 }; f.scared = true; f.eaten = false; f.inHouse = false;
    const a = f.x; P.step(); P.T().alive = true; return { d: Math.abs(f.x - a) / v };
  });
  ok(Math.abs(lento.d - 0.6) < 0.05, 'Asustados van al 60 % de su velocidad (' + lento.d.toFixed(2) + ')');

  // ---- Regresión: tras comer una píldora de energía los fantasmas siguen moviéndose (no se quedan clavados)
  for (const nivel of [1, 9, 15]) {
    const mov = await pg.evaluate(n => {
      const P = window.__pac; sim.nuevo(n); sim.pasos(250);
      const T = P.T(); T.x = 1; T.y = 3; T.dir = { x: 0, y: 0 }; T.want = { x: 0, y: 0 };
      const gs = P.w().filter(g => !g.inHouse);
      const dist = gs.map(() => 0), prev = gs.map(g => [g.x, g.y]);
      const N = 200;
      for (let i = 0; i < N; i++) {
        P.step(); T.alive = true; T.x = 1; T.y = 5;
        gs.forEach((g, k) => { const d = Math.hypot(g.x - prev[k][0], g.y - prev[k][1]); if (d < 2) dist[k] += d; prev[k] = [g.x, g.y]; });
      }
      return gs.map((g, k) => ({ n: g.name, v: dist[k] / (N * g.speed), s: g.scared }));
    }, nivel);
    ok(mov.length > 0 && mov.every(m => m.v > 0.4), 'Nivel ' + nivel + ': los fantasmas asustados no se quedan parados (' + mov.map(m => m.n[0] + ':' + m.v.toFixed(2)).join(' ') + ')');
  }

  // ---- Giros aleatorios al estar asustado: en un cruce, se observan varias salidas
  const dirs = await pg.evaluate(() => {
    const P = window.__pac; const set = new Set();
    for (let i = 0; i < 60; i++) {
      sim.nuevo(1); const f = P.w()[0]; f.inHouse = false; f.scared = true; f.eaten = false;
      P.setP(300); f.x = 6; f.y = 5; f.dir = { x: 1, y: 0 };
      P.step(); P.T().alive = true; set.add(f.dir.x + ',' + f.dir.y);
    }
    return [...set];
  });
  ok(dirs.length >= 2, 'Asustados eligen giros distintos (aleatorios): ' + dirs.join(' | '));

  // ---- Ojos: vuelven a la casa sin atravesar muros, a más velocidad, y reaparecen
  for (const nivel of [1, 9, 15]) {
    const eyes = await pg.evaluate(n => {
      const P = window.__pac; sim.nuevo(n); sim.sacar();
      const f = P.w()[0]; f.eaten = true; f.scared = false; f.x = 1; f.y = 1; f.dir = { x: 1, y: 0 };
      const p = P.p(); let muros = 0, vuelta = -1, maxv = 0, px = f.x;
      for (let i = 0; i < 1500 && vuelta < 0; i++) {
        P.step(); P.T().alive = true;
        const cx = Math.round(f.x), cy = Math.round(f.y);
        if (cy >= 0 && cy < 31) { const xx = (cx + 28) % 28; if (p[cy][xx] === 0) muros++; }
        if (!f.eaten) vuelta = i;
      }
      return { muros, vuelta, base: f.speed };
    }, nivel);
    ok(eyes.vuelta >= 0 && eyes.muros === 0, 'Ojos nivel ' + nivel + ': regresan a la casa (' + eyes.vuelta + ' pasos) sin atravesar muros (' + eyes.muros + ')');
  }

  // ---- Fantasmas nunca atraviesan muros en niveles altos (ventana de alineación)
  for (const nivel of [1, 8, 15]) {
    const res = await pg.evaluate(n => {
      const P = window.__pac; sim.nuevo(n);
      P.w().forEach(g => { g.releaseAt = 0; });
      const p = P.p(); let muros = 0;
      for (let i = 0; i < 4000; i++) {
        P.step(); P.T().alive = true;
        P.w().forEach(g => { if (g.inHouse) return; const cx = Math.round(g.x), cy = Math.round(g.y); if (cy >= 0 && cy < 31 && p[cy][(cx + 28) % 28] === 0) muros++; });
      }
      return muros;
    }, nivel);
    ok(res === 0, 'Nivel ' + nivel + ': ningún fantasma atraviesa muros en 4000 pasos (' + res + ')');
  }

  // ---- Cruise Elroy
  const el = await pg.evaluate(() => {
    const P = window.__pac; sim.nuevo(1); sim.sacar();
    const b = P.w()[0]; const T = P.T(); T.x = 1; T.y = 29; T.dir = { x: 0, y: 0 };
    const medir = () => { b.dir = { x: 1, y: 0 }; b.x = 8; b.y = 5; b.scared = false; const a = b.x; P.step(); T.alive = true; return (b.x - a) / b.speed; };
    const r = {}; P.setH(P.m());
    r.base = medir(); r.n0 = P.elroy();
    P.setH(20); r.v1 = medir(); r.n1 = P.elroy();
    P.setH(10); r.v2 = medir(); r.n2 = P.elroy();
    P.setC(0); r.objScatter = P.target(b);
    P.setH(P.m()); r.objSinElroy = P.target(b);
    return r;
  });
  ok(el.n0 === 0 && Math.abs(el.base - 1) < 0.01, 'Blinky con todos los puntos: velocidad normal');
  ok(el.n1 === 1 && el.v1 > el.base * 1.05, 'Cruise Elroy 1: Blinky acelera al quedar pocos puntos (' + el.v1.toFixed(3) + ')');
  ok(el.n2 === 2 && el.v2 > el.v1 * 1.05, 'Cruise Elroy 2: acelera aún más (' + el.v2.toFixed(3) + ')');
  ok(el.objScatter && el.objScatter.x !== 27 && el.objSinElroy.x === 27 && el.objSinElroy.y === 0, 'Con Elroy, Blinky sigue persiguiendo en dispersión; sin Elroy va a su esquina');

  // ---- Salida escalonada de la casa
  const sal = await pg.evaluate(() => {
    const P = window.__pac; sim.nuevo(1);
    const T = P.T(); T.x = 14; T.y = 23; T.dir = { x: 0, y: 0 };
    const [, pi, ik, cl] = P.w(); const r = {};
    sim.pasos(2); // pinky sale enseguida (0 puntos)
    sim.pasos(100); r.t100 = [pi.inHouse, ik.inHouse, cl.inHouse];
    return r;
  });
  ok(sal.t100[0] === false && sal.t100[1] === true && sal.t100[2] === true, 'Pinky sale primero; Inky y Clyde esperan su turno (' + sal.t100.join(',') + ')');
  const salPuntos = await pg.evaluate(() => {
    const P = window.__pac; sim.nuevo(1);
    P.setH(P.m() - 30); sim.pasos(120);
    const [, , ik, cl] = P.w(); return [ik.inHouse, cl.inHouse];
  });
  ok(salPuntos[0] === false && salPuntos[1] === true, 'Inky sale tras 30 puntos comidos; Clyde aún espera (' + salPuntos.join(',') + ')');

  if (process.env.SHOTS) await pg.screenshot({ path: process.env.SHOTS + '/pacman.png' });
  await env.cerrar(); fin();
})();
