/* ============================================================
   members.js — member management (IAP-38 register).
   Read/list view loads from api/members/list.php with localStorage fallback.
   Add/edit/delete still use localStorage until write APIs are added later.
   ============================================================ */

var MEMBERS_API_URL = "api/members/list.php";

// Members currently shown on the page (null until first load finishes).
var pageMemberList = null;

// ---------- API READ HELPERS ----------

function resolveAssignedTrainerEmail(apiMember) {
  if (!apiMember.assigned_trainer_id) return "";

  var trainerKey = "t" + apiMember.assigned_trainer_id;
  var trainers = getTrainers();

  for (var i = 0; i < trainers.length; i++) {
    if (trainers[i].id === trainerKey) return trainers[i].email;
  }

  if (apiMember.assigned_trainer_name) {
    for (var j = 0; j < trainers.length; j++) {
      if (trainers[j].name === apiMember.assigned_trainer_name) {
        return trainers[j].email;
      }
    }
  }

  return "";
}

function mapApiMemberToFrontendMember(apiMember) {
  return {
    id: "m" + apiMember.id,
    name: apiMember.full_name,
    email: apiMember.email,
    phone: apiMember.phone || "",
    type: apiMember.membership_type,
    startDate: apiMember.start_date || "",
    assignedTrainerEmail: resolveAssignedTrainerEmail(apiMember),
    assignedTrainerName: apiMember.assigned_trainer_name || ""
  };
}

function loadMembersFromApi() {
  return fetch(MEMBERS_API_URL, {
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
            message: data.message || "Could not load members."
          };
        }

        var apiMembers = data.data && data.data.members ? data.data.members : [];
        var mappedMembers = apiMembers.map(mapApiMemberToFrontendMember);

        return {
          ok: true,
          members: mappedMembers
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

function loadMembersWithFallback() {
  return loadMembersFromApi().then(function (result) {
    if (result.ok) {
      pageMemberList = result.members;
      renderMembers();
      return;
    }

    console.warn("Members API unavailable:", result.message);
    pageMemberList = getMembers();

    if (typeof showToast === "function") {
      showToast("Could not load members from server. Showing saved local data.", "info");
    }

    renderMembers();
  });
}

function refreshMembersFromLocalStorage() {
  pageMemberList = getMembers();
  renderMembers();
}

// ---------- SMALL SHARED FORM HELPERS ----------

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

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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

var editingMemberId = null;
var editingMemberEmail = null;

function isTrainerView() {
  return getRole() === "trainer" && !canManageMembers();
}

function normalizeMemberEmail(email) {
  return email ? email.trim().toLowerCase() : "";
}

function getMembersForView() {
  var members = pageMemberList !== null ? pageMemberList : getMembers();
  if (!isTrainerView()) return members;

  var session = getSession();
  var trainerEmail = normalizeMemberEmail(session.email);
  return members.filter(function (member) {
    return normalizeMemberEmail(member.assignedTrainerEmail) === trainerEmail;
  });
}

function membershipBadgeClass(type) {
  if (type === "VIP") return "badge-purple";
  if (type === "Premium") return "badge-blue";
  return "badge-silver";
}

function textCell(text) {
  var td = document.createElement("td");
  td.textContent = text;
  return td;
}

function getTrainerLabel(email) {
  if (!email) return "—";
  var trainers = getTrainers();
  for (var i = 0; i < trainers.length; i++) {
    if (normalizeMemberEmail(trainers[i].email) === normalizeMemberEmail(email)) {
      return trainers[i].name;
    }
  }
  var user = findUserByEmail(email);
  return user ? user.name : email;
}

function getAssignedTrainerLabel(member) {
  if (member.assignedTrainerEmail) {
    var label = getTrainerLabel(member.assignedTrainerEmail);
    if (label && label !== "—") return label;
  }
  if (member.assignedTrainerName) return member.assignedTrainerName;
  return "—";
}

function populateAssignedTrainerSelect(selectedEmail) {
  var select = document.getElementById("mAssignedTrainer");
  if (!select) return;
  select.innerHTML = '<option value="">No trainer assigned</option>';

  var seen = {};
  function addOption(email, label) {
    var key = normalizeMemberEmail(email);
    if (!key || seen[key]) return;
    seen[key] = true;
    var option = document.createElement("option");
    option.value = email;
    option.textContent = label;
    select.appendChild(option);
  }

  getTrainers().forEach(function (trainer) {
    addOption(trainer.email, trainer.name + " (" + trainer.email + ")");
  });
  getUsers().forEach(function (user) {
    if (user.role === "trainer") {
      addOption(user.email, user.name + " (" + user.email + ")");
    }
  });

  if (selectedEmail) select.value = selectedEmail;
}

function renderMemberRow(member) {
  var tr = document.createElement("tr");

  tr.appendChild(textCell(member.name));
  tr.appendChild(textCell(member.email));

  if (isTrainerView()) {
    var summary = typeof getMemberWorkoutSummary === "function"
      ? getMemberWorkoutSummary(member.email)
      : { planName: "None", completed: 0, total: 0 };

    tr.appendChild(textCell(summary.planName));
    tr.appendChild(textCell(summary.total ? summary.completed + " / " + summary.total + " days" : "—"));
    return tr;
  }

  tr.appendChild(textCell(member.phone));

  var typeTd = document.createElement("td");
  var badge = document.createElement("span");
  badge.className = "badge " + membershipBadgeClass(member.type);
  badge.textContent = member.type;
  typeTd.appendChild(badge);
  tr.appendChild(typeTd);

  tr.appendChild(textCell(formatDate(member.startDate)));

  var accountTd = document.createElement("td");
  var status = getAccountStatus(member.email);
  var statusBadge = document.createElement("span");
  if (status === "active") {
    statusBadge.className = "badge badge-green";
    statusBadge.textContent = "Active";
  } else if (status === "pending") {
    statusBadge.className = "badge badge-amber";
    statusBadge.textContent = "Pending";
  } else {
    statusBadge.className = "badge badge-silver";
    statusBadge.textContent = "No account";
  }
  accountTd.appendChild(statusBadge);
  tr.appendChild(accountTd);

  tr.appendChild(textCell(getAssignedTrainerLabel(member)));

  if (canManageMembers()) {
    var actionsTd = document.createElement("td");
    actionsTd.className = "row-actions";
    var editBtn = document.createElement("button");
    editBtn.className = "btn btn-ghost btn-sm";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", function () {
      openMemberModalForEdit(member);
    });
    actionsTd.appendChild(editBtn);
    tr.appendChild(actionsTd);
  }

  return tr;
}

