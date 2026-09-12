"use strict";

var cacheName = "quran-companion-prototype-v88";
var localAssets = [
  "./?v=86",
  "./index.html?v=86",
  "./styles.css?v=86",
  "./quran-data.js?v=80",
  "./tafsir-data.js?v=80",
  "./app.js?v=86",
  "./manifest.webmanifest?v=80",
  "./allim-brand-icon.png",
  "./assets/audio/allim-dua-ar-v2.m4a"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(cacheName).then(function (cache) {
      return cache.addAll(localAssets);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) {
        return key !== cacheName;
      }).map(function (key) {
        return caches.delete(key);
      }));
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  var requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;
  if (requestUrl.pathname.indexOf("/api/") === 0) return;
  event.respondWith(
    fetch(event.request).then(function (response) {
      var copy = response.clone();
      caches.open(cacheName).then(function (cache) {
        cache.put(event.request, copy);
      });
      return response;
    }).catch(function () {
      return caches.match(event.request).then(function (cached) {
        if (cached) return cached;
        if (event.request.mode === "navigate") return caches.match("./index.html?v=86");
        return null;
      });
    })
  );
});
