/* ============================================================
   members.js — member management (IAP-38 register).
   Pattern reused on every list page:
     renderMembers()  -> draw the table from the saved array
     validate -> save -> re-render -> showToast
   ============================================================ */

// ---------- SMALL SHARED FORM HELPERS ----------
// (Same helpers appear on each CRUD page so every form behaves identically.)

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

// Turn "2025-09-12" into "12 Sep 2025" for nicer display.
function formatDate(isoDate) {
  if (!isoDate) return "";
  var parts = isoDate.split("-"); // [year, month, day]
  var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return parseInt(parts[2], 10) + " " + months[parseInt(parts[1], 10) - 1] + " " + parts[0];
}

// ---------- RENDERING ----------

// Pick a badge colour from the membership type.
function membershipBadgeClass(type) {
  if (type === "VIP") return "badge-purple";
  if (type === "Premium") return "badge-blue";
  return "badge-silver"; // Basic
}

// Build a small <td> with plain text (textContent avoids HTML injection).
function textCell(text) {
  var td = document.createElement("td");
  td.textContent = text;
  return td;
}

// Build one table row for a member.
function renderMemberRow(member) {
  var tr = document.createElement("tr");

  tr.appendChild(textCell(member.name));
  tr.appendChild(textCell(member.email));
  tr.appendChild(textCell(member.phone));

  // Membership column is a coloured badge.
  var typeTd = document.createElement("td");
  var badge = document.createElement("span");
  badge.className = "badge " + membershipBadgeClass(member.type);
  badge.textContent = member.type;
  typeTd.appendChild(badge);
  tr.appendChild(typeTd);

  tr.appendChild(textCell(formatDate(member.startDate)));

  // Actions column (Edit button is added in IAP-39).
  var actionsTd = document.createElement("td");
  actionsTd.className = "row-actions";
  tr.appendChild(actionsTd);

  return tr;
}

// Read members from localStorage and (re)draw the whole table body.
function renderMembers() {
  var members = getMembers();
  var body = document.getElementById("membersBody");
  body.innerHTML = ""; // clear before redrawing

  if (members.length === 0) {
    var emptyRow = document.createElement("tr");
    var cell = document.createElement("td");
    cell.colSpan = 6;
    cell.className = "empty-state";
    cell.textContent = "No members yet. Add your first member to get started.";
    emptyRow.appendChild(cell);
    body.appendChild(emptyRow);
    return;
  }

  members.forEach(function (member) {
    body.appendChild(renderMemberRow(member));
  });
}

// ---------- MODAL ----------

// Open the modal ready to add a new member (empty fields).
function openMemberModal() {
  document.getElementById("memberModalTitle").textContent = "Add member";
  document.getElementById("memberForm").reset();
  clearAllMemberErrors();
  document.getElementById("memberModal").classList.add("open");
}

// Close the modal.
function closeMemberModal() {
  document.getElementById("memberModal").classList.remove("open");
}

// Clear every field error in the member form.
function clearAllMemberErrors() {
  clearFieldError(document.getElementById("mName"), document.getElementById("mNameError"));
  clearFieldError(document.getElementById("mEmail"), document.getElementById("mEmailError"));
  clearFieldError(document.getElementById("mPhone"), document.getElementById("mPhoneError"));
  clearFieldError(document.getElementById("mType"), document.getElementById("mTypeError"));
  clearFieldError(document.getElementById("mStart"), document.getElementById("mStartError"));
}

// ---------- VALIDATE + SAVE ----------

// Check the form. Returns true when every field is valid.
function validateMemberForm() {
  var ok = true;
  clearAllMemberErrors();

  var name = document.getElementById("mName");
  var email = document.getElementById("mEmail");
  var phone = document.getElementById("mPhone");
  var type = document.getElementById("mType");
  var start = document.getElementById("mStart");

  if (name.value.trim() === "") {
    showFieldError(name, document.getElementById("mNameError"), "Full name is required.");
    ok = false;
  }
  if (email.value.trim() === "") {
    showFieldError(email, document.getElementById("mEmailError"), "Email is required.");
    ok = false;
  } else if (!isValidEmail(email.value.trim())) {
    showFieldError(email, document.getElementById("mEmailError"), "Enter a valid email address.");
    ok = false;
  }
  if (phone.value.trim() === "") {
    showFieldError(phone, document.getElementById("mPhoneError"), "Phone number is required.");
    ok = false;
  }
  if (type.value === "") {
    showFieldError(type, document.getElementById("mTypeError"), "Choose a membership type.");
    ok = false;
  }
  if (start.value === "") {
    showFieldError(start, document.getElementById("mStartError"), "Start date is required.");
    ok = false;
  }
  return ok;
}

// Save a new member: validate, push to the array, persist, re-render, toast.
function saveMember() {
  if (!validateMemberForm()) return;

  var members = getMembers();
  members.push({
    id: generateId(),
    name: document.getElementById("mName").value.trim(),
    email: document.getElementById("mEmail").value.trim(),
    phone: document.getElementById("mPhone").value.trim(),
    type: document.getElementById("mType").value,
    startDate: document.getElementById("mStart").value
  });
  saveMembers(members);

  closeMemberModal();
  renderMembers();
  showToast("Member added successfully", "success");
}

// ---------- WIRING ----------

// Connect the Add button, modal buttons and form submit. Called once on load.
function initMemberPage() {
  document.getElementById("addMemberBtn").addEventListener("click", openMemberModal);
  document.getElementById("memberModalClose").addEventListener("click", closeMemberModal);
  document.getElementById("memberCancel").addEventListener("click", closeMemberModal);

  // Submitting the form saves the member.
  document.getElementById("memberForm").addEventListener("submit", function (event) {
    event.preventDefault();
    saveMember();
  });

  // Clicking the dark backdrop (outside the panel) closes the modal.
  document.getElementById("memberModal").addEventListener("click", function (event) {
    if (event.target === this) closeMemberModal();
  });
}
