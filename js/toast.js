/* ============================================================
   toast.js — one reusable toast notification used by every page.
   Call showToast("Saved!", "success"). Types: "success" | "error" | "info".
   ============================================================ */

// Find the toast container, or create it once and add it to the page.
// This lets any page call showToast() without adding markup itself.
function getToastContainer() {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  return container;
}

// Show a toast that slides in from the top-right and auto-hides after ~3s.
function showToast(message, type) {
  const container = getToastContainer();

  // Build the toast element. The type just adds a colour class.
  const toast = document.createElement("div");
  toast.className = "toast toast-" + (type || "info");
  toast.textContent = message;
  container.appendChild(toast);

  // After 3 seconds, play the exit animation then remove the element.
  setTimeout(function () {
    toast.classList.add("leaving");
    toast.addEventListener("animationend", function () {
      toast.remove();
    });
  }, 3000);
}
