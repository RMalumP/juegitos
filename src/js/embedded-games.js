// Ajedrez/Damas y Parchís son documentos HTML completos que se cargan en un
// <iframe>. El build los incrusta comprimidos (CHESS_HTML_GZ_B64 y
// PARCHIS_HTML_GZ_B64) para que index.html siga siendo un único archivo.
function loadEmbeddedGame(frameId, gzB64) {
  let f = document.getElementById(frameId);
  if (f.getAttribute(`data-loaded`)) return;
  f.setAttribute(`data-loaded`, `1`);
  let bytes = Uint8Array.from(atob(gzB64), (c) => c.charCodeAt(0)),
    stream = new Blob([bytes])
      .stream()
      .pipeThrough(new DecompressionStream(`gzip`));
  new Response(stream).text().then((html) => {
    f.srcdoc = html;
  });
}
function initChess() {
  loadEmbeddedGame(`chessFrame`, CHESS_HTML_GZ_B64);
}
function initParchis() {
  loadEmbeddedGame(`parchisFrame`, PARCHIS_HTML_GZ_B64);
}
function chessWindow() {
  return document.getElementById(`chessFrame`).contentWindow;
}
// Abre la ventana de Ajedrez en una pestaña concreta (2 = Damas). Si el
// iframe aún no ha cargado, espera a su evento `load` en vez de sondear.
function openChessTab(idx) {
  openGame(`chess`);
  let w = chessWindow();
  w && typeof w.switchTab == `function`
    ? w.switchTab(idx)
    : document
        .getElementById(`chessFrame`)
        .addEventListener(`load`, () => chessWindow().switchTab(idx), {
          once: !0,
        });
}
function pauseChessClocks() {
  let w = chessWindow();
  w && typeof w.pauseClocks == `function` && w.pauseClocks();
}
onStartChoice(document.getElementById(`sBtnDamas`), () => openChessTab(2));
onDeskIconDoubleTap(document.getElementById(`iconDamas`), () =>
  openChessTab(2),
);