function configureMembersTableHeaders() {
  var headRow = document.querySelector("#membersTableHead tr");
  if (!headRow) return;
  headRow.innerHTML = "";

  function addHead(text, id) {
    var th = document.createElement("th");
    th.textContent = text;
    if (id) th.id = id;
    headRow.appendChild(th);
  }

  if (isTrainerView()) {
    addHead("Name");
    addHead("Email");
    addHead("Workout plan");
    addHead("Progress");
    return;
  }

  addHead("Name");
  addHead("Email");
  addHead("Phone");
  addHead("Membership");
  addHead("Start date");
  addHead("Account");
  addHead("Assigned trainer");
  if (canManageMembers()) addHead("Actions", "membersActionsHead");
}

function renderMembers() {
  configureMembersTableHeaders();

  var members = getMembersForView();
  var body = document.getElementById("membersBody");
  body.innerHTML = "";

  if (members.length === 0) {
    var table = body.closest("table");
    var colCount = table.querySelectorAll("thead th").length;
    var emptyRow = document.createElement("tr");
    var cell = document.createElement("td");
    cell.colSpan = colCount;
    cell.className = "empty-state";
    renderEmptyState(cell,
      isTrainerView() ? "No assigned members" : "No members yet",
      isTrainerView() ? "Members assigned to you will appear here." : (canManageMembers() ? "Add your first member to get started." : "There are no members to show."),
      canManageMembers() ? "Add member" : null, openMemberModal);
    emptyRow.appendChild(cell);
    body.appendChild(emptyRow);
    return;
  }

  members.forEach(function (member, index) {
    var row = renderMemberRow(member);
    row.classList.add("row-enter");
    row.style.animationDelay = (index * 0.04) + "s";
    body.appendChild(row);
  });
}

