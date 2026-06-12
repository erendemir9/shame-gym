/* ============================================================
   schedules.js — class schedule management (IAP-43).
   Same pattern as the other pages. Extra detail: the trainer dropdown
   is filled from the trainers saved in localStorage, so it always
   matches the current coaching team.
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

// Turn "2026-06-15" into "15 Jun 2026" for nicer display.
function formatDate(isoDate) {
  if (!isoDate) return "";
  var parts = isoDate.split("-");
  var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return parseInt(parts[2], 10) + " " + months[parseInt(parts[1], 10) - 1] + " " + parts[0];
}

// ---------- TRAINER DROPDOWN ----------

// Fill the trainer <select> with one <option> per saved trainer.
// Called whenever the modal opens so newly added trainers show up.
function populateTrainerSelect() {
  var select = document.getElementById("cTrainer");
  var trainers = getTrainers();

  // Start fresh with just the placeholder option.
  select.innerHTML = '<option value="">Select a trainer…</option>';

  trainers.forEach(function (trainer) {
    var option = document.createElement("option");
    // We store the trainer's name on the schedule, so use it as the value.
    option.value = trainer.name;
    option.textContent = trainer.name + " (" + trainer.specialization + ")";
    select.appendChild(option);
  });
}

// ---------- RENDERING ----------

// Build a small <td> with plain text.
function textCell(text) {
  var td = document.createElement("td");
  td.textContent = text;
  return td;
}

// Build one table row for a scheduled class.
function renderScheduleRow(item) {
  var tr = document.createElement("tr");
  tr.appendChild(textCell(item.className));
  tr.appendChild(textCell(item.trainerName));
  tr.appendChild(textCell(formatDate(item.date)));
  tr.appendChild(textCell(item.time));
  tr.appendChild(textCell(item.duration + " min"));
  tr.appendChild(textCell(item.capacity + " spots"));
  return tr;
}

// Read schedules from localStorage and (re)draw the whole table body.
function renderSchedules() {
  var schedules = getSchedules();
  var body = document.getElementById("schedulesBody");
  body.innerHTML = ""; // clear before redrawing

  if (schedules.length === 0) {
    var emptyRow = document.createElement("tr");
    var cell = document.createElement("td");
    cell.colSpan = 6;
    cell.className = "empty-state";
    cell.textContent = "No classes scheduled yet. Create your first class.";
    emptyRow.appendChild(cell);
    body.appendChild(emptyRow);
    return;
  }

  schedules.forEach(function (item) {
    body.appendChild(renderScheduleRow(item));
  });
}

// ---------- MODAL ----------

// Open the modal ready to create a class (and refresh the trainer list).
function openClassModal() {
  document.getElementById("classForm").reset();
  clearAllClassErrors();
  populateTrainerSelect();
  document.getElementById("classModal").classList.add("open");
}

// Close the modal.
function closeClassModal() {
  document.getElementById("classModal").classList.remove("open");
}

// Clear every field error in the class form.
function clearAllClassErrors() {
  clearFieldError(document.getElementById("cName"), document.getElementById("cNameError"));
  clearFieldError(document.getElementById("cTrainer"), document.getElementById("cTrainerError"));
  clearFieldError(document.getElementById("cDate"), document.getElementById("cDateError"));
  clearFieldError(document.getElementById("cTime"), document.getElementById("cTimeError"));
  clearFieldError(document.getElementById("cDuration"), document.getElementById("cDurationError"));
  clearFieldError(document.getElementById("cCapacity"), document.getElementById("cCapacityError"));
}

// ---------- VALIDATE + SAVE ----------

// Check the form. Returns true when every field is valid.
function validateClassForm() {
  var ok = true;
  clearAllClassErrors();

  var name = document.getElementById("cName");
  var trainer = document.getElementById("cTrainer");
  var date = document.getElementById("cDate");
  var time = document.getElementById("cTime");
  var duration = document.getElementById("cDuration");
  var capacity = document.getElementById("cCapacity");

  if (name.value.trim() === "") {
    showFieldError(name, document.getElementById("cNameError"), "Class name is required.");
    ok = false;
  }
  if (trainer.value === "") {
    showFieldError(trainer, document.getElementById("cTrainerError"), "Choose a trainer.");
    ok = false;
  }
  if (date.value === "") {
    showFieldError(date, document.getElementById("cDateError"), "Date is required.");
    ok = false;
  }
  if (time.value === "") {
    showFieldError(time, document.getElementById("cTimeError"), "Time is required.");
    ok = false;
  }
  // Duration and capacity must be whole numbers greater than zero.
  if (duration.value === "" || Number(duration.value) <= 0) {
    showFieldError(duration, document.getElementById("cDurationError"), "Enter a duration in minutes.");
    ok = false;
  }
  if (capacity.value === "" || Number(capacity.value) <= 0) {
    showFieldError(capacity, document.getElementById("cCapacityError"), "Enter a capacity.");
    ok = false;
  }
  return ok;
}

// Save a new class: validate, push, persist, re-render, toast.
function saveClass() {
  if (!validateClassForm()) return;

  var schedules = getSchedules();
  schedules.push({
    id: generateId(),
    className: document.getElementById("cName").value.trim(),
    trainerName: document.getElementById("cTrainer").value,
    date: document.getElementById("cDate").value,
    time: document.getElementById("cTime").value,
    duration: Number(document.getElementById("cDuration").value),
    capacity: Number(document.getElementById("cCapacity").value)
  });
  saveSchedules(schedules);

  closeClassModal();
  renderSchedules();
  showToast("Class created successfully", "success");
}

// ---------- WIRING ----------

// Connect the Create button, modal buttons and form submit. Called once on load.
function initSchedulePage() {
  document.getElementById("addClassBtn").addEventListener("click", openClassModal);
  document.getElementById("classModalClose").addEventListener("click", closeClassModal);
  document.getElementById("classCancel").addEventListener("click", closeClassModal);

  document.getElementById("classForm").addEventListener("submit", function (event) {
    event.preventDefault();
    saveClass();
  });

  // Clicking the backdrop closes the modal.
  document.getElementById("classModal").addEventListener("click", function (event) {
    if (event.target === this) closeClassModal();
  });
}
