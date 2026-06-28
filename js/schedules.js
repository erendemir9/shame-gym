/* ============================================================
   schedules.js — class schedule management (IAP-43).
   Read/list view loads from api/classes/list.php with localStorage fallback.
   Create/update/delete use PHP APIs with localStorage emergency fallback.
   Enrollments still use localStorage until later parts.
   ============================================================ */

var CLASSES_API_URL = "api/classes/list.php";
var CLASSES_CREATE_API_URL = "api/classes/create.php";
var CLASSES_UPDATE_API_URL = "api/classes/update.php";
var CLASSES_DELETE_API_URL = "api/classes/delete.php";
var TRAINERS_API_URL = "api/trainers/list.php";

// Classes currently shown on the page (null until first load finishes).
var pageClassList = null;

// Trainer options for the class form (null until first load finishes).
var pageTrainerOptionsList = null;

// ---------- API READ HELPERS ----------

function mapApiClassToFrontendSchedule(apiClass) {
  return {
    id: "s" + apiClass.id,
    className: apiClass.class_name,
    trainerName: apiClass.trainer_name,
    date: apiClass.class_date,
    time: apiClass.class_time ? apiClass.class_time.substring(0, 5) : "",
    duration: apiClass.duration_minutes,
    capacity: apiClass.capacity,
    enrolledCount: typeof apiClass.enrolled_count === "number" ? apiClass.enrolled_count : 0,
    status: apiClass.status || "scheduled"
  };
}

function loadClassesFromApi() {
  return fetch(CLASSES_API_URL, {
    method: "GET",
    credentials: "same-origin"
  })
    .then(function (response) {
      return response.text().then(function (text) {
        var data = {};

        try {
          data = text ? JSON.parse(text) : {};
        } catch (parseError) {
          return {
            ok: false,
            message: "Invalid server response."
          };
        }

        if (!response.ok || !data.success) {
          return {
            ok: false,
            message: data.message || "Could not load classes."
          };
        }

        var apiClasses = data.data && data.data.classes ? data.data.classes : [];
        var mappedClasses = apiClasses.map(mapApiClassToFrontendSchedule);

        return {
          ok: true,
          classes: mappedClasses
        };
      });
    })
    .catch(function () {
      return {
        ok: false,
        message: "Network error."
      };
    });
}

function loadClassesWithFallback() {
  return loadClassesFromApi().then(function (result) {
    if (result.ok) {
      pageClassList = result.classes;
      renderSchedules();
      return;
    }

    console.warn("Classes API unavailable:", result.message);
    pageClassList = getSchedules();

    if (typeof showToast === "function") {
      showToast("Could not load classes from server. Showing saved local data.", "info");
    }

    renderSchedules();
  });
}

function refreshSchedulesFromLocalStorage() {
  pageClassList = getSchedules();
  renderSchedules();
}

// ---------- TRAINER OPTIONS FOR CLASS FORM ----------

function mapApiTrainerToScheduleOption(apiTrainer) {
  return {
    id: "t" + apiTrainer.id,
    name: apiTrainer.full_name,
    email: apiTrainer.email,
    specialization: apiTrainer.specialization || "",
    availability: apiTrainer.availability || ""
  };
}

function loadTrainerOptionsFromApi() {
  return fetch(TRAINERS_API_URL, {
    method: "GET",
    credentials: "same-origin"
  })
    .then(function (response) {
      return response.text().then(function (text) {
        var data = {};

        try {
          data = text ? JSON.parse(text) : {};
        } catch (parseError) {
          return {
            ok: false,
            message: "Invalid server response."
          };
        }

        if (!response.ok || !data.success) {
          return {
            ok: false,
            message: data.message || "Could not load trainers."
          };
        }

        var apiTrainers = data.data && data.data.trainers ? data.data.trainers : [];
        var trainerOptions = apiTrainers.map(mapApiTrainerToScheduleOption);

        return {
          ok: true,
          trainers: trainerOptions
        };
      });
    })
    .catch(function () {
      return {
        ok: false,
        message: "Network error."
      };
    });
}

function loadTrainerOptionsWithFallback() {
  return loadTrainerOptionsFromApi().then(function (result) {
    if (result.ok) {
      pageTrainerOptionsList = result.trainers;
      return result;
    }

    console.warn("Trainers API unavailable for schedule dropdown:", result.message);
    pageTrainerOptionsList = getTrainers();
    return result;
  });
}

function getScheduleTrainerOptions() {
  return pageTrainerOptionsList !== null ? pageTrainerOptionsList : getTrainers();
}

