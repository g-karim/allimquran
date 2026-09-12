(function () {
  "use strict";

  var root = document.querySelector(".insights-page");
  var header = document.querySelector(".insights-header");
  var menu = document.querySelector(".menu-toggle");
  if (!root || !header || !menu) return;

  document.documentElement.lang = root.getAttribute("data-lang") || "en";
  document.documentElement.dir = root.getAttribute("data-dir") || "ltr";

  menu.addEventListener("click", function () {
    var opened = header.classList.toggle("menu-open");
    menu.setAttribute("aria-expanded", String(opened));
  });

  header.querySelectorAll("nav a").forEach(function (link) {
    link.addEventListener("click", function () {
      header.classList.remove("menu-open");
      menu.setAttribute("aria-expanded", "false");
    });
  });

  var observer = "IntersectionObserver" in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 }) : null;

  document.querySelectorAll(".article-card, .featured-card, .editorial-note, .insights-cta").forEach(function (element) {
    if (observer) observer.observe(element);
    else element.classList.add("is-visible");
  });

  var locale = (root.getAttribute("data-locale") || "").toUpperCase();
  document.querySelectorAll(".locale-switch a").forEach(function (link) {
    if (link.textContent.trim().toUpperCase() === locale) {
      link.classList.add("is-current");
      link.setAttribute("aria-current", "page");
    }
  });

  var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var precisePointer = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (!reducedMotion && precisePointer) {
    document.querySelectorAll(".article-card").forEach(function (card) {
      card.addEventListener("pointermove", function (event) {
        var rect = card.getBoundingClientRect();
        var x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        var y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
        card.style.setProperty("--pointer-x", (x * 100).toFixed(1) + "%");
        card.style.setProperty("--pointer-y", (y * 100).toFixed(1) + "%");
        card.style.setProperty("--tilt-x", ((0.5 - y) * 2.2).toFixed(2) + "deg");
        card.style.setProperty("--tilt-y", ((x - 0.5) * 2.8).toFixed(2) + "deg");
      });
      card.addEventListener("pointerleave", function () {
        card.style.removeProperty("--tilt-x");
        card.style.removeProperty("--tilt-y");
        card.style.removeProperty("--pointer-x");
        card.style.removeProperty("--pointer-y");
        card.classList.remove("is-opening");
      });
      card.addEventListener("pointerdown", function () { card.classList.add("is-opening"); });
      card.addEventListener("pointerup", function () { card.classList.remove("is-opening"); });
    });
  }
})();
