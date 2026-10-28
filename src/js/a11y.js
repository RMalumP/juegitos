// Accesibilidad: los botones de la interfaz son <div> con estilos propios.
// Sin cambiar su aspecto, les damos rol de botón, foco con el tabulador,
// activación con Enter/Espacio y un nombre para los que solo tienen un icono.
(function () {
  const BUTTONS = [
    `.choiceBtn`,
    `.deskIcon`,
    `.wbtn`,
    `.taskChip`,
    `.winReopen`,
    `.mItem`,
    `.oBtn`,
    `.diffBtn`,
    `.sudActBtn`,
    `.sudDiffBtn`,
    `.sudNumBtn`,
    `.pacLevelBtn`,
    `#startBtn`,
    `#creditsBtn`,
    `#creditsClose`,
    `#vibToggle`,
    `#tbHideBtn`,
    `#tbReopen`,
    `#smiley`,
    `#flagToggle`,
  ].join(`,`);
  const LABELS = {
    _: `Minimizar`,
    "✕": `Cerrar`,
    "©": `Créditos`,
    "▾": `Ocultar barra de tareas`,
    "▼": `Ocultar barra de tareas`,
    "▲": `Mostrar barra de tareas`,
    "📳": `Vibración`,
    "📴": `Vibración`,
  };
  function enhance(el) {
    if (el.hasAttribute(`role`)) return;
    el.setAttribute(`role`, `button`);
    el.tabIndex = 0;
    let text = el.textContent.trim(),
      label = el.getAttribute(`title`) || LABELS[text];
    label &&
      !el.hasAttribute(`aria-label`) &&
      el.setAttribute(`aria-label`, label);
  }
  function scan(root) {
    root.matches?.(BUTTONS) && enhance(root);
    root.querySelectorAll?.(BUTTONS).forEach(enhance);
  }
  scan(document.body);
  // Algunos botones se crean al abrir cada juego.
  new MutationObserver((records) => {
    for (let r of records)
      r.addedNodes.forEach((n) => n.nodeType === 1 && scan(n));
  }).observe(document.body, { childList: !0, subtree: !0 });

  // Mientras se ve la pantalla "¿Qué quieres jugar?", el escritorio de detrás
  // no recibe el foco del tabulador.
  let start = document.getElementById(`startScreen`),
    behind = [`desktopArea`, `taskbar`].map((id) =>
      document.getElementById(id),
    ),
    syncInert = () => {
      let open = start.style.display !== `none`;
      behind.forEach((el) => (el.inert = open));
    };
  syncInert();
  new MutationObserver(syncInert).observe(start, {
    attributes: !0,
    attributeFilter: [`style`],
  });

  // Botones que recibieron el foco con el tabulador (no con un toque o clic).
  let keyboardFocused = new WeakSet(),
    lastPointer = 0;
  document.addEventListener(
    `pointerdown`,
    () => (lastPointer = Date.now()),
    !0,
  );
  document.addEventListener(
    `focusin`,
    (e) =>
      Date.now() - lastPointer > 300
        ? keyboardFocused.add(e.target)
        : keyboardFocused.delete(e.target),
    !0,
  );

  document.addEventListener(`keydown`, (e) => {
    let el = e.target;
    // Solo si el foco llegó con el teclado: tras tocar un botón con el ratón o
    // el dedo, Espacio/Enter siguen siendo controles del juego (disparar...).
    if (
      (e.key !== `Enter` && e.key !== ` `) ||
      el.getAttribute?.(`role`) !== `button` ||
      !keyboardFocused.has(el)
    )
      return;
    e.preventDefault();
    // Los iconos del escritorio se abren con doble clic.
    el.click(), el.classList.contains(`deskIcon`) && el.click();
  });
})();
