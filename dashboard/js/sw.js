// Service Worker para recursos estáticos y funcionamiento offline.
const CACHE_NAME = 'voleyinsight-v3.0.2-final-seguro';
const STATIC_ASSETS = [
    '/dashboard/index.html',
    '/dashboard/css/styles.css',
    '/dashboard/js/dashboard.js',
    '/dashboard/js/formacionHelper.js',
    '/dashboard/js/rotacionHelper.js',
    '/dashboard/js/metricasVoleyHelper.js',
    '/dashboard/js/partidoHelper.js',
    '/dashboard/js/reporteGenerator.js',
    '/dashboard/js/StatsHelper.js',
    '/dashboard/js/utils.js',
    '/dashboard/logo-horizontal.png',
    '/dashboard/logo-icon-192.png',
    '/dashboard/logo-icon-512.png',
    '/dashboard/favicon-64.png',
    '/dashboard/site.webmanifest'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys
                    .filter(key => key.startsWith('voleyinsight-') && key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);

    if (
        request.method !== 'GET' ||
        url.origin !== self.location.origin ||
        url.pathname.startsWith('/api/') ||
        url.pathname.startsWith('/data/')
    ) {
        return;
    }

    event.respondWith(
        fetch(request)
            .then(response => {
                if (response.ok) {
                    const copia = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, copia));
                }
                return response;
            })
            .catch(() => caches.match(request))
    );
});
