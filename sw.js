const CACHE_NAME = 'collecte-cache-v1';
const urlsToCache = [
    '/collecte_dechets_commune_mekhe/',
    '/collecte_dechets_commune_mekhe/index.html',
    '/collecte_dechets_commune_mekhe/manifest.json',
    '/collecte_dechets_commune_mekhe/app.js',
    '/collecte_dechets_commune_mekhe/icons/icon-72.png',
    '/collecte_dechets_commune_mekhe/icons/icon-96.png',
    '/collecte_dechets_commune_mekhe/icons/icon-128.png',
    '/collecte_dechets_commune_mekhe/icons/icon-144.png',
    '/collecte_dechets_commune_mekhe/icons/icon-152.png',
    '/collecte_dechets_commune_mekhe/icons/icon-192.png',
    '/collecte_dechets_commune_mekhe/icons/icon-384.png',
    '/collecte_dechets_commune_mekhe/icons/icon-512.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});
