/* ============================================================
   meetings.js — admin staff meeting scheduling.
   ============================================================ */

var editingMeetingId = null;

function showFieldError(input, errorEl, message) {
  errorEl.textContent = message;
  errorEl.classList.add("show");
  if (input) input.classList.add("invalid");
}

function clearFieldError(input, errorEl) {
  errorEl.textContent = "";
  errorEl.classList.remove("show");
  if (input) input.classList.remove("invalid");
}

function formatDate(isoDate) {
  if (!isoDate) return "";
  var parts = isoDate.split("-");
  var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return parseInt(parts[2], 10) + " " + months[parseInt(parts[1], 10) - 1] + " " + parts[0];
}

function textCell(text) {
  var td = document.createElement("td");
  td.textContent = text;
  return td;
}

function getStaffAttendeeOptions() {
  var options = [];
  var seen = {};

  getUsers().forEach(function (user) {
    if (user.role !== "admin" && user.role !== "trainer") return;
    var email = user.email.trim();
    var key = email.toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    options.push({ email: email, label: user.name + " (" + email + ")" });
  });

  getTrainers().forEach(function (trainer) {
    var email = trainer.email.trim();
    var key = email.toLowerCase();
    if (seen[key]) return;
    seen[key] = true;
    options.push({ email: email, label: trainer.name + " (" + email + ")" });
  });

  return options;
}

function populateAttendeeCheckboxes(selected) {
  var container = document.getElementById("mtAttendees");
  container.innerHTML = "";
  var selectedSet = {};
  (selected || []).forEach(function (email) {
    selectedSet[email.trim().toLowerCase()] = true;
  });

  getStaffAttendeeOptions().forEach(function (option) {
    var label = document.createElement("label");
    label.className = "checkbox-item";

    var input = document.createElement("input");
    input.type = "checkbox";
    input.value = option.email;
    input.className = "mt-attendee-cb";
    if (selectedSet[option.email.toLowerCase()]) input.checked = true;

    var span = document.createElement("span");
    span.textContent = option.label;

    label.appendChild(input);
    label.appendChild(span);
    container.appendChild(label);
  });
}

function renderMeetingRow(meeting) {
  var tr = document.createElement("tr");
  tr.appendChild(textCell(meeting.title));
  tr.appendChild(textCell(formatDate(meeting.date)));
  tr.appendChild(textCell(meeting.time));
  tr.appendChild(textCell(meeting.location));
  tr.appendChild(textCell(String((meeting.attendees || []).length)));

  if (canManageMeetings()) {
    var actionsTd = document.createElement("td");
    actionsTd.className = "row-actions";

    var editBtn = document.createElement("button");
    editBtn.className = "btn btn-ghost btn-sm";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", function () { openMeetingModalForEdit(meeting); });

    var deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-ghost btn-sm";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", function () {
      var list = getMeetings().filter(function (m) { return m.id !== meeting.id; });
      saveMeetings(list);
      renderMeetings();
      showToast("Meeting deleted", "info");
    });

    actionsTd.appendChild(editBtn);
    actionsTd.appendChild(deleteBtn);
    tr.appendChild(actionsTd);
  }

  return tr;
}

function renderMeetings() {
  var body = document.getElementById("meetingsBody");
  if (!body) return;
  body.innerHTML = "";

  var meetings = getMeetings().slice().sort(function (a, b) {
    return (a.date + a.time).localeCompare(b.date + b.time);
  });

  if (meetings.length === 0) {
    var table = body.closest("table");
    var colCount = table.querySelectorAll("thead th").length;
    var emptyRow = document.createElement("tr");
    var cell = document.createElement("td");
    cell.colSpan = colCount;
    cell.className = "empty-state";

    var title = document.createElement("div");
    title.className = "empty-title";
    title.textContent = "No meetings scheduled";
    cell.appendChild(title);

    var msg = document.createElement("div");
    msg.textContent = "Schedule your first staff meeting to coordinate operations.";
    cell.appendChild(msg);

    emptyRow.appendChild(cell);
    body.appendChild(emptyRow);
    return;
  }

  meetings.forEach(function (meeting, index) {
    var row = renderMeetingRow(meeting);
    row.classList.add("row-enter");
    row.style.animationDelay = (index * 0.04) + "s";
    body.appendChild(row);
  });
}

function getUpcomingMeetings(limit) {
  var today = new Date().toISOString().slice(0, 10);
  return getMeetings()
    .filter(function (m) { return m.date >= today; })
    .sort(function (a, b) { return (a.date + a.time).localeCompare(b.date + b.time); })
    .slice(0, limit || 3);
}

