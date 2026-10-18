/* Voice Shift PWA — Offline Service Worker */
"use strict";

const CACHE_PREFIX = "voice-shift-pwa-";
const CACHE_NAME = `${CACHE_PREFIX}v2`;
const APP_BASE = self.registration.scope;

const CORE_FILES = [
  "index.html",
  "styles.css",
  "app.js",
  "manifest.webmanifest"
];

const OPTIONAL_FILES = [
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png"
];

function scopedUrl(path) {
  return new URL(path, APP_BASE).toString();
}

/* INSTALL: Cache the essential app files */
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    for (const file of CORE_FILES) {
      const url = scopedUrl(file);

      const response = await fetch(url, {
        cache: "reload"
      });

      if (!response.ok) {
        throw new Error(
          `Could not cache ${file}: HTTP ${response.status}`
        );
      }

      await cache.put(url, response);
    }

    /* Icons are optional; their failure must not stop installation. */
    await Promise.all(
      OPTIONAL_FILES.map(async (file) => {
        try {
          const url = scopedUrl(file);
          const response = await fetch(url, {
            cache: "reload"
          });

          if (response.ok) {
            await cache.put(url, response);
          }
        } catch (error) {
          console.warn("Optional icon could not be cached:", file);
        }
      })
    );

    await self.skipWaiting();
  })());
});

/* ACTIVATE: Remove old Voice Shift caches */
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    await Promise.all(
      keys.map((key) => {
        if (
          key.startsWith(CACHE_PREFIX) &&
          key !== CACHE_NAME
        ) {
          return caches.delete(key);
        }

        return Promise.resolve(false);
      })
    );

    await self.clients.claim();
  })());
});

/* FETCH: Load the app offline */
self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);

  /* Do not intercept requests to other websites. */
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  /* Navigation: network first, cached page as fallback. */
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);

        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);

          await cache.put(
            scopedUrl("index.html"),
            response.clone()
          );
        }

        return response;
      } catch (error) {
        const cachedPage =
          await caches.match(request) ||
          await caches.match(scopedUrl("index.html"));

        if (cachedPage) {
          return cachedPage;
        }

        return new Response(
          "Voice Shift is not available offline yet. " +
          "Open the app once while online, then try again.",
          {
            status: 503,
            headers: {
              "Content-Type": "text/plain; charset=utf-8"
            }
          }
        );
      }
    })());

    return;
  }

  /* App resources: cache first, then network. */
  event.respondWith((async () => {
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    try {
      const response = await fetch(request);

      if (response && response.ok) {
        const cache = await caches.open(CACHE_NAME);

        await cache.put(
          request,
          response.clone()
        );
      }

      return response;
    } catch (error) {
      return new Response(
        "This file is not cached for offline use.",
        {
          status: 503,
          headers: {
            "Content-Type": "text/plain; charset=utf-8"
          }
        }
      );
    }
  })());
});
