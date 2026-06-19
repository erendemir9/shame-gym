/* ============================================================
   schedules.js — class schedule management (IAP-43).
   Same pattern as the other pages. Extra detail: the trainer dropdown
   is filled from the trainers saved in localStorage, so it always
   matches the current coaching team.
   ============================================================ */

function showFieldError(input, errorEl, message) {
  errorEl.textContent = message;
  errorEl.classList.add("show");
  input.classList.add("invalid");
  input.classList.remove("shake");
  void input.offsetWidth;
  input.classList.add("shake");
}

function clearFieldError(input, errorEl) {
  errorEl.textContent = "";
  errorEl.classList.remove("show");
  input.classList.remove("invalid", "shake");
}

function formatDate(isoDate) {
  if (!isoDate) return "";
  var parts = isoDate.split("-");
  var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return parseInt(parts[2], 10) + " " + months[parseInt(parts[1], 10) - 1] + " " + parts[0];
}

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

function isMemberRole() {
  return getRole() === "member";
}

function populateTrainerSelect() {
  var select = document.getElementById("cTrainer");
  var trainers = getTrainers();
  select.innerHTML = '<option value="">Select a trainer…</option>';

  trainers.forEach(function (trainer) {
    var option = document.createElement("option");
    option.value = trainer.name;
    option.textContent = trainer.name + " (" + trainer.specialization + ")";
    select.appendChild(option);
  });
}

function textCell(text) {
  var td = document.createElement("td");
  td.textContent = text;
  return td;
}

function configureScheduleTableHeaders() {
  var headRow = document.querySelector("#schedulesTableHead tr");
  if (!headRow) return;
  headRow.innerHTML = "";

  function addHead(text) {
    var th = document.createElement("th");
    th.textContent = text;
    headRow.appendChild(th);
  }

  addHead("Class");
  addHead("Trainer");
  addHead("Date");
  addHead("Time");
  addHead("Duration");
  addHead("Spots");
  if (isMemberRole()) addHead("Actions");
}

function renderScheduleRow(item) {
  var tr = document.createElement("tr");
  var enrolled = getEnrollmentCount(item.id);
  var session = getSession();

  tr.appendChild(textCell(item.className));
  tr.appendChild(textCell(item.trainerName));
  tr.appendChild(textCell(formatDate(item.date)));
  tr.appendChild(textCell(item.time));
  tr.appendChild(textCell(item.duration + " min"));
  tr.appendChild(textCell(enrolled + " / " + item.capacity));

  if (isMemberRole()) {
    var actionsTd = document.createElement("td");
    actionsTd.className = "row-actions";

    if (isEnrolled(item.id, session.email)) {
      var badge = document.createElement("span");
      badge.className = "badge badge-green";
      badge.textContent = "Enrolled";
      badge.style.marginRight = "8px";
      actionsTd.appendChild(badge);

      var unenrollBtn = document.createElement("button");
      unenrollBtn.className = "btn btn-ghost btn-sm";
      unenrollBtn.textContent = "Unenroll";
      unenrollBtn.addEventListener("click", function () {
        unenrollFromClass(item.id, session.email);
        renderSchedules();
        showToast("Removed from " + item.className, "info");
      });
      actionsTd.appendChild(unenrollBtn);
    } else if (enrolled >= item.capacity) {
      var fullBadge = document.createElement("span");
      fullBadge.className = "badge badge-silver";
      fullBadge.textContent = "Full";
      actionsTd.appendChild(fullBadge);
    } else {
      var enrollBtn = document.createElement("button");
      enrollBtn.className = "btn btn-primary btn-sm";
      enrollBtn.textContent = "Enroll";
      enrollBtn.addEventListener("click", function () {
        var result = enrollInClass(item.id, session.email);
        if (!result.ok) {
          showToast(result.reason === "full" ? "Class is full" : "Could not enroll", "error");
          return;
        }
        renderSchedules();
        showToast("Enrolled in " + item.className, "success");
      });
      actionsTd.appendChild(enrollBtn);
    }

    tr.appendChild(actionsTd);
  }

  return tr;
}

function renderSchedules() {
  configureScheduleTableHeaders();

  var schedules = getSchedules();
  var body = document.getElementById("schedulesBody");
  body.innerHTML = "";

  if (schedules.length === 0) {
    var table = body.closest("table");
    var colCount = table.querySelectorAll("thead th").length;
    var emptyRow = document.createElement("tr");
    var cell = document.createElement("td");
    cell.colSpan = colCount;
    cell.className = "empty-state";
    renderEmptyState(cell, "No classes scheduled",
      canManageSchedules() ? "Create your first class to fill the timetable." : "There are no classes to show.",
      canManageSchedules() ? "Create class" : null, openClassModal);
    emptyRow.appendChild(cell);
    body.appendChild(emptyRow);
    return;
  }

  schedules.forEach(function (item, index) {
    var row = renderScheduleRow(item);
    row.classList.add("row-enter");
    row.style.animationDelay = (index * 0.04) + "s";
    body.appendChild(row);
  });
}

function openClassModal() {
  document.getElementById("classForm").reset();
  clearAllClassErrors();
  populateTrainerSelect();
  document.getElementById("classModal").classList.add("open");
}

function closeClassModal() {
  document.getElementById("classModal").classList.remove("open");
}

function clearAllClassErrors() {
  clearFieldError(document.getElementById("cName"), document.getElementById("cNameError"));
  clearFieldError(document.getElementById("cTrainer"), document.getElementById("cTrainerError"));
  clearFieldError(document.getElementById("cDate"), document.getElementById("cDateError"));
  clearFieldError(document.getElementById("cTime"), document.getElementById("cTimeError"));
  clearFieldError(document.getElementById("cDuration"), document.getElementById("cDurationError"));
  clearFieldError(document.getElementById("cCapacity"), document.getElementById("cCapacityError"));
}

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

function initSchedulePage() {
  if (!canManageSchedules()) {
    var addBtn = document.getElementById("addClassBtn");
    if (addBtn) addBtn.remove();
    return;
  }

  document.getElementById("addClassBtn").addEventListener("click", openClassModal);
  document.getElementById("classModalClose").addEventListener("click", closeClassModal);
  document.getElementById("classCancel").addEventListener("click", closeClassModal);

  document.getElementById("classForm").addEventListener("submit", function (event) {
    event.preventDefault();
    saveClass();
  });

  document.getElementById("classModal").addEventListener("click", function (event) {
    if (event.target === this) closeClassModal();
  });
}

function renderEnrolledClassesList(containerId) {
  var container = document.getElementById(containerId);
  if (!container) return;

  var session = getSession();
  var classes = getEnrolledClassesForMember(session.email).sort(function (a, b) {
    return (a.date + a.time).localeCompare(b.date + b.time);
  });

  container.innerHTML = "";
  if (classes.length === 0) {
    var empty = document.createElement("p");
    empty.className = "subtitle";
    empty.textContent = "You are not enrolled in any classes yet.";
    container.appendChild(empty);
    return;
  }

  var list = document.createElement("ul");
  list.className = "simple-list";
  classes.forEach(function (item) {
    var li = document.createElement("li");
    li.textContent = item.className + " — " + formatDate(item.date) + " at " + item.time + " with " + item.trainerName;
    list.appendChild(li);
  });
  container.appendChild(list);
}
