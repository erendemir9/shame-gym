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

function isTrainerView() {
  return getRole() === "trainer";
}

function canViewScheduleRoster() {
  return canManageSchedules() || isTrainerView();
}

function getLoggedInTrainerName() {
  var session = getSession();
  if (!session) return "";

  var sessionEmail = session.email ? session.email.trim().toLowerCase() : "";
  var trainers = getTrainers();
  for (var i = 0; i < trainers.length; i++) {
    if (trainers[i].email && trainers[i].email.trim().toLowerCase() === sessionEmail) {
      return trainers[i].name;
    }
  }
  return session.name || "";
}

function getSchedulesForView() {
  var schedules = getSchedules();
  if (!isTrainerView()) return schedules;

  var trainerName = getLoggedInTrainerName();
  return schedules.filter(function (item) {
    return item.trainerName === trainerName;
  });
}

var editingClassId = null;
var activeRosterClass = null;

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

function createRosterButton(item) {
  var rosterBtn = document.createElement("button");
  rosterBtn.className = "btn btn-ghost btn-sm";
  rosterBtn.textContent = "Roster";
  rosterBtn.addEventListener("click", function () {
    openRosterModal(item);
  });
  return rosterBtn;
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
  if (!isTrainerView()) addHead("Trainer");
  addHead("Date");
  addHead("Time");
  addHead("Duration");
  addHead("Spots");
  if (isMemberRole() || canManageSchedules() || isTrainerView()) addHead("Actions");
}

function renderScheduleRow(item) {
  var tr = document.createElement("tr");
  var enrolled = getEnrollmentCount(item.id);
  var session = getSession();

  tr.appendChild(textCell(item.className));
  if (!isTrainerView()) tr.appendChild(textCell(item.trainerName));
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
  } else if (canManageSchedules()) {
    var adminActionsTd = document.createElement("td");
    adminActionsTd.className = "row-actions";

    var editBtn = document.createElement("button");
    editBtn.className = "btn btn-ghost btn-sm";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", function () {
      openClassModalForEdit(item);
    });

    var deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-ghost btn-sm";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", function () {
      deleteClass(item);
    });

    adminActionsTd.appendChild(editBtn);
    adminActionsTd.appendChild(deleteBtn);
    adminActionsTd.appendChild(createRosterButton(item));
    tr.appendChild(adminActionsTd);
  } else if (isTrainerView()) {
    var trainerActionsTd = document.createElement("td");
    trainerActionsTd.className = "row-actions";
    trainerActionsTd.appendChild(createRosterButton(item));
    tr.appendChild(trainerActionsTd);
  }

  return tr;
}

