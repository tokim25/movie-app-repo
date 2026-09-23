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
const DATA_VERSION = '4b481d9065';
const CACHE_VERSION = `family-feature-v22-20260922-${DATA_VERSION}`;
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

// Issue #118: static documents outside the SPA route that still get
// precached and need their own offline availability, not the app shell's.
const STATIC_DOCUMENT_PATHS = ['/privacy.html', '/terms.html'];

self.addEventListener('fetch', event => {
  const request = event.request;
  if(request.method !== 'GET') return;

  const url = new URL(request.url);
  if(url.origin !== self.location.origin) return;

  if(request.mode === 'navigate'){
    // Issue #118: every navigation used to be treated as the app route --
    // caching whatever page loaded (including privacy.html/terms.html)
    // under '/index.html' unconditionally (even a same-origin 404/5xx),
    // and always falling back to '/index.html' on failure. That let an
    // online visit to a policy page silently overwrite the cached app
    // shell (so a later offline launch of '/' could render Terms instead
    // of the app), and made an offline direct visit to a policy page
    // render the app shell instead of the page that was actually
    // requested. Each known static document is now cached/recovered under
    // its own path; only the actual app route uses the app-shell key, and
    // only a successful response ever gets cached either way.
    const cacheKey = STATIC_DOCUMENT_PATHS.includes(url.pathname) ? url.pathname : '/index.html';
    event.respondWith(
      fetch(request)
        .then(response => {
          if(response && response.ok){
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.put(cacheKey, copy)));
          }
          return response;
        })
        .catch(() => caches.match(cacheKey))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request).then(response => {
        if(response && response.ok){
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.put(request, copy)));
        }
        return response;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
