const CACHE_NAME = 'pp-pwa-v1.1';

// Daftar seluruh aset statis lokal yang wajib di-precache
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/main.css',
  './css/auth.css',
  './css/dashboard.css',
  './js/config.js',
  './js/storage.js',
  './js/api.js',
  './js/ui.js',
  './js/auth.js',
  './js/dashboard.js',
  './js/app.js',
  './assets/logo-pemuda-pancasila.png',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

// 1. Install Event - Precache aset statis
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Gunakan addAll dengan penanganan error agar instalasi tidak gagal diam-diam
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('[SW] Beberapa file gagal di-precache:', err);
      });
    })
  );
  self.skipWaiting();
});

// 2. Activate Event - Bersihkan cache lama
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Menghapus cache lama:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Fetch Event - Strategi Cache Terpadu
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Abaikan request non-GET & request ke domain lain / API backend luar
  if (event.request.method !== 'GET' || requestUrl.origin !== location.origin) {
    return;
  }

  // A. STRATEGI: NETWORK FIRST (Untuk Navigasi Halaman / HTML)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // Validasi response sebelum dimasukkan ke cache
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Jika network gagal/offline, berikan index.html dari cache sebagai fallback
          return caches.match('./index.html') || caches.match('/');
        })
    );
    return;
  }

  // B. STRATEGI: STALE-WHILE-REVALIDATE (Untuk Aset Statis: CSS, JS, Gambar)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch((err) => {
          console.debug('[SW] Gagal mengambil aset terbaru dari network:', err);
        });

      // Kembalikan cache segera jika ada (Fast), jika tidak ada tunggu hasil fetch network
      return cachedResponse || fetchPromise;
    })
  );
});
