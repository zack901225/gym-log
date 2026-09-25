const CACHE = 'one-more-set-v1';
const ROOT = new URL('./', self.location).href;
const SHELL = ['./', './index.html', './styles.css', './app.js', './model.js', './storage.js', './manifest.json', './icons/favicon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('one-more-set-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(ROOT)) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(caches.match(ROOT + 'index.html').then(cached => cached || fetch(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