// ---------- API WRITE HELPERS ----------

function resolveTrainerIdFromName(trainerName) {
  if (!trainerName || trainerName.trim() === "") {
    return null;
  }

  var trainers = getScheduleTrainerOptions();
  for (var i = 0; i < trainers.length; i++) {
    if (trainers[i].name === trainerName) {
      var match = String(trainers[i].id).match(/^t(\d+)$/);
      if (match) return parseInt(match[1], 10);
    }
  }

  return null;
}

function mapFrontendScheduleToApiPayload(classData) {
  var trainerId = resolveTrainerIdFromName(classData.trainerName);
  var apiPayload = {
    class_name: classData.className,
    trainer_id: trainerId,
    class_date: classData.date,
    class_time: classData.time,
    duration_minutes: classData.duration,
    capacity: classData.capacity,
    status: "scheduled"
  };

  if (classData.id) {
    apiPayload.id = classData.id;
  }

  return apiPayload;
}

function normalizeClassApiResponse(apiClass) {
  return mapApiClassToFrontendSchedule(apiClass);
}

function callClassWriteApi(url, apiPayload) {
  return fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(apiPayload)
  })
    .then(function (response) {
      return response.text().then(function (text) {
        var data = {};

        try {
          data = text ? JSON.parse(text) : {};
        } catch (parseError) {
          return {
            ok: false,
            message: "Invalid server response.",
            networkError: false
          };
        }

        if (!response.ok || !data.success) {
          return {
            ok: false,
            message: data.message || "Request failed.",
            networkError: false
          };
        }

        return {
          ok: true,
          message: data.message || "Success",
          classItem: data.data && data.data.class
            ? normalizeClassApiResponse(data.data.class)
            : null,
          networkError: false
        };
      });
    })
    .catch(function () {
      return {
        ok: false,
        message: "Network error.",
        networkError: true
      };
    });
}

function createClassWithApi(classData) {
  return callClassWriteApi(
    CLASSES_CREATE_API_URL,
    mapFrontendScheduleToApiPayload(classData)
  );
}

function updateClassWithApi(classData) {
  return callClassWriteApi(
    CLASSES_UPDATE_API_URL,
    mapFrontendScheduleToApiPayload(classData)
  );
}

function deleteClassFromApi(classId) {
  return fetch(CLASSES_DELETE_API_URL, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ id: classId })
  })
    .then(function (response) {
      return response.text().then(function (text) {
        var data = {};

        try {
          data = text ? JSON.parse(text) : {};
        } catch (parseError) {
          return {
            ok: false,
            message: "Invalid server response.",
            networkError: false
          };
        }

        if (!response.ok || !data.success) {
          return {
            ok: false,
            message: data.message || "Could not delete class.",
            networkError: false
          };
        }

        return {
          ok: true,
          message: data.message || "Class deleted successfully",
          networkError: false
        };
      });
    })
    .catch(function () {
      return {
        ok: false,
        message: "Network error.",
        networkError: true
      };
    });
}

function saveClassWithApi(classData, isEdit) {
  var apiCall = isEdit ? updateClassWithApi(classData) : createClassWithApi(classData);

  return apiCall.then(function (result) {
    if (result.ok) {
      return result;
    }

    if (result.networkError) {
      saveClassToLocalStorage(classData, isEdit);
      return {
        ok: true,
        localOnly: true,
        message: "Server unavailable. Saved locally only."
      };
    }

    return result;
  });
}