function openMeetingModal() {
  editingMeetingId = null;
  document.getElementById("meetingModalTitle").textContent = "Schedule meeting";
  document.getElementById("meetingForm").reset();
  clearAllMeetingErrors();
  populateAttendeeCheckboxes([]);
  document.getElementById("meetingModal").classList.add("open");
}

function openMeetingModalForEdit(meeting) {
  editingMeetingId = meeting.id;
  document.getElementById("meetingModalTitle").textContent = "Edit meeting";
  document.getElementById("mtTitle").value = meeting.title;
  document.getElementById("mtDate").value = meeting.date;
  document.getElementById("mtTime").value = meeting.time;
  document.getElementById("mtLocation").value = meeting.location;
  document.getElementById("mtNotes").value = meeting.notes || "";
  clearAllMeetingErrors();
  populateAttendeeCheckboxes(meeting.attendees || []);
  document.getElementById("meetingModal").classList.add("open");
}

function closeMeetingModal() {
  document.getElementById("meetingModal").classList.remove("open");
}

function clearAllMeetingErrors() {
  clearFieldError(document.getElementById("mtTitle"), document.getElementById("mtTitleError"));
  clearFieldError(document.getElementById("mtDate"), document.getElementById("mtDateError"));
  clearFieldError(document.getElementById("mtTime"), document.getElementById("mtTimeError"));
  clearFieldError(document.getElementById("mtLocation"), document.getElementById("mtLocationError"));
  document.getElementById("mtAttendeesError").textContent = "";
  document.getElementById("mtAttendeesError").classList.remove("show");
}

function collectSelectedAttendees() {
  var emails = [];
  document.querySelectorAll(".mt-attendee-cb:checked").forEach(function (cb) {
    emails.push(cb.value);
  });
  return emails;
}

function validateMeetingForm() {
  var ok = true;
  clearAllMeetingErrors();

  var title = document.getElementById("mtTitle");
  var date = document.getElementById("mtDate");
  var time = document.getElementById("mtTime");
  var location = document.getElementById("mtLocation");

  if (title.value.trim() === "") {
    showFieldError(title, document.getElementById("mtTitleError"), "Title is required.");
    ok = false;
  }
  if (date.value === "") {
    showFieldError(date, document.getElementById("mtDateError"), "Date is required.");
    ok = false;
  }
  if (time.value === "") {
    showFieldError(time, document.getElementById("mtTimeError"), "Time is required.");
    ok = false;
  }
  if (location.value.trim() === "") {
    showFieldError(location, document.getElementById("mtLocationError"), "Location is required.");
    ok = false;
  }

  var attendees = collectSelectedAttendees();
  if (attendees.length === 0) {
    document.getElementById("mtAttendeesError").textContent = "Select at least one attendee.";
    document.getElementById("mtAttendeesError").classList.add("show");
    ok = false;
  }

  return ok ? attendees : null;
}

function saveMeeting() {
  var attendees = validateMeetingForm();
  if (!attendees) return;

  var data = {
    id: editingMeetingId || generateId(),
    title: document.getElementById("mtTitle").value.trim(),
    date: document.getElementById("mtDate").value,
    time: document.getElementById("mtTime").value,
    location: document.getElementById("mtLocation").value.trim(),
    notes: document.getElementById("mtNotes").value.trim(),
    attendees: attendees
  };

  var meetings = getMeetings();
  var replaced = false;
  for (var i = 0; i < meetings.length; i++) {
    if (meetings[i].id === data.id) {
      meetings[i] = data;
      replaced = true;
      break;
    }
  }
  if (!replaced) meetings.push(data);

  saveMeetings(meetings);
  closeMeetingModal();
  renderMeetings();
  showToast(editingMeetingId ? "Meeting updated" : "Meeting scheduled", "success");
}

function initMeetingPage() {
  if (!canManageMeetings()) {
    var addBtn = document.getElementById("addMeetingBtn");
    if (addBtn) addBtn.remove();
    var actionsHead = document.getElementById("meetingsActionsHead");
    if (actionsHead) actionsHead.remove();
    return;
  }

  document.getElementById("addMeetingBtn").addEventListener("click", openMeetingModal);
  document.getElementById("meetingModalClose").addEventListener("click", closeMeetingModal);
  document.getElementById("meetingCancel").addEventListener("click", closeMeetingModal);
  document.getElementById("meetingForm").addEventListener("submit", function (event) {
    event.preventDefault();
    saveMeeting();
  });
  document.getElementById("meetingModal").addEventListener("click", function (event) {
    if (event.target === this) closeMeetingModal();
  });
}
