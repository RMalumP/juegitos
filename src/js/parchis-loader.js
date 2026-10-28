function initParchis() {
  var f = document.getElementById("parchisFrame");
  if (f.getAttribute("data-loaded")) return;
  f.setAttribute("data-loaded", "1");
  var bin = atob(PARCHIS_HTML_GZ_B64);
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  var ds = new DecompressionStream("gzip");
  var stream = new Blob([bytes]).stream().pipeThrough(ds);
  new Response(stream).text().then(function (html) {
    f.srcdoc = html;
  });
}
