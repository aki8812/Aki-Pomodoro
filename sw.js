const CACHE_NAME = 'pomodoro-v1';
const ASSETS = [
    './index.html',
    './style.css',
    './script.js',
    './manifest.json',
    './favicon.ico',
    './icon/icon-512x512.png',
    'https://cdn.tailwindcss.com',
    'https://fonts.gstatic.com/s/i/materialicons/timer/v1/24px.svg'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((response) => response || fetch(e.request))
    );
});
