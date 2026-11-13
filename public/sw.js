/*
 * Service worker de Jeivi (mínimo y seguro):
 * - Permite instalar la app en el celular.
 * - Si no hay internet, muestra un aviso claro en vez de la pantalla de error del navegador.
 * No guarda en caché la app ni los datos: siempre se usa la versión más nueva publicada
 * y la información viene directo de Firebase.
 */
const OFFLINE = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#1a1012"><title>Sin conexión · Jeivi</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#1a1012;color:#fff;font-family:Segoe UI,Arial,sans-serif;text-align:center;padding:24px">
<div><div style="font-size:48px">📶</div><h1 style="font-size:22px;margin:12px 0 6px">Sin conexión a internet</h1>
<p style="opacity:.8;margin:0 0 20px">Jeivi necesita internet para mostrar la información de la iglesia.</p>
<button onclick="location.reload()" style="border:0;border-radius:12px;padding:12px 22px;font-size:16px;font-weight:600;background:#d4a73a;color:#1a1012">Reintentar</button></div></body></html>`;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.mode !== 'navigate') return; // todo lo demás va directo a la red
  e.respondWith(
    fetch(req).catch(() => new Response(OFFLINE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })),
  );
});
