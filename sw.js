/*
  sw.js — offline cache for "The Complete Guide to Umrah"
  ---------------------------------------------------------------
  This file must live in the SAME DIRECTORY as index.html — see the
  comment block at the very top of index.html for why a separate file
  is required (service workers cannot be registered from an inline
  Blob URL in the major browsers) and for the caching strategy this
  implements. Bump CACHE_VERSION whenever index.html changes so
  visitors pick up the new copy instead of a stale cached one.
*/
"use strict";

var CACHE_VERSION = "umrah-guide-v1";

var PRECACHE_URLS = [
  "./",
  "./index.html",
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600&family=Amiri:wght@400;700&display=swap"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      return cache.addAll(PRECACHE_URLS).catch(function () {
        // Best-effort: if a font URL fails to precache (e.g. offline on
        // first install), don't block installation — it will still be
        // cached opportunistically on first successful fetch.
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_VERSION; })
            .map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

function isFontHost(url) {
  return url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
}

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;

  var url = new URL(req.url);
  var isSamePage = url.origin === self.location.origin;

  if (isSamePage || isFontHost(url)) {
    // Cache-first: the page itself, plus the Google Fonts CSS + font files.
    event.respondWith(
      caches.match(req).then(function (cached) {
        var network = fetch(req).then(function (res) {
          if (res && res.ok) {
            var clone = res.clone();
            caches.open(CACHE_VERSION).then(function (cache) { cache.put(req, clone); });
          }
          return res;
        }).catch(function () { return cached; });
        return cached || network;
      })
    );
    return;
  }

  // Network-first, falling back to cache, for everything else. Note: the
  // clickable source links (sunnah.com / quran.com / Google Maps) open in a
  // new tab via target="_blank" — that new tab is a top-level navigation to
  // a different origin, which this service worker never controls, so it
  // needs no special handling here. Offline, those links simply fail with
  // the browser's normal offline page, which is expected behaviour.
  event.respondWith(
    fetch(req).then(function (res) {
      if (res && res.ok) {
        var clone = res.clone();
        caches.open(CACHE_VERSION).then(function (cache) { cache.put(req, clone); });
      }
      return res;
    }).catch(function () { return caches.match(req); })
  );
});
