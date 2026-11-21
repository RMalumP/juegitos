// Auditoría: ¿se interpreta como HTML el nombre de un jugador remoto? Invitado con nombre «<i id=xss>X</i>». Uso: node tests/_auditoria/xss-nombres.js
const { entorno, wait } = require('../helpers');
const JUEGOS = [
  ['c4', 'c4', 'winC4'], ['ttt', 'ttt', 'winTtt'], ['uno', 'uno', 'winUno'], ['domino', 'domino', 'winDomino'], ['oca', 'oca', 'winOca'],
  ['hundir', 'hundir', 'winHundir'], ['ahorcado', 'ahor', 'winAhor'], ['simon', 'sim', 'winSim'], ['poker', 'poker', 'winPoker'],
  ['blackjack', 'bj', 'winBJ'], ['ruleta', 'roul', 'winRoul'], ['parchis', 'parchis', 'winParchis'], ['ajedrez', 'chess', 'winChess']
];
const NOMBRE = '<i id=xss>X</i>';
(async () => {
  const env = await entorno(9692, 9691);
  const res = [];
  for (const [j, win, winId] of JUEGOS) {
    const nuevo = async n => { const c = await env.contexto({ viewport: { width: 390, height: 844 } }); const p = await env.pagina(c, n + '-' + j); p.on('dialog', d => d.accept());
      await p.evaluate(w => { localStorage.clear(); document.getElementById('startScreen').style.display = 'none'; window.openGame(w); }, win); await wait(j === 'parchis' || j === 'ajedrez' ? 2500 : 600); return { p, c }; };
    const H = await nuevo('host'), G = await nuevo('inv');
    try {
      const entrar = async (x, modo, nombre) => {
        await x.p.locator('#' + winId + ' [data-conectar]').first().click();
        await x.p.fill('#salaNombre', nombre); await x.p.fill('#salaSala', 'xss ' + j); await x.p.fill('#salaPass', 'clave1');
        await x.p.click(modo === 'crear' ? '#salaCrear' : '#salaUnir');
        await x.p.waitForFunction(() => window.Sala.activo, null, { timeout: 25000 });
      };
      await entrar(H, 'crear', 'Anfi'); await entrar(G, 'unir', NOMBRE);
      await H.p.waitForFunction(() => window.Sala.jug.length === 2, null, { timeout: 15000 }); await wait(800);
      const enLobby = await H.p.evaluate(() => !!document.getElementById('xss'));
      await H.p.evaluate(j => { const b = [...document.querySelectorAll('.olLobby[data-j="' + j + '"] .olGrande')][0]; if (b) b.click(); }, j);
      await wait(3500);
      const mira = p => p.evaluate(() => { if (document.getElementById('xss')) return 'página'; for (const f of document.querySelectorAll('iframe')) { try { if (f.contentDocument.getElementById('xss')) return 'iframe'; } catch (e) {} } return ''; });
      const h = await mira(H.p), g = await mira(G.p);
      res.push(j + ': lobby=' + enLobby + ' anfitrión=' + (h || 'no') + ' invitado=' + (g || 'no'));
      if (h || g) await (h ? H.p : G.p).screenshot({ path: (process.env.SHOTS || require('os').tmpdir()) + '/xss-' + j + '.png' });
    } catch (e) { res.push(j + ': ERROR ' + e.message.split('\n')[0]); }
    await H.c.close(); await G.c.close();
  }
  console.log(res.join('\n'));
  await env.cerrar(); process.exit(0);
})();
