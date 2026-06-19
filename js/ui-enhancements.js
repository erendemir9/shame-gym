/* ============================================================
   ui-enhancements.js — Premium UI layer (ui-ux-redesign-v1)
   Scroll reveal, mobile sidebar, safe class toggles only.
   Does not touch auth, localStorage, or business logic.
   ============================================================ */

(function () {
  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function initScrollReveal() {
    if (prefersReducedMotion()) {
      document.querySelectorAll(".reveal").forEach(function (el) {
        el.classList.add("is-visible");
      });
      return;
    }

    if (!("IntersectionObserver" in window)) return;

    var targets = document.querySelectorAll(
      ".card, .trainer-card, .table-wrap, .page-header, .login-card, .premium-panel"
    );

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.06, rootMargin: "0px 0px -32px 0px" }
    );

    targets.forEach(function (el, index) {
      el.classList.add("reveal");
      el.style.transitionDelay = Math.min(index * 0.04, 0.24) + "s";
      observer.observe(el);
    });
  }

  function initMobileSidebar() {
    var sidebar = document.querySelector(".sidebar");
    var toggle = document.getElementById("sidebarToggle");
    if (!sidebar || !toggle) return;

    var overlay = document.querySelector(".sidebar-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "sidebar-overlay";
      overlay.setAttribute("aria-hidden", "true");
      document.body.appendChild(overlay);
    }

    function closeSidebar() {
      document.body.classList.remove("sidebar-open");
    }

    toggle.addEventListener("click", function () {
      document.body.classList.toggle("sidebar-open");
    });

    overlay.addEventListener("click", closeSidebar);

    sidebar.querySelectorAll(".nav-link").forEach(function (link) {
      link.addEventListener("click", function () {
        if (window.innerWidth <= 768) closeSidebar();
      });
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 768) closeSidebar();
    });
  }

  function initButtonRipple() {
    if (prefersReducedMotion()) return;

    document.addEventListener("click", function (event) {
      var btn = event.target.closest(".btn-primary");
      if (!btn || btn.classList.contains("btn-loading")) return;
      btn.classList.add("btn-pressed");
      window.setTimeout(function () {
        btn.classList.remove("btn-pressed");
      }, 180);
    });
  }

  function init() {
    initScrollReveal();
    initMobileSidebar();
    initButtonRipple();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
