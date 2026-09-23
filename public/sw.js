// A deliberately small service worker: it caches the shell so the app opens
// when the network is slow, and never caches member data or photos.
var CACHE = 'oba-shell-v1';
var SHELL = ['/css/styles.css', '/js/app.js', '/img/logo.png', '/manifest.webmanifest'];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(SHELL);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE; })
            .map(function (key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Only the static shell is served from the cache; pages always go to the
  // network so members never see another member's cached page.
  if (SHELL.indexOf(url.pathname) === -1) return;

  event.respondWith(
    caches.match(request).then(function (hit) {
      return hit || fetch(request);
    })
  );
});