function openMemberModal() {
  editingMemberId = null;
  editingMemberEmail = null;
  document.getElementById("memberModalTitle").textContent = "Add member";
  document.getElementById("memberForm").reset();
  document.getElementById("mPhoneCountry").value = "US";
  initPhoneField("mPhoneCountry", "mPhone", "mPhoneHint");
  populateAssignedTrainerSelect("");
  clearAllMemberErrors();
  document.getElementById("memberModal").classList.add("open");
}

function openMemberModalForEdit(member) {
  editingMemberId = member.id;
  editingMemberEmail = member.email;
  document.getElementById("memberModalTitle").textContent = "Edit member";
  document.getElementById("mName").value = member.name;
  document.getElementById("mEmail").value = member.email;
  setPhoneFieldValues("mPhoneCountry", "mPhone", "mPhoneHint", member.phone);
  document.getElementById("mType").value = member.type;
  document.getElementById("mStart").value = member.startDate;
  populateAssignedTrainerSelect(member.assignedTrainerEmail || "");
  clearAllMemberErrors();
  document.getElementById("memberModal").classList.add("open");
}

function closeMemberModal() {
  document.getElementById("memberModal").classList.remove("open");
}

function clearAllMemberErrors() {
  clearFieldError(document.getElementById("mName"), document.getElementById("mNameError"));
  clearFieldError(document.getElementById("mEmail"), document.getElementById("mEmailError"));
  clearFieldError(document.getElementById("mPhone"), document.getElementById("mPhoneError"));
  clearFieldError(document.getElementById("mType"), document.getElementById("mTypeError"));
  clearFieldError(document.getElementById("mStart"), document.getElementById("mStartError"));
}

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
  var phoneCheck = validatePhoneField("mPhoneCountry", "mPhone", document.getElementById("mPhoneError"));
  if (!phoneCheck.ok) {
    showFieldError(phone, document.getElementById("mPhoneError"), phoneCheck.message);
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

function saveMember() {
  if (!validateMemberForm()) return;

  var assignedSelect = document.getElementById("mAssignedTrainer");
  var data = {
    name: document.getElementById("mName").value.trim(),
    email: document.getElementById("mEmail").value.trim(),
    phone: getPhoneFormValue("mPhoneCountry", "mPhone"),
    type: document.getElementById("mType").value,
    startDate: document.getElementById("mStart").value,
    assignedTrainerEmail: assignedSelect ? assignedSelect.value : ""
  };

  var members = getMembers();

  if (editingMemberId) {
    for (var i = 0; i < members.length; i++) {
      if (members[i].id === editingMemberId) {
        syncMemberUserAccount(editingMemberEmail, data.name, data.email, editingMemberId);
        members[i].name = data.name;
        members[i].email = data.email;
        members[i].phone = data.phone;
        members[i].type = data.type;
        members[i].startDate = data.startDate;
        members[i].assignedTrainerEmail = data.assignedTrainerEmail;
        break;
      }
    }
    saveMembers(members);
    closeMemberModal();
    refreshMembersFromLocalStorage();
    showToast("Member updated successfully", "success");
  } else {
    data.id = generateId();
    members.push(data);
    saveMembers(members);
    createPendingUser(data.email, data.name, "member", data.id);
    closeMemberModal();
    refreshMembersFromLocalStorage();
    showToast("Member added. They can activate their account from the login page.", "success");
  }
}

function initMemberPage() {
  if (isTrainerView()) {
    var addBtn = document.getElementById("addMemberBtn");
    if (addBtn) addBtn.remove();
    var subtitle = document.getElementById("membersSubtitle");
    if (subtitle) subtitle.textContent = "Members assigned to you and their workout progress.";
    return;
  }

  if (!canManageMembers()) {
    var addBtnReadOnly = document.getElementById("addMemberBtn");
    if (addBtnReadOnly) addBtnReadOnly.remove();
    return;
  }

  document.getElementById("addMemberBtn").addEventListener("click", openMemberModal);
  document.getElementById("memberModalClose").addEventListener("click", closeMemberModal);
  document.getElementById("memberCancel").addEventListener("click", closeMemberModal);
  initPhoneField("mPhoneCountry", "mPhone", "mPhoneHint");

  document.getElementById("memberForm").addEventListener("submit", function (event) {
    event.preventDefault();
    saveMember();
  });

  document.getElementById("memberModal").addEventListener("click", function (event) {
    if (event.target === this) closeMemberModal();
  });
}
