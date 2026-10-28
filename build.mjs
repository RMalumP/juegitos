// Genera index.html (un único archivo autocontenido) a partir de src/.
//   node build.mjs          -> escribe index.html
//   node build.mjs --check  -> falla si index.html no está al día con src/
import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { transformSync } from "esbuild";

const SRC = new URL("./src/", import.meta.url);
const read = (p) => readFileSync(new URL(p, SRC), "utf8");

// Orden de carga: cada archivo va en su propio <script>, como en el original.
const SCRIPTS = [
  "js/shared.js",
  "js/core.js",
  "js/sudoku.js",
  "js/tetris.js",
  "js/invaders.js",
  "js/snake.js",
  "js/pacman.js",
  "js/embedded-games.js",
  "js/asteroids.js",
  "js/window-bar.js",
];

// Juegos que viven en su propio documento dentro de un <iframe>.
// Se incrustan comprimidos para que index.html siga siendo un solo archivo.
const EMBEDDED = {
  CHESS_HTML_GZ_B64: "embedded/chess.html",
  PARCHIS_HTML_GZ_B64: "embedded/parchis.html",
};

const minJs = (code, file) =>
  transformSync(code, { loader: "js", minify: true, target: "es2020", sourcefile: file })
    .code.trim();
const minCss = (code) =>
  transformSync(code, { loader: "css", minify: true }).code.trim();

// El HTML de src/ está indentado solo para leerlo: los saltos de línea
// (y la sangría que los sigue) no existen en la página final.
const collapse = (html) => html.replace(/\n[ \t]*/g, "");

function build() {
  const embedded = Object.entries(EMBEDDED)
    .map(([name, file]) => {
      const gz = gzipSync(Buffer.from(read(file)), { level: 9 });
      // mtime fijo en la cabecera gzip para que el build sea reproducible
      gz.writeUInt32LE(0, 4);
      return `const ${name}=${JSON.stringify(gz.toString("base64"))};`;
    })
    .join("");

  const scripts =
    `<script>${embedded}</script>` +
    SCRIPTS.map((f) => `<script>${minJs(read(f), f)}</script>`).join("");

  const page = collapse(read("index.html"))
    .replace("<!-- build:css -->", () => `<style>${minCss(read("styles.css"))}</style>`)
    .replace("<!-- build:js -->", () => scripts);
  return page + "\n";
}

const out = build();
const target = new URL("./index.html", import.meta.url);
if (process.argv.includes("--check")) {
  if (readFileSync(target, "utf8") !== out) {
    console.error("index.html no está al día: ejecuta `npm run build`.");
    process.exit(1);
  }
  console.log("index.html al día.");
} else {
  writeFileSync(target, out);
  console.log(`index.html: ${(Buffer.byteLength(out) / 1024).toFixed(1)} KB`);
}
