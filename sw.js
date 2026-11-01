// Service worker simples: guarda os arquivos do app para abrir mesmo sem internet. Dados vêm sempre do Supabase.
const CACHE = 'tripsync-v11';
const ARQUIVOS = ['./', 'index.html', 'style.css', 'app.js', 'core.js', 'mapa.js', 'i18n.js', 'config.js', 'manifest.json', 'icon.svg'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(k => k.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});
