/* ============================================================
   trainers.js — trainer management (IAP-40 add trainer).
   Same pattern as members, but rendered as a grid of cards:
     renderTrainers()  -> draw cards from the saved array
     validate -> save -> re-render -> showToast
   ============================================================ */

// ---------- SMALL SHARED FORM HELPERS ----------
// (Same helpers as the other CRUD pages so every form behaves identically.)

// Show a red message under a field and shake the input once.
function showFieldError(input, errorEl, message) {
  errorEl.textContent = message;
  errorEl.classList.add("show");
  input.classList.add("invalid");
  input.classList.remove("shake");
  void input.offsetWidth;      // force reflow so the shake can replay
  input.classList.add("shake");
}

// Clear a field's error state.
function clearFieldError(input, errorEl) {
  errorEl.textContent = "";
  errorEl.classList.remove("show");
  input.classList.remove("invalid", "shake");
}

// Very simple email check: something@something.something
function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Build the initials shown in the round avatar, e.g. "Marcus Hale" -> "MH".
function getInitials(name) {
  var words = name.trim().split(/\s+/);
  var first = words[0] ? words[0][0] : "";
  var last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}

// Fill a container with a centered empty-state: a title, a message, and an
// optional call-to-action button (ctaLabel is only passed for admins).
function renderEmptyState(container, title, message, ctaLabel, ctaHandler) {
  container.innerHTML = "";
  var t = document.createElement("div");
  t.className = "empty-title";
  t.textContent = title;
  container.appendChild(t);

  var m = document.createElement("div");
  m.textContent = message;
  container.appendChild(m);

  if (ctaLabel) {
    var btn = document.createElement("button");
    btn.className = "btn btn-primary";
    btn.textContent = ctaLabel;
    btn.addEventListener("click", ctaHandler);
    container.appendChild(btn);
  }
}

// ---------- RENDERING ----------

// Build one trainer card element.
function renderTrainerCard(trainer) {
  var card = document.createElement("div");
  card.className = "trainer-card";

  // Avatar with the trainer's initials.
  var avatar = document.createElement("div");
  avatar.className = "trainer-avatar";
  avatar.textContent = getInitials(trainer.name);
  card.appendChild(avatar);

  // Name.
  var name = document.createElement("div");
  name.className = "trainer-name";
  name.textContent = trainer.name;
  card.appendChild(name);

  // Specialization (blue badge) + availability (silver badge).
  var meta = document.createElement("div");
  meta.className = "trainer-meta";

  var spec = document.createElement("span");
  spec.className = "badge badge-blue";
  spec.textContent = trainer.specialization;
  meta.appendChild(spec);

  var avail = document.createElement("span");
  avail.className = "badge badge-silver";
  avail.textContent = trainer.availability;
  meta.appendChild(avail);

  card.appendChild(meta);

  // Contact details.
  var contact = document.createElement("div");
  contact.className = "trainer-contact";
  contact.textContent = trainer.email + " · " + trainer.phone;
  card.appendChild(contact);

  return card;
}

// Read trainers from localStorage and (re)draw the whole grid.
function renderTrainers() {
  var trainers = getTrainers();
  var grid = document.getElementById("trainersGrid");
  grid.innerHTML = ""; // clear before redrawing

  if (trainers.length === 0) {
    var empty = document.createElement("div");
    empty.className = "empty-state";
    // The grid is a CSS grid; let the empty state span the full width.
    empty.style.gridColumn = "1 / -1";
    renderEmptyState(empty, "No trainers yet",
      canManageTrainers() ? "Add your first trainer to build the team." : "There are no trainers to show.",
      canManageTrainers() ? "Add trainer" : null, openTrainerModal);
    grid.appendChild(empty);
    return;
  }

  trainers.forEach(function (trainer) {
    grid.appendChild(renderTrainerCard(trainer));
  });
}

// ---------- MODAL ----------

// Open the modal ready to add a trainer.
function openTrainerModal() {
  document.getElementById("trainerForm").reset();
  clearAllTrainerErrors();
  document.getElementById("trainerModal").classList.add("open");
}

// Close the modal.
function closeTrainerModal() {
  document.getElementById("trainerModal").classList.remove("open");
}

// Clear every field error in the trainer form.
function clearAllTrainerErrors() {
  clearFieldError(document.getElementById("tName"), document.getElementById("tNameError"));
  clearFieldError(document.getElementById("tEmail"), document.getElementById("tEmailError"));
  clearFieldError(document.getElementById("tPhone"), document.getElementById("tPhoneError"));
  clearFieldError(document.getElementById("tSpec"), document.getElementById("tSpecError"));
  clearFieldError(document.getElementById("tAvail"), document.getElementById("tAvailError"));
}

// ---------- VALIDATE + SAVE ----------

// Check the form. Returns true when every field is valid.
function validateTrainerForm() {
  var ok = true;
  clearAllTrainerErrors();

  var name = document.getElementById("tName");
  var email = document.getElementById("tEmail");
  var phone = document.getElementById("tPhone");
  var spec = document.getElementById("tSpec");
  var avail = document.getElementById("tAvail");

  if (name.value.trim() === "") {
    showFieldError(name, document.getElementById("tNameError"), "Full name is required.");
    ok = false;
  }
  if (email.value.trim() === "") {
    showFieldError(email, document.getElementById("tEmailError"), "Email is required.");
    ok = false;
  } else if (!isValidEmail(email.value.trim())) {
    showFieldError(email, document.getElementById("tEmailError"), "Enter a valid email address.");
    ok = false;
  }
  if (phone.value.trim() === "") {
    showFieldError(phone, document.getElementById("tPhoneError"), "Phone number is required.");
    ok = false;
  }
  if (spec.value === "") {
    showFieldError(spec, document.getElementById("tSpecError"), "Choose a specialization.");
    ok = false;
  }
  if (avail.value === "") {
    showFieldError(avail, document.getElementById("tAvailError"), "Choose an availability.");
    ok = false;
  }
  return ok;
}

// Save a new trainer: validate, push, persist, re-render, toast.
function saveTrainer() {
  if (!validateTrainerForm()) return;

  var trainers = getTrainers();
  trainers.push({
    id: generateId(),
    name: document.getElementById("tName").value.trim(),
    email: document.getElementById("tEmail").value.trim(),
    phone: document.getElementById("tPhone").value.trim(),
    specialization: document.getElementById("tSpec").value,
    availability: document.getElementById("tAvail").value
  });
  saveTrainers(trainers);

  closeTrainerModal();
  renderTrainers();
  showToast("Trainer added successfully", "success");
}

// ---------- WIRING ----------

// Connect the Add button, modal buttons and form submit. Called once on load.
// Non-admins get a read-only page: we REMOVE the add button entirely.
function initTrainerPage() {
  if (!canManageTrainers()) {
    var addBtn = document.getElementById("addTrainerBtn");
    if (addBtn) addBtn.remove();
    return; // nothing to wire for read-only users
  }

  document.getElementById("addTrainerBtn").addEventListener("click", openTrainerModal);
  document.getElementById("trainerModalClose").addEventListener("click", closeTrainerModal);
  document.getElementById("trainerCancel").addEventListener("click", closeTrainerModal);

  document.getElementById("trainerForm").addEventListener("submit", function (event) {
    event.preventDefault();
    saveTrainer();
  });

  // Clicking the backdrop closes the modal.
  document.getElementById("trainerModal").addEventListener("click", function (event) {
    if (event.target === this) closeTrainerModal();
  });
}
