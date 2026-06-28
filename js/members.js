/* ============================================================
   members.js — member management (IAP-38 register).
   Read/list view loads from api/members/list.php with localStorage fallback.
   Create/update/delete use PHP APIs with localStorage emergency fallback.
   ============================================================ */

var MEMBERS_API_URL = "api/members/list.php";
var MEMBERS_CREATE_API_URL = "api/members/create.php";
var MEMBERS_UPDATE_API_URL = "api/members/update.php";
var MEMBERS_DELETE_API_URL = "api/members/delete.php";
var WORKOUTS_LIST_API_URL = "api/workouts/list.php";

// Members currently shown on the page (null until first load finishes).
var pageMemberList = null;
var pageWorkoutSummaryByEmail = null;
var workoutSummariesApiAvailable = false;

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
    assignedTrainerName: apiMember.assigned_trainer_name || "",
    accountExists: apiMember.account_exists === true,
    accountEmail: apiMember.account_email || null,
    accountRole: apiMember.account_role || null,
    needsPasswordSetup: typeof apiMember.needs_password_setup === "number"
      ? apiMember.needs_password_setup
      : null,
    accountIsActive: typeof apiMember.account_is_active === "number"
      ? apiMember.account_is_active
      : null,
    accountStatusLabel: apiMember.account_status_label || null
  };
}