function renderSchedules() {
  configureScheduleTableHeaders();

  var schedules = getSchedulesForView();
  var body = document.getElementById("schedulesBody");
  body.innerHTML = "";

  if (schedules.length === 0) {
    var table = body.closest("table");
    var colCount = table.querySelectorAll("thead th").length;
    var emptyRow = document.createElement("tr");
    var cell = document.createElement("td");
    cell.colSpan = colCount;
    cell.className = "empty-state";

    if (isTrainerView()) {
      renderEmptyState(cell, "No classes assigned", "You have no classes assigned to you yet.", null, null);
    } else if (canManageSchedules()) {
      renderEmptyState(cell, "No classes scheduled",
        "Create your first class to fill the timetable.",
        "Create class", openClassModal);
    } else {
      renderEmptyState(cell, "No classes scheduled", "There are no classes to show.", null, null);
    }

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

function openRosterModal(item) {
  activeRosterClass = item;
  document.getElementById("rosterModalTitle").textContent = item.className;
  document.getElementById("rosterModalSubtitle").textContent =
    formatDate(item.date) + " at " + item.time + " · with " + item.trainerName;
  renderRosterList();
  document.getElementById("rosterModal").classList.add("open");
}

function closeRosterModal() {
  activeRosterClass = null;
  document.getElementById("rosterModal").classList.remove("open");
}

function renderRosterList() {
  var body = document.getElementById("rosterBody");
  body.innerHTML = "";
  if (!activeRosterClass) return;

  var roster = getEnrollmentRoster(activeRosterClass.id);
  if (roster.length === 0) {
    var empty = document.createElement("p");
    empty.className = "subtitle";
    empty.textContent = "No members enrolled yet.";
    body.appendChild(empty);
    return;
  }

  roster.forEach(function (entry) {
    var row = document.createElement("div");
    row.className = "roster-row";

    var info = document.createElement("div");
    info.className = "roster-entry-info";

    var name = document.createElement("div");
    name.className = "roster-entry-name";
    name.textContent = entry.name;

    var email = document.createElement("div");
    email.className = "roster-entry-email";
    email.textContent = entry.email;

    info.appendChild(name);
    info.appendChild(email);
    row.appendChild(info);

    if (canManageSchedules()) {
      var removeBtn = document.createElement("button");
      removeBtn.className = "btn btn-ghost btn-sm";
      removeBtn.textContent = "Remove";
      removeBtn.addEventListener("click", function () {
        removeRosterMember(activeRosterClass, entry.email, entry.name);
      });
      row.appendChild(removeBtn);
    }

    body.appendChild(row);
  });
}

function removeRosterMember(classItem, memberEmail, memberName) {
  if (!confirm("Remove " + memberName + " from " + classItem.className + "?")) return;

  unenrollFromClass(classItem.id, memberEmail);
  renderRosterList();
  renderSchedules();
  showToast("Member removed from class", "info");
}

function openClassModal() {
  editingClassId = null;
  document.getElementById("classModalTitle").textContent = "Create class";
  document.getElementById("classForm").reset();
  clearAllClassErrors();
  populateTrainerSelect();
  document.getElementById("classModal").classList.add("open");
}

function openClassModalForEdit(item) {
  editingClassId = item.id;
  document.getElementById("classModalTitle").textContent = "Edit class";
  document.getElementById("cName").value = item.className;
  populateTrainerSelect();
  document.getElementById("cTrainer").value = item.trainerName;
  document.getElementById("cDate").value = item.date;
  document.getElementById("cTime").value = item.time;
  document.getElementById("cDuration").value = item.duration;
  document.getElementById("cCapacity").value = item.capacity;
  clearAllClassErrors();
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
  } else if (editingClassId) {
    var enrolled = getEnrollmentCount(editingClassId);
    if (Number(capacity.value) < enrolled) {
      showFieldError(capacity, document.getElementById("cCapacityError"), "Capacity cannot be below current enrollments (" + enrolled + ").");
      ok = false;
    }
  }
  return ok;
}

function saveClass() {
  if (!validateClassForm()) return;

  var classData = {
    className: document.getElementById("cName").value.trim(),
    trainerName: document.getElementById("cTrainer").value,
    date: document.getElementById("cDate").value,
    time: document.getElementById("cTime").value,
    duration: Number(document.getElementById("cDuration").value),
    capacity: Number(document.getElementById("cCapacity").value)
  };

  var schedules = getSchedules();

  if (editingClassId) {
    for (var i = 0; i < schedules.length; i++) {
      if (schedules[i].id === editingClassId) {
        schedules[i].className = classData.className;
        schedules[i].trainerName = classData.trainerName;
        schedules[i].date = classData.date;
        schedules[i].time = classData.time;
        schedules[i].duration = classData.duration;
        schedules[i].capacity = classData.capacity;
        break;
      }
    }
    saveSchedules(schedules);
    closeClassModal();
    renderSchedules();
    showToast("Class updated successfully", "success");
    return;
  }

  classData.id = generateId();
  schedules.push(classData);
  saveSchedules(schedules);

  closeClassModal();
  renderSchedules();
  showToast("Class created successfully", "success");
}

function deleteClass(item) {
  var enrolled = getEnrollmentCount(item.id);
  var message = enrolled
    ? "Delete " + item.className + "? " + enrolled + " member(s) are enrolled and will be unenrolled."
    : "Delete " + item.className + "?";
  if (!confirm(message)) return;

  saveSchedules(getSchedules().filter(function (schedule) { return schedule.id !== item.id; }));
  removeEnrollmentsForClass(item.id);
  renderSchedules();
  showToast("Class deleted", "info");
}

function initSchedulePage() {
  var subtitle = document.getElementById("schedulesSubtitle");
  if (subtitle) {
    if (canManageSchedules()) {
      subtitle.textContent = "Create class sessions and view the timetable.";
    } else if (isTrainerView()) {
      subtitle.textContent = "View your class sessions and see who is enrolled.";
    } else {
      subtitle.textContent = "Browse the timetable and enroll in classes.";
    }
  }

  if (!canManageSchedules()) {
    var addBtn = document.getElementById("addClassBtn");
    if (addBtn) addBtn.remove();
  } else {
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

  if (canViewScheduleRoster()) {
    document.getElementById("rosterModalClose").addEventListener("click", closeRosterModal);
    document.getElementById("rosterModal").addEventListener("click", function (event) {
      if (event.target === this) closeRosterModal();
    });
  }
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
