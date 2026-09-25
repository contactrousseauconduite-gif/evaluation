const CACHE = 'rc-eval-v11';
const FONTS = 'rc-fonts-v1';
const SHELL = ['./', './index.html', './evaluation.html', './examen.html', './eleves.html', './questions.html', './questions.js', './les-100-questions.pdf', './manifest.webmanifest', './memo-verifications-premiers-secours.pdf', './vos-donnees-personnelles.pdf', './icon-192.png', './icon-512.png', './icon-maskable-v2.png'];
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Montserrat:wght@600;700;800&display=swap';
const isFont = url => url.startsWith('https://fonts.googleapis.com/') || url.startsWith('https://fonts.gstatic.com/');

// Enregistre les polices (feuille de style + fichiers) pour qu'elles restent identiques hors connexion.
async function cacheFonts() {
  try {
    const c = await caches.open(FONTS);
    const res = await fetch(FONT_CSS, { mode: 'cors' });
    if (!res.ok) return;
    const css = await res.clone().text();
    await c.put(FONT_CSS, res);
    const urls = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(m => m[1]);
    await Promise.all(urls.map(u => fetch(u, { mode: 'cors' }).then(r => r.ok ? c.put(u, r) : null).catch(() => null)));
  } catch (e) { /* hors connexion : on réessaiera plus tard */ }
}

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => cacheFonts()).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== FONTS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // Polices : d'abord celles enregistrées sur l'appareil, sinon internet (puis on les garde).
  if (isFont(req.url)) {
    e.respondWith(caches.open(FONTS).then(c => c.match(req.url).then(hit => hit || fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) c.put(req.url, res.clone());
      return res;
    }).catch(() => new Response('', { status: 504 })))));
    return;
  }

  // Pages : réseau d'abord (mises à jour), copie enregistrée si hors connexion.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req.url.split('?')[0], copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || caches.match('./index.html'))));
    return;
  }

  // Autres fichiers : copie enregistrée d'abord, mise à jour en arrière-plan.
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => hit);
    return hit || net;
  }));
});

// Si les polices n'ont pas pu être enregistrées à l'installation, on réessaie à chaque ouverture en ligne.
self.addEventListener('message', e => { if (e.data === 'fonts') e.waitUntil(cacheFonts()); });