function getMemberAccountBadgeInfo(member) {
  if (member.accountStatusLabel) {
    if (member.accountStatusLabel === "Active") {
      return { className: "badge-green", text: "Active" };
    }
    if (member.accountStatusLabel === "Pending activation") {
      return { className: "badge-amber", text: "Pending" };
    }
    if (member.accountStatusLabel === "Inactive") {
      return { className: "badge-silver", text: "Inactive" };
    }
    return { className: "badge-silver", text: "No account" };
  }

  var status = getAccountStatus(member.email);
  if (status === "active") {
    return { className: "badge-green", text: "Active" };
  }
  if (status === "pending") {
    return { className: "badge-amber", text: "Pending" };
  }
  return { className: "badge-silver", text: "No account" };
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

function mapWorkoutPlansToSummaries(apiPlans) {
  var summaries = {};

  apiPlans.forEach(function (plan) {
    var email = normalizeMemberEmail(plan.member_email || plan.memberEmail || "");
    if (!email || summaries[email]) return;

    summaries[email] = {
      planName: plan.plan_name || plan.planName || "None",
      completed: (plan.completed_days || []).length,
      total: (plan.days || []).length
    };
  });

  return summaries;
}

function loadWorkoutSummariesFromApi() {
  return fetch(WORKOUTS_LIST_API_URL, {
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
            message: data.message || "Could not load workout summaries."
          };
        }

        var apiPlans = data.data && data.data.workout_plans ? data.data.workout_plans : [];
        return {
          ok: true,
          summaries: mapWorkoutPlansToSummaries(apiPlans)
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

function loadWorkoutSummariesWithFallback() {
  return loadWorkoutSummariesFromApi().then(function (result) {
    if (result.ok) {
      pageWorkoutSummaryByEmail = result.summaries;
      workoutSummariesApiAvailable = true;
      return;
    }

    console.warn("Workout summary API unavailable:", result.message);
    pageWorkoutSummaryByEmail = null;
    workoutSummariesApiAvailable = false;
  });
}

function getMemberWorkoutSummaryForPage(email) {
  var key = normalizeMemberEmail(email);

  if (workoutSummariesApiAvailable && pageWorkoutSummaryByEmail) {
    if (pageWorkoutSummaryByEmail[key]) {
      return pageWorkoutSummaryByEmail[key];
    }
    return { planName: "None", completed: 0, total: 0 };
  }

  if (typeof getMemberWorkoutSummary === "function") {
    return getMemberWorkoutSummary(email);
  }

  return { planName: "None", completed: 0, total: 0 };
}

function loadMembersWithFallback() {
  var summaryPromise = isTrainerView()
    ? loadWorkoutSummariesWithFallback()
    : Promise.resolve();

  return summaryPromise.then(function () {
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
  });
}

function refreshMembersFromLocalStorage() {
  pageMemberList = getMembers();
  renderMembers();
}

function deleteMemberFromApi(memberId) {
  return fetch(MEMBERS_DELETE_API_URL, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ id: memberId })
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
            message: data.message || "Could not delete member."
          };
        }

        return {
          ok: true,
          message: data.message || "Member deleted successfully"
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

function handleDeleteMember(member) {
  deleteMemberFromApi(member.id).then(function (result) {
    if (result.ok) {
      if (typeof showToast === "function") {
        showToast(result.message, "success");
      }
      loadMembersWithFallback();
      return;
    }

    console.warn("Member delete failed:", result.message);
    if (typeof showToast === "function") {
      showToast(result.message, "error");
    }
  });
}

function confirmDeleteMember(member) {
  if (!confirm("Are you sure you want to deactivate this member?")) {
    return;
  }

  handleDeleteMember(member);
}

// ---------- API WRITE HELPERS ----------

function resolveTrainerIdFromEmail(trainerEmail) {
  if (!trainerEmail || trainerEmail.trim() === "") {
    return null;
  }

  var target = normalizeMemberEmail(trainerEmail);
  var trainers = getTrainers();

  for (var i = 0; i < trainers.length; i++) {
    if (normalizeMemberEmail(trainers[i].email) === target) {
      var match = String(trainers[i].id).match(/^t(\d+)$/);
      if (match) return parseInt(match[1], 10);
    }
  }

  return null;
}

function mapFrontendMemberToApiPayload(memberData) {
  var apiPayload = {
    full_name: memberData.name,
    email: memberData.email,
    phone: memberData.phone || null,
    membership_type: memberData.type,
    start_date: memberData.startDate,
    status: "active"
  };

  var trainerId = resolveTrainerIdFromEmail(memberData.assignedTrainerEmail);
  apiPayload.assigned_trainer_id = trainerId;

  if (memberData.id) {
    apiPayload.id = memberData.id;
  }

  return apiPayload;
}

function normalizeMemberApiResponse(apiMember) {
  return mapApiMemberToFrontendMember(apiMember);
}

function callMemberWriteApi(url, apiPayload) {
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
          member: data.data && data.data.member
            ? normalizeMemberApiResponse(data.data.member)
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

function createMemberWithApi(memberData) {
  return callMemberWriteApi(
    MEMBERS_CREATE_API_URL,
    mapFrontendMemberToApiPayload(memberData)
  );
}

function updateMemberWithApi(memberData) {
  return callMemberWriteApi(
    MEMBERS_UPDATE_API_URL,
    mapFrontendMemberToApiPayload(memberData)
  );
}

function saveMemberWithApi(memberData, isEdit) {
  var apiCall = isEdit ? updateMemberWithApi(memberData) : createMemberWithApi(memberData);

  return apiCall.then(function (result) {
    if (result.ok) {
      return result;
    }

    if (result.networkError) {
      saveMemberToLocalStorage(memberData, isEdit);
      return {
        ok: true,
        localOnly: true,
        message: "Server unavailable. Saved locally only."
      };
    }

    return result;
  });
}

function saveMemberToLocalStorage(memberData, isEdit) {
  var members = getMembers();

  if (isEdit) {
    for (var i = 0; i < members.length; i++) {
      if (members[i].id === memberData.id) {
        syncMemberUserAccount(editingMemberEmail, memberData.name, memberData.email, memberData.id);
        members[i].name = memberData.name;
        members[i].email = memberData.email;
        members[i].phone = memberData.phone;
        members[i].type = memberData.type;
        members[i].startDate = memberData.startDate;
        members[i].assignedTrainerEmail = memberData.assignedTrainerEmail;
        break;
      }
    }
    saveMembers(members);
    return;
  }

  memberData.id = generateId();
  members.push(memberData);
  saveMembers(members);
  createPendingUser(memberData.email, memberData.name, "member", memberData.id);
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
    var summary = getMemberWorkoutSummaryForPage(member.email);

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
  var accountBadgeInfo = getMemberAccountBadgeInfo(member);
  var statusBadge = document.createElement("span");
  statusBadge.className = "badge " + accountBadgeInfo.className;
  statusBadge.textContent = accountBadgeInfo.text;
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

    var deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-ghost btn-sm";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", function () {
      confirmDeleteMember(member);
    });
    actionsTd.appendChild(deleteBtn);
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
  var memberData = {
    id: editingMemberId,
    name: document.getElementById("mName").value.trim(),
    email: document.getElementById("mEmail").value.trim(),
    phone: getPhoneFormValue("mPhoneCountry", "mPhone"),
    type: document.getElementById("mType").value,
    startDate: document.getElementById("mStart").value,
    assignedTrainerEmail: assignedSelect ? assignedSelect.value : ""
  };

  var isEdit = !!editingMemberId;

  saveMemberWithApi(memberData, isEdit).then(function (result) {
    if (!result.ok) {
      console.warn("Member save failed:", result.message);
      if (typeof showToast === "function") {
        showToast(result.message, "error");
      }
      return;
    }

    closeMemberModal();

    if (result.localOnly) {
      refreshMembersFromLocalStorage();
      if (typeof showToast === "function") {
        showToast(result.message, "info");
      }
      return;
    }

    if (typeof showToast === "function") {
      showToast(
        result.message,
        isEdit ? "success" : "success"
      );
    }

    loadMembersWithFallback();
  });
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
