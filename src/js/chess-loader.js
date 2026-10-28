function initChess() {
  var f = document.getElementById("chessFrame");
  if (f.getAttribute("data-loaded")) return;
  f.setAttribute("data-loaded", "1");
  var bin = atob(CHESS_HTML_GZ_B64);
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  var ds = new DecompressionStream("gzip");
  var stream = new Blob([bytes]).stream().pipeThrough(ds);
  new Response(stream).text().then(function (html) {
    f.srcdoc = html;
  });
}
function openChessTab(idx) {
  openGame("chess");
  var f = document.getElementById("chessFrame");
  var tries = 0;
  (function poll() {
    tries++;
    var w = f.contentWindow;
    if (w && typeof w.switchTab === "function") {
      try {
        w.switchTab(idx);
      } catch (e) {}
      return;
    }
    if (tries < 150) setTimeout(poll, 40);
  })();
}
document.getElementById("sBtnDamas").onclick = function () {
  document.getElementById("startScreen").style.display = "none";
  openChessTab(2);
};
(function () {
  var last = 0;
  var el = document.getElementById("iconDamas");
  el.addEventListener("click", function () {
    this.parentNode.querySelectorAll(".deskIcon").forEach(function (d) {
      d.classList.remove("sel");
    });
    this.classList.add("sel");
    var now = Date.now();
    if (now - last < 400) openChessTab(2);
    last = now;
  });
})();

function pauseChessClocks() {
  var w = document.getElementById("chessFrame").contentWindow;
  w && typeof w.pauseClocks === "function" && w.pauseClocks();
}
