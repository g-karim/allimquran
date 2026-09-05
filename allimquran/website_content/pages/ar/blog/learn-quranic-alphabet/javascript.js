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
})();
