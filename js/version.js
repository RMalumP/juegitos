/* js/version.js — Versión de la aplicación (única fuente: la usan el service worker, los créditos y el README).
   Al publicar cambios: sube APP_VERSION (y APP_FECHA). El service worker deriva de aquí el nombre de su caché, así los móviles descargan la versión nueva. */
self.APP_VERSION = '2.27.0';
self.APP_FECHA = '2.27.01-22';