function saveClassToLocalStorage(classData, isEdit) {
  var schedules = getSchedules();

  if (isEdit) {
    for (var i = 0; i < schedules.length; i++) {
      if (schedules[i].id === classData.id) {
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
    return;
  }

  classData.id = generateId();
  schedules.push(classData);
  saveSchedules(schedules);
}

function deleteClassToLocalStorage(item) {
  saveSchedules(getSchedules().filter(function (schedule) {
    return schedule.id !== item.id;
  }));
  removeEnrollmentsForClass(item.id);
}

function getEnrollmentCountForSchedule(item) {
  if (typeof item.enrolledCount === "number") {
    return item.enrolledCount;
  }
  return getEnrollmentCount(item.id);
}

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
  var schedules = pageClassList !== null ? pageClassList : getSchedules();
  if (!isTrainerView()) return schedules;

  var trainerName = getLoggedInTrainerName();
  return schedules.filter(function (item) {
    return item.trainerName === trainerName;
  });
}

var editingClassId = null;
var activeRosterClass = null;

function populateTrainerSelect(selectedTrainerName) {
  var select = document.getElementById("cTrainer");
  if (!select) return;

  var trainerOptions = getScheduleTrainerOptions();
  select.innerHTML = '<option value="">Select a trainer…</option>';

  var seenNames = {};

  trainerOptions.forEach(function (trainer) {
    seenNames[trainer.name] = true;
    var option = document.createElement("option");
    option.value = trainer.name;
    option.textContent = trainer.name + " (" + (trainer.specialization || "Trainer") + ")";
    select.appendChild(option);
  });

  if (selectedTrainerName && !seenNames[selectedTrainerName]) {
    var currentOption = document.createElement("option");
    currentOption.value = selectedTrainerName;
    currentOption.textContent = selectedTrainerName + " (current)";
    select.appendChild(currentOption);
  }

  if (selectedTrainerName) {
    select.value = selectedTrainerName;
  }
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
  var enrolled = getEnrollmentCountForSchedule(item);
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
        unenrollFromClass(item.id, session.email).then(function (result) {
          if (!result.ok) {
            if (typeof showToast === "function") {
              showToast(result.message || "Could not unenroll", "error");
            }
            return;
          }

          if (result.localOnly) {
            if (typeof showToast === "function") {
              showToast(result.message, "info");
            }
            return;
          }

          if (typeof showToast === "function") {
            showToast(result.message || ("Removed from " + item.className), "success");
          }
        });
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
        enrollInClass(item.id, session.email).then(function (result) {
          if (!result.ok) {
            var errorMessage = result.message ||
              (result.reason === "full" ? "Class is full" : "Could not enroll");
            if (typeof showToast === "function") {
              showToast(errorMessage, "error");
            }
            return;
          }

          if (result.localOnly) {
            if (typeof showToast === "function") {
              showToast(result.message, "info");
            }
            return;
          }

          if (typeof showToast === "function") {
            showToast(result.message || ("Enrolled in " + item.className), "success");
          }
        });
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
      confirmDeleteClass(item);
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

  unenrollFromClass(classItem.id, memberEmail).then(function (result) {
    if (!result.ok) {
      if (typeof showToast === "function") {
        showToast(result.message || "Could not remove member", "error");
      }
      return;
    }

    renderRosterList();

    if (result.localOnly) {
      if (typeof showToast === "function") {
        showToast(result.message, "info");
      }
      return;
    }

    if (typeof showToast === "function") {
      showToast(result.message || "Member removed from class", "success");
    }
  });
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
  populateTrainerSelect(item.trainerName);
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
    id: editingClassId,
    className: document.getElementById("cName").value.trim(),
    trainerName: document.getElementById("cTrainer").value,
    date: document.getElementById("cDate").value,
    time: document.getElementById("cTime").value,
    duration: Number(document.getElementById("cDuration").value),
    capacity: Number(document.getElementById("cCapacity").value)
  };

  if (!resolveTrainerIdFromName(classData.trainerName)) {
    showFieldError(
      document.getElementById("cTrainer"),
      document.getElementById("cTrainerError"),
      "Choose a valid trainer."
    );
    return;
  }

  var isEdit = !!editingClassId;

  saveClassWithApi(classData, isEdit).then(function (result) {
    if (!result.ok) {
      console.warn("Class save failed:", result.message);
      if (typeof showToast === "function") {
        showToast(result.message, "error");
      }
      return;
    }

    closeClassModal();

    if (result.localOnly) {
      refreshSchedulesFromLocalStorage();
      if (typeof showToast === "function") {
        showToast(result.message, "info");
      }
      return;
    }

    if (typeof showToast === "function") {
      showToast(result.message, "success");
    }

    loadClassesWithFallback();
  });
}

function handleDeleteClass(item) {
  deleteClassFromApi(item.id).then(function (result) {
    if (result.ok) {
      if (typeof showToast === "function") {
        showToast(result.message, "success");
      }
      loadClassesWithFallback();
      return;
    }

    if (result.networkError) {
      deleteClassToLocalStorage(item);
      refreshSchedulesFromLocalStorage();
      if (typeof showToast === "function") {
        showToast("Server unavailable. Saved locally only.", "info");
      }
      return;
    }

    console.warn("Class delete failed:", result.message);
    if (typeof showToast === "function") {
      showToast(result.message, "error");
    }
  });
}

function confirmDeleteClass(item) {
  var enrolled = getEnrollmentCountForSchedule(item);
  var message = "Are you sure you want to cancel this class?";
  if (enrolled > 0) {
    message += " " + enrolled + " member(s) are enrolled.";
  }

  if (!confirm(message)) {
    return;
  }

  handleDeleteClass(item);
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
