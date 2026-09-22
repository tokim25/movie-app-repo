// DATA_VERSION is a content hash of every data-*.js file, auto-written by
// `node scripts/data-version.mjs` (issue #63). Folding it into CACHE_VERSION
// means sw.js's own byte content changes whenever the catalog changes, even
// if nothing else in this file was touched -- browsers detect a service
// worker update by byte-diffing the script, so a content-only commit that
// never bumped this by hand (every commit before this fix) never triggered
// a real reinstall, and a returning visitor kept seeing the previously
// cached catalog for a full extra page load with no indication anything
// was stale. Bump the version/date prefix by hand for a real code
// change to this file; DATA_VERSION takes care of itself.
const DATA_VERSION = '7380e4af39';
const CACHE_VERSION = `family-feature-v21-20260920-${DATA_VERSION}`;
const APP_SHELL = [
  '/',
  '/index.html',
  '/privacy.html',
  '/terms.html',
  '/site.webmanifest',
  '/favicon.svg',
  '/favicon-32.png',
  '/assets/icons/apple-touch-icon.png',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/movie-night-icon.svg',
  '/data.js',
  '/data-rt.js',
  '/data-dcom.js',
  '/data-disney.js',
  '/data-pixar.js',
  '/data-dreamworks.js',
  '/data-nickelodeon.js',
  '/data-extra.js',
  '/data-csm.js',
  '/data-mcudc.js',
  '/data-ghibli.js',
  '/data-posters.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_VERSION).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if(request.method !== 'GET') return;

  const url = new URL(request.url);
  if(url.origin !== self.location.origin) return;

  if(request.mode === 'navigate'){
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put('/index.html', copy));
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request).then(response => {
        if(response && response.ok){
          const copy = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
