/* ============================================================
   ui-enhancements.js — Premium UI + Motion (v2-motion)
   Scroll reveal, 3D tilt, sidebar, button feedback.
   Does not touch auth, localStorage, or business logic.
   ============================================================ */

(function () {
  var TILT_MAX = 3;
  var TILT_LIFT = 3;
  var TILT_SELECTOR = ".stat-card, .trainer-card, .card:not(.stat-card)";
  var REVEAL_SELECTOR = [
    ".page-header",
    ".card:not(.stat-card)",
    ".trainer-card",
    ".table-wrap",
    ".login-card",
    ".premium-panel"
  ].join(", ");

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function isTouchDevice() {
    return window.matchMedia("(hover: none), (pointer: coarse)").matches;
  }

  function isMobileWidth() {
    return window.innerWidth <= 768;
  }

  function canUseTilt() {
    return !prefersReducedMotion() && !isTouchDevice() && !isMobileWidth();
  }

  function shouldSkipTilt(el) {
    if (!el) return true;
    if (el.closest(".modal-backdrop")) return true;
    if (el.classList.contains("login-card")) return true;
    if (el.querySelector("form")) return true;
    return false;
  }

  function unwrapTilt(el) {
    var inner = el.querySelector(":scope > .motion-tilt-inner");
    if (!inner) {
      el.classList.remove("motion-tilt", "motion-shine", "is-hover");
      delete el.dataset.tiltWrapped;
      return;
    }
    while (inner.firstChild) {
      el.appendChild(inner.firstChild);
    }
    inner.remove();
    el.classList.remove("motion-tilt", "motion-shine", "is-hover");
    delete el.dataset.tiltWrapped;
  }

  /* ---------- Page ready ---------- */
  function initPageMotion() {
    if (prefersReducedMotion()) {
      document.body.classList.add("motion-ready");
      return;
    }
    requestAnimationFrame(function () {
      document.body.classList.add("motion-ready");
    });
  }

  /* ---------- Scroll reveal (upgraded) ---------- */
  function initScrollReveal() {
    var targets = document.querySelectorAll(REVEAL_SELECTOR);

    if (prefersReducedMotion()) {
      targets.forEach(function (el) {
        el.classList.add("reveal", "is-visible");
      });
      return;
    }

    if (!("IntersectionObserver" in window)) {
      targets.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
    );

    targets.forEach(function (el, index) {
      if (el.classList.contains("stat-card")) {
        el.style.setProperty("--reveal-index", String(index));
        return;
      }

      el.classList.add("reveal");

      if (el.classList.contains("login-card")) {
        el.classList.add("reveal-fade");
        el.classList.add("is-visible");
        return;
      }

      if (el.classList.contains("page-header")) {
        el.classList.add("reveal-slide-left");
      } else if (el.classList.contains("trainer-card")) {
        el.classList.add("reveal-scale");
      } else if (el.classList.contains("table-wrap")) {
        el.classList.add("reveal-fade");
      } else if (el.classList.contains("premium-panel")) {
        el.classList.add("reveal-scale");
      } else {
        el.classList.add("reveal-scale");
      }

      el.classList.add("reveal-stagger");
      el.style.setProperty("--reveal-index", String(index % 8));
      observer.observe(el);
    });

    initStaggerGroups();
  }

  function initStaggerGroups() {
    document.querySelectorAll(".stats-grid, .cards-grid, .dashboard-stack").forEach(function (group) {
      var children = group.querySelectorAll(".stat-card, .trainer-card, .card, .premium-panel");
      children.forEach(function (child, i) {
        child.style.setProperty("--reveal-index", String(i));
        if (!child.classList.contains("reveal-stagger")) {
          child.classList.add("reveal-stagger");
        }
      });
    });
  }

  /* ---------- 3D card tilt ---------- */
  function wrapTiltTarget(el) {
    if (shouldSkipTilt(el)) {
      if (el.classList.contains("motion-tilt")) unwrapTilt(el);
      return;
    }

    if (el.dataset.tiltWrapped === "1") return;

    var isStat = el.classList.contains("stat-card");
    var isTrainer = el.classList.contains("trainer-card");
    var isCard = el.classList.contains("card") && !el.classList.contains("stat-card");
    var isPremium = el.classList.contains("premium-panel");

    if (!isStat && !isTrainer && !isCard && !isPremium) return;

    el.dataset.tiltWrapped = "1";
    el.classList.add("motion-tilt");

    if (el.querySelector(":scope > .motion-tilt-inner")) return;

    var inner = document.createElement("div");
    inner.className = "motion-tilt-inner";

    while (el.firstChild) {
      inner.appendChild(el.firstChild);
    }
    el.appendChild(inner);

    if (isPremium && !el.querySelector("form")) {
      el.classList.add("motion-shine");
    }

    bindTiltEvents(el);
  }

  function bindTiltEvents(card) {
    if (card.dataset.tiltBound === "1") return;
    card.dataset.tiltBound = "1";

    var rafId = null;

    function resetTilt() {
      card.classList.remove("is-hover");
      var inner = card.querySelector(".motion-tilt-inner");
      if (inner) {
        inner.style.transform = "";
        inner.style.willChange = "";
        inner.style.setProperty("--shine-x", "50%");
        inner.style.setProperty("--shine-y", "50%");
      }
    }

    function applyTilt(clientX, clientY) {
      var rect = card.getBoundingClientRect();
      var x = clientX - rect.left;
      var y = clientY - rect.top;
      var px = (x / rect.width) * 2 - 1;
      var py = (y / rect.height) * 2 - 1;
      var rotateY = px * TILT_MAX;
      var rotateX = py * -TILT_MAX;
      var inner = card.querySelector(".motion-tilt-inner");

      card.classList.add("is-hover");
      if (inner) {
        inner.style.willChange = "transform";
        inner.style.transform =
          "rotateX(" + rotateX + "deg) rotateY(" + rotateY + "deg) translateZ(" + TILT_LIFT + "px)";
        inner.style.setProperty("--shine-x", (x / rect.width * 100) + "%");
        inner.style.setProperty("--shine-y", (y / rect.height * 100) + "%");
      }
    }

    card.addEventListener("mouseenter", function () {
      card.classList.add("is-hover");
    });

    card.addEventListener("mousemove", function (event) {
      if (rafId) return;
      rafId = requestAnimationFrame(function () {
        applyTilt(event.clientX, event.clientY);
        rafId = null;
      });
    });

    card.addEventListener("mouseleave", function () {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      resetTilt();
    });
  }

  function initCardTilt() {
    document.querySelectorAll(".login-card.motion-tilt, .login-card .motion-tilt-inner").forEach(function (el) {
      var card = el.classList.contains("login-card") ? el : el.closest(".login-card");
      if (card) unwrapTilt(card);
    });

    document.querySelectorAll(TILT_SELECTOR + ", .premium-panel").forEach(function (el) {
      if (shouldSkipTilt(el)) {
        unwrapTilt(el);
        return;
      }
      if (canUseTilt()) wrapTiltTarget(el);
    });
  }

  /* ---------- Mobile sidebar ---------- */
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

  /* ---------- Button press feedback (all buttons) ---------- */
  function initButtonFeedback() {
    if (prefersReducedMotion()) return;

    document.addEventListener("click", function (event) {
      var btn = event.target.closest(".btn");
      if (!btn || btn.disabled || btn.classList.contains("btn-loading")) return;
      btn.classList.add("btn-pressed");
      window.setTimeout(function () {
        btn.classList.remove("btn-pressed");
      }, 160);
    });
  }

  /* ---------- Modal close polish (visual only) ---------- */
  function initModalMotion() {
    if (prefersReducedMotion()) return;

    document.querySelectorAll(".modal-backdrop").forEach(function (backdrop) {
      var closeTriggers = backdrop.querySelectorAll(
        ".modal-close, .btn-ghost, [id$='Cancel']"
      );

      closeTriggers.forEach(function (trigger) {
        trigger.addEventListener("click", function () {
          if (!backdrop.classList.contains("open")) return;
          backdrop.classList.add("is-closing");
          window.setTimeout(function () {
            backdrop.classList.remove("is-closing");
          }, 280);
        });
      });
    });
  }

  /* ---------- Observe dynamically added content ---------- */
  function observeDynamicContent() {
    if (!("MutationObserver" in window)) return;

    var observer = new MutationObserver(function (mutations) {
      var shouldRefresh = false;
      mutations.forEach(function (mutation) {
        if (mutation.addedNodes.length) shouldRefresh = true;
      });
      if (shouldRefresh && canUseTilt()) {
        document.querySelectorAll(TILT_SELECTOR + ", .premium-panel").forEach(function (el) {
          if (!shouldSkipTilt(el)) wrapTiltTarget(el);
        });
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  function init() {
    initPageMotion();
    initScrollReveal();
    initCardTilt();
    initMobileSidebar();
    initButtonFeedback();
    initModalMotion();
    observeDynamicContent();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
