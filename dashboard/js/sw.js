// sw.js - Service Worker para cache offline
const CACHE_NAME = 'voleyinsight-v1';
const urlsToCache = [
    '/dashboard/index.html',
    '/dashboard/anotador.html',
    '/dashboard/js/reporteGenerator.js',
    'https://cdn.tailwindcss.com',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});