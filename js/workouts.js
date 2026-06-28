/* ============================================================
   workouts.js — workout plans for members + management for trainers.
   Reuses: generateId(), readList() from data.js; getSession(), canManageWorkouts()
   from auth.js; showToast() from toast.js.
   ============================================================ */

// ---------- DATA LAYER ----------

var WORKOUT_PLANS_KEY = "shame_workout_plans";
var WORKOUT_PROGRESS_KEY = "shame_workout_progress";

var WORKOUTS_LIST_API_URL = "api/workouts/list.php";
var WORKOUTS_CREATE_API_URL = "api/workouts/create.php";
var WORKOUTS_UPDATE_API_URL = "api/workouts/update.php";
var WORKOUTS_DELETE_API_URL = "api/workouts/delete.php";
var WORKOUTS_PROGRESS_API_URL = "api/workouts/progress.php";
var MEMBERS_LIST_API_URL = "api/members/list.php";

var pageWorkoutList = null;
var workoutsApiAvailable = false;
var workoutMemberOptions = null;

var SEED_WORKOUT_PLANS = [
  {
    id: "wp1",
    memberEmail: "member@shame.gym",
    planName: "12-Week Strength Builder",
    trainerName: "Trainer User",
    notes: "Focus on controlled form over heavy weight. Rest 90 seconds between sets and log how each session feels — we'll adjust next week.",
    days: [
      {
        day: "Monday",
        focus: "Lower Body",
        exercises: [
          { name: "Back Squats", sets: 4, reps: 10 },
          { name: "Romanian Deadlift", sets: 3, reps: 12 },
          { name: "Walking Lunges", sets: 3, reps: 14 },
          { name: "Calf Raises", sets: 4, reps: 15 }
        ]
      },
      {
        day: "Wednesday",
        focus: "Upper Body Push",
        exercises: [
          { name: "Bench Press", sets: 4, reps: 8 },
          { name: "Overhead Press", sets: 3, reps: 10 },
          { name: "Incline Dumbbell Press", sets: 3, reps: 12 },
          { name: "Tricep Dips", sets: 3, reps: 12 }
        ]
      },
      {
        day: "Friday",
        focus: "Upper Body Pull",
        exercises: [
          { name: "Deadlifts", sets: 4, reps: 6 },
          { name: "Pull-Ups", sets: 3, reps: 8 },
          { name: "Barbell Rows", sets: 3, reps: 10 },
          { name: "Bicep Curls", sets: 3, reps: 12 }
        ]
      }
    ]
  }
];

var editingPlanId = null;

function seedWorkoutsIfEmpty() {
  if (localStorage.getItem(WORKOUT_PLANS_KEY) === null) {
    localStorage.setItem(WORKOUT_PLANS_KEY, JSON.stringify(SEED_WORKOUT_PLANS));
  }
}

function parseWorkoutApiResponse(response) {
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
        message: data.message || "Request failed."
      };
    }

    return {
      ok: true,
      data: data.data || {},
      message: data.message || "Success"
    };
  });
}

function mapApiWorkoutToFrontend(apiPlan) {
  return {
    id: apiPlan.frontend_id || ("wp" + apiPlan.id),
    apiId: apiPlan.id,
    memberEmail: apiPlan.member_email,
    memberId: apiPlan.member_id,
    planName: apiPlan.plan_name,
    trainerName: apiPlan.trainer_name,
    notes: apiPlan.notes || "",
    days: apiPlan.days || [],
    completedDays: apiPlan.completed_days || []
  };
}

function loadWorkoutsFromApi() {
  return fetch(WORKOUTS_LIST_API_URL, {
    method: "GET",
    credentials: "same-origin"
  })
    .then(parseWorkoutApiResponse)
    .then(function (result) {
      if (!result.ok) return result;

      var apiPlans = result.data.workout_plans || [];
      return {
        ok: true,
        plans: apiPlans.map(mapApiWorkoutToFrontend)
      };
    })
    .catch(function () {
      return {
        ok: false,
        message: "Network error."
      };
    });
}

function loadWorkoutsWithFallback() {
  return loadWorkoutsFromApi().then(function (result) {
    if (result.ok) {
      pageWorkoutList = result.plans;
      workoutsApiAvailable = true;
      return true;
    }

    console.warn("Workouts API unavailable:", result.message);
    pageWorkoutList = null;
    workoutsApiAvailable = false;
    seedWorkoutsIfEmpty();

    if (typeof showToast === "function") {
      showToast("Could not load workouts from server. Showing saved local data.", "info");
    }

    return false;
  });
}

function loadWorkoutMemberOptionsFromApi() {
  return fetch(MEMBERS_LIST_API_URL, {
    method: "GET",
    credentials: "same-origin"
  })
    .then(parseWorkoutApiResponse)
    .then(function (result) {
      if (!result.ok) return result;

      var options = [];
      (result.data.members || []).forEach(function (member) {
        options.push({
          email: member.email,
          name: member.full_name
        });
      });

      return {
        ok: true,
        options: options
      };
    })
    .catch(function () {
      return {
        ok: false,
        message: "Network error."
      };
    });
}

function createWorkoutWithApi(planData) {
  return fetch(WORKOUTS_CREATE_API_URL, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      member_email: planData.memberEmail,
      plan_name: planData.planName,
      notes: planData.notes,
      plan_details: { days: planData.days }
    })
  })
    .then(parseWorkoutApiResponse)
    .catch(function () {
      return { ok: false, message: "Network error." };
    });
}

function updateWorkoutWithApi(planData) {
  return fetch(WORKOUTS_UPDATE_API_URL, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: planData.apiId || planData.id,
      member_email: planData.memberEmail,
      plan_name: planData.planName,
      notes: planData.notes,
      plan_details: { days: planData.days }
    })
  })
    .then(parseWorkoutApiResponse)
    .catch(function () {
      return { ok: false, message: "Network error." };
    });
}

function deleteWorkoutWithApi(plan) {
  return fetch(WORKOUTS_DELETE_API_URL, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: plan.apiId || plan.id
    })
  })
    .then(parseWorkoutApiResponse)
    .catch(function () {
      return { ok: false, message: "Network error." };
    });
}

function saveWorkoutProgressWithApi(plan, dayLabel, isCompleted) {
  return fetch(WORKOUTS_PROGRESS_API_URL, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workout_plan_id: plan.apiId || plan.id,
      progress_key: dayLabel,
      is_completed: isCompleted ? 1 : 0
    })
  })
    .then(parseWorkoutApiResponse)
    .catch(function () {
      return { ok: false, message: "Network error." };
    });
}

function saveWorkoutWithApi(planData, isEdit) {
  var apiCall = isEdit ? updateWorkoutWithApi(planData) : createWorkoutWithApi(planData);

  return apiCall.then(function (result) {
    if (result.ok) {
      return loadWorkoutsWithFallback().then(function () {
        return { ok: true, usedFallback: false };
      });
    }

    if (result.message === "Network error.") {
      return {
        ok: false,
        usedFallback: true,
        message: "Server unavailable. Workout saved locally only."
      };
    }

    return {
      ok: false,
      usedFallback: false,
      message: result.message || "Could not save workout plan."
    };
  });
}

function saveWorkoutLocally(planData, isEdit) {
  var plans = getWorkoutPlans();
  var replaced = false;

  for (var i = 0; i < plans.length; i++) {
    if (plans[i].id === planData.id) {
      plans[i] = planData;
      replaced = true;
      break;
    }
  }

  if (!replaced) {
    plans = plans.filter(function (p) {
      return normalizeWorkoutEmail(p.memberEmail) !== normalizeWorkoutEmail(planData.memberEmail);
    });
    plans.push(planData);
  }

  saveWorkoutPlans(plans);
  if (pageWorkoutList !== null) {
    pageWorkoutList = plans.slice();
  }
}

function normalizeWorkoutEmail(email) {
  return email ? email.trim().toLowerCase() : "";
}

function getWorkoutPlans() {
  if (pageWorkoutList !== null) return pageWorkoutList;
  if (typeof readList === "function") return readList(WORKOUT_PLANS_KEY);
  var raw = localStorage.getItem(WORKOUT_PLANS_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveWorkoutPlans(plans) {
  localStorage.setItem(WORKOUT_PLANS_KEY, JSON.stringify(plans));
}

function getPlanForMember(email) {
  var target = normalizeWorkoutEmail(email);
  var plans = getWorkoutPlans();
  for (var i = 0; i < plans.length; i++) {
    if (normalizeWorkoutEmail(plans[i].memberEmail) === target) return plans[i];
  }
  return null;
}

function getMemberWorkoutSummary(email) {
  var plan = getPlanForMember(email);
  if (!plan) return { planName: "None", completed: 0, total: 0 };
  return {
    planName: plan.planName,
    completed: getCompletedDays(plan.id).length,
    total: plan.days.length
  };
}

function getPlanById(id) {
  var plans = getWorkoutPlans();
  for (var i = 0; i < plans.length; i++) {
    if (plans[i].id === id) return plans[i];
  }
  return null;
}

function deletePlan(id) {
  var plans = getWorkoutPlans().filter(function (p) { return p.id !== id; });
  saveWorkoutPlans(plans);

  var map = getProgressMap();
  delete map[id];
  localStorage.setItem(WORKOUT_PROGRESS_KEY, JSON.stringify(map));
}

// ---------- PROGRESS ----------

function getProgressMap() {
  var raw = localStorage.getItem(WORKOUT_PROGRESS_KEY);
  return raw ? JSON.parse(raw) : {};
}

function getCompletedDays(planId) {
  var plan = getPlanById(planId);
  if (plan && plan.completedDays) return plan.completedDays.slice();

  var map = getProgressMap();
  return map[planId] || [];
}

function isDayComplete(planId, dayIndex) {
  var plan = getPlanById(planId);
  if (!plan || !plan.days[dayIndex]) return false;

  var completed = getCompletedDays(planId);
  if (workoutsApiAvailable) {
    return completed.indexOf(plan.days[dayIndex].day) !== -1;
  }

  return completed.indexOf(dayIndex) !== -1;
}

function toggleDayCompleteLocal(planId, dayIndex) {
  var map = getProgressMap();
  var days = map[planId] || [];
  var pos = days.indexOf(dayIndex);

  if (pos === -1) {
    days.push(dayIndex);
  } else {
    days.splice(pos, 1);
  }

  map[planId] = days;
  localStorage.setItem(WORKOUT_PROGRESS_KEY, JSON.stringify(map));
  return pos === -1;
}

function toggleDayComplete(planId, dayIndex) {
  var plan = getPlanById(planId);
  if (!plan || !plan.days[dayIndex]) return false;

  var dayLabel = plan.days[dayIndex].day;
  var currentlyComplete = isDayComplete(planId, dayIndex);
  var targetComplete = !currentlyComplete;

  if (workoutsApiAvailable) {
    return saveWorkoutProgressWithApi(plan, dayLabel, targetComplete).then(function (result) {
      if (result.ok) {
        plan.completedDays = result.data.completed_days || [];
        return targetComplete;
      }

      if (result.message === "Network error." && typeof showToast === "function") {
        showToast("Server unavailable. Workout saved locally only.", "info");
      } else if (typeof showToast === "function") {
        showToast(result.message || "Could not update workout progress.", "error");
        return currentlyComplete;
      }

      return toggleDayCompleteLocal(planId, dayIndex);
    });
  }

  return Promise.resolve(toggleDayCompleteLocal(planId, dayIndex));
}

// ---------- SHARED FORM HELPERS ----------

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

function textCell(text) {
  var td = document.createElement("td");
  td.textContent = text;
  return td;
}

function getMemberLabel(email) {
  var target = normalizeWorkoutEmail(email);
  var members = typeof getMembers === "function" ? getMembers() : [];
  for (var i = 0; i < members.length; i++) {
    if (normalizeWorkoutEmail(members[i].email) === target) {
      return members[i].name + " (" + members[i].email + ")";
    }
  }
  if (typeof getUsers === "function") {
    var users = getUsers();
    for (var j = 0; j < users.length; j++) {
      if (normalizeWorkoutEmail(users[j].email) === target) {
        return users[j].name + " (" + users[j].email + ")";
      }
    }
  }
  return email;
}

function getMemberOptions() {
  var options = [];
  var seen = {};

  function addOption(email, name) {
    var key = normalizeWorkoutEmail(email);
    if (!key || seen[key]) return;
    seen[key] = true;
    options.push({ email: email.trim(), name: name });
  }

  if (typeof getMembers === "function") {
    getMembers().forEach(function (m) {
      addOption(m.email, m.name);
    });
  }
  if (typeof getUsers === "function") {
    getUsers().forEach(function (u) {
      if (u.role === "member") addOption(u.email, u.name);
    });
  }
  return options;
}

// ---------- MEMBER RENDERING ----------

function renderExerciseItem(ex) {
  var li = document.createElement("li");
  li.className = "wk-exercise";

  var name = document.createElement("span");
  name.className = "wk-exercise-name";
  name.textContent = ex.name;

  var detail = document.createElement("span");
  detail.className = "wk-exercise-detail";
  detail.textContent = ex.sets + " sets × " + ex.reps + " reps";

  li.appendChild(name);
  li.appendChild(detail);
  return li;
}

function renderDayCard(plan, dayIndex) {
  var day = plan.days[dayIndex];
  var done = isDayComplete(plan.id, dayIndex);

  var card = document.createElement("div");
  card.className = "wk-day-card" + (done ? " is-complete" : "");

  var head = document.createElement("div");
  head.className = "wk-day-head";

  var title = document.createElement("h3");
  title.className = "wk-day-title";
  title.textContent = day.day;

  var focus = document.createElement("span");
  focus.className = "badge badge-blue";
  focus.textContent = day.focus;

  head.appendChild(title);
  head.appendChild(focus);
  card.appendChild(head);

  var list = document.createElement("ul");
  list.className = "wk-exercise-list";
  day.exercises.forEach(function (ex) {
    list.appendChild(renderExerciseItem(ex));
  });
  card.appendChild(list);

  var btn = document.createElement("button");
  btn.className = "btn btn-block " + (done ? "btn-ghost" : "btn-primary");
  btn.innerHTML = done ? "✓ Completed" : "Mark workout as complete";
  btn.addEventListener("click", function () {
    toggleDayComplete(plan.id, dayIndex).then(function (nowDone) {
      showToast(
        nowDone ? day.day + " workout marked complete" : day.day + " marked incomplete",
        nowDone ? "success" : "info"
      );
      renderWorkoutProgram();
    });
  });
  card.appendChild(btn);

  return card;
}

function renderNoPlan(container) {
  var card = document.createElement("section");
  card.className = "card wk-empty empty-state";

  var title = document.createElement("div");
  title.className = "empty-title";
  title.textContent = "No active plan";

  var msg = document.createElement("p");
  msg.className = "subtitle";
  msg.style.marginTop = "8px";
  msg.textContent = "You don't have a workout plan yet. Contact your trainer to get started!";

  card.appendChild(title);
  card.appendChild(msg);
  container.appendChild(card);
}

function renderPlan(container, plan) {
  var completed = getCompletedDays(plan.id).length;
  var total = plan.days.length;

  var overview = document.createElement("section");
  overview.className = "card wk-overview";

  var name = document.createElement("h2");
  name.className = "wk-plan-name";
  name.textContent = plan.planName;
  overview.appendChild(name);

  var by = document.createElement("p");
  by.className = "subtitle";
  by.textContent = "Programmed by " + plan.trainerName;
  overview.appendChild(by);

  if (plan.notes) {
    var notesLabel = document.createElement("div");
    notesLabel.className = "wk-notes-label";
    notesLabel.textContent = "Trainer's notes";
    overview.appendChild(notesLabel);

    var notes = document.createElement("p");
    notes.className = "wk-notes";
    notes.textContent = plan.notes;
    overview.appendChild(notes);
  }

  var progressText = document.createElement("div");
  progressText.className = "wk-progress-text";
  progressText.textContent = completed + " of " + total + " workouts complete this week";
  overview.appendChild(progressText);

  var bar = document.createElement("div");
  bar.className = "wk-progress-bar";
  var fill = document.createElement("div");
  fill.className = "wk-progress-fill";
  fill.style.width = (total ? Math.round((completed / total) * 100) : 0) + "%";
  bar.appendChild(fill);
  overview.appendChild(bar);

  container.appendChild(overview);

  var grid = document.createElement("div");
  grid.className = "wk-day-grid";
  plan.days.forEach(function (day, index) {
    grid.appendChild(renderDayCard(plan, index));
  });
  container.appendChild(grid);
}

function renderWorkoutProgram() {
  var container = document.getElementById("workoutContent");
  if (!container) return;
  container.innerHTML = "";

  var session = getSession();
  var plan = session ? getPlanForMember(session.email) : null;

  if (!plan) {
    renderNoPlan(container);
  } else {
    renderPlan(container, plan);
  }
}

// ---------- TRAINER / ADMIN MANAGEMENT ----------

function renderPlanRow(plan) {
  var tr = document.createElement("tr");
  tr.appendChild(textCell(getMemberLabel(plan.memberEmail)));
  tr.appendChild(textCell(plan.planName));
  tr.appendChild(textCell(plan.trainerName));
  tr.appendChild(textCell(String(plan.days.length)));

  if (canManageWorkouts()) {
    var actionsTd = document.createElement("td");
    actionsTd.className = "row-actions";

    var editBtn = document.createElement("button");
    editBtn.className = "btn btn-ghost btn-sm";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", function () {
      openPlanModalForEdit(plan);
    });

    var deleteBtn = document.createElement("button");
    deleteBtn.className = "btn btn-ghost btn-sm";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", function () {
      if (workoutsApiAvailable) {
        deleteWorkoutWithApi(plan).then(function (result) {
          if (result.ok) {
            return loadWorkoutsWithFallback().then(function () {
              renderWorkoutPlansList();
              showToast("Workout plan deleted", "info");
            });
          }

          if (result.message === "Network error.") {
            deletePlan(plan.id);
            renderWorkoutPlansList();
            showToast("Server unavailable. Workout saved locally only.", "info");
            return;
          }

          showToast(result.message || "Could not delete workout plan.", "error");
        });
        return;
      }

      deletePlan(plan.id);
      renderWorkoutPlansList();
      showToast("Workout plan deleted", "info");
    });

    actionsTd.appendChild(editBtn);
    actionsTd.appendChild(deleteBtn);
    tr.appendChild(actionsTd);
  }

  return tr;
}

function renderWorkoutPlansList() {
  var body = document.getElementById("plansBody");
  if (!body) return;
  body.innerHTML = "";

  var plans = getWorkoutPlans();
  if (plans.length === 0) {
    var table = body.closest("table");
    var colCount = table.querySelectorAll("thead th").length;
    var emptyRow = document.createElement("tr");
    var cell = document.createElement("td");
    cell.colSpan = colCount;
    cell.className = "empty-state";

    var title = document.createElement("div");
    title.className = "empty-title";
    title.textContent = "No workout plans yet";
    cell.appendChild(title);

    var msg = document.createElement("div");
    msg.textContent = "Create a plan and assign it to a member.";
    cell.appendChild(msg);

    if (canManageWorkouts()) {
      var btn = document.createElement("button");
      btn.className = "btn btn-primary";
      btn.textContent = "Create plan";
      btn.addEventListener("click", openPlanModal);
      cell.appendChild(btn);
    }

    emptyRow.appendChild(cell);
    body.appendChild(emptyRow);
    return;
  }

  plans.forEach(function (plan, index) {
    var row = renderPlanRow(plan);
    row.classList.add("row-enter");
    row.style.animationDelay = (index * 0.04) + "s";
    body.appendChild(row);
  });
}

function populateMemberSelect(selectedEmail) {
  var select = document.getElementById("pMember");
  select.innerHTML = '<option value="">Select a member…</option>';

  function fillOptions(options) {
    options.forEach(function (member) {
      var option = document.createElement("option");
      option.value = member.email;
      option.textContent = member.name + " (" + member.email + ")";
      select.appendChild(option);
    });

    if (selectedEmail) select.value = selectedEmail;
  }

  if (workoutMemberOptions !== null) {
    fillOptions(workoutMemberOptions);
    return;
  }

  loadWorkoutMemberOptionsFromApi().then(function (result) {
    if (result.ok) {
      workoutMemberOptions = result.options;
      fillOptions(workoutMemberOptions);
      return;
    }

    fillOptions(getMemberOptions());
  });
}

function createExerciseRow(exercise) {
  var row = document.createElement("div");
  row.className = "wk-form-exercise";

  var name = document.createElement("input");
  name.type = "text";
  name.className = "wk-ex-name";
  name.placeholder = "Exercise name";
  name.value = exercise ? exercise.name : "";

  var sets = document.createElement("input");
  sets.type = "number";
  sets.className = "wk-ex-sets";
  sets.min = "1";
  sets.placeholder = "Sets";
  sets.value = exercise ? exercise.sets : "";

  var reps = document.createElement("input");
  reps.type = "number";
  reps.className = "wk-ex-reps";
  reps.min = "1";
  reps.placeholder = "Reps";
  reps.value = exercise ? exercise.reps : "";

  var removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn btn-ghost btn-sm";
  removeBtn.textContent = "Remove";
  removeBtn.addEventListener("click", function () {
    row.remove();
  });

  row.appendChild(name);
  row.appendChild(sets);
  row.appendChild(reps);
  row.appendChild(removeBtn);
  return row;
}

function createDayBlock(dayData) {
  var block = document.createElement("div");
  block.className = "wk-form-day card";

  var head = document.createElement("div");
  head.className = "wk-form-day-head";

  var dayInput = document.createElement("input");
  dayInput.type = "text";
  dayInput.className = "wk-day-name";
  dayInput.placeholder = "Day (e.g. Monday)";
  dayInput.value = dayData ? dayData.day : "";

  var focusInput = document.createElement("input");
  focusInput.type = "text";
  focusInput.className = "wk-day-focus";
  focusInput.placeholder = "Focus (e.g. Lower Body)";
  focusInput.value = dayData ? dayData.focus : "";

  var removeDayBtn = document.createElement("button");
  removeDayBtn.type = "button";
  removeDayBtn.className = "btn btn-ghost btn-sm";
  removeDayBtn.textContent = "Remove day";
  removeDayBtn.addEventListener("click", function () {
    block.remove();
  });

  head.appendChild(dayInput);
  head.appendChild(focusInput);
  head.appendChild(removeDayBtn);
  block.appendChild(head);

  var exercisesWrap = document.createElement("div");
  exercisesWrap.className = "wk-form-exercises";

  var exercises = dayData && dayData.exercises ? dayData.exercises : [{ name: "", sets: "", reps: "" }];
  exercises.forEach(function (ex) {
    exercisesWrap.appendChild(createExerciseRow(ex));
  });
  block.appendChild(exercisesWrap);

  var addExBtn = document.createElement("button");
  addExBtn.type = "button";
  addExBtn.className = "btn btn-ghost btn-sm";
  addExBtn.textContent = "+ Add exercise";
  addExBtn.addEventListener("click", function () {
    exercisesWrap.appendChild(createExerciseRow(null));
  });
  block.appendChild(addExBtn);

  return block;
}

function clearPlanForm() {
  document.getElementById("planForm").reset();
  document.getElementById("pDaysContainer").innerHTML = "";
  clearFieldError(document.getElementById("pMember"), document.getElementById("pMemberError"));
  clearFieldError(document.getElementById("pName"), document.getElementById("pNameError"));
  document.getElementById("pDaysError").textContent = "";
  document.getElementById("pDaysError").classList.remove("show");
}

function openPlanModal() {
  editingPlanId = null;
  document.getElementById("planModalTitle").textContent = "Create workout plan";
  clearPlanForm();
  populateMemberSelect("");
  document.getElementById("pDaysContainer").appendChild(createDayBlock(null));
  document.getElementById("planModal").classList.add("open");
}

function openPlanModalForEdit(plan) {
  editingPlanId = plan.id;
  document.getElementById("planModalTitle").textContent = "Edit workout plan";
  clearPlanForm();
  populateMemberSelect(plan.memberEmail);
  document.getElementById("pName").value = plan.planName;
  document.getElementById("pNotes").value = plan.notes || "";

  var container = document.getElementById("pDaysContainer");
  plan.days.forEach(function (day) {
    container.appendChild(createDayBlock(day));
  });

  document.getElementById("planModal").classList.add("open");
}

function closePlanModal() {
  document.getElementById("planModal").classList.remove("open");
}

function collectDaysFromForm() {
  var blocks = document.querySelectorAll("#pDaysContainer .wk-form-day");
  var days = [];

  blocks.forEach(function (block) {
    var dayName = block.querySelector(".wk-day-name").value.trim();
    var focus = block.querySelector(".wk-day-focus").value.trim();
    var exercises = [];

    block.querySelectorAll(".wk-form-exercise").forEach(function (row) {
      var name = row.querySelector(".wk-ex-name").value.trim();
      var sets = Number(row.querySelector(".wk-ex-sets").value);
      var reps = Number(row.querySelector(".wk-ex-reps").value);
      if (name && sets > 0 && reps > 0) {
        exercises.push({ name: name, sets: sets, reps: reps });
      }
    });

    if (dayName && focus && exercises.length > 0) {
      days.push({ day: dayName, focus: focus, exercises: exercises });
    }
  });

  return days;
}

function validatePlanForm() {
  var ok = true;
  var member = document.getElementById("pMember");
  var name = document.getElementById("pName");
  var daysError = document.getElementById("pDaysError");

  clearFieldError(member, document.getElementById("pMemberError"));
  clearFieldError(name, document.getElementById("pNameError"));
  daysError.textContent = "";
  daysError.classList.remove("show");

  if (member.value === "") {
    showFieldError(member, document.getElementById("pMemberError"), "Choose a member.");
    ok = false;
  }
  if (name.value.trim() === "") {
    showFieldError(name, document.getElementById("pNameError"), "Plan name is required.");
    ok = false;
  }

  var days = collectDaysFromForm();
  if (days.length === 0) {
    daysError.textContent = "Add at least one workout day with exercises.";
    daysError.classList.add("show");
    ok = false;
  }

  return ok ? days : null;
}

function savePlanFromForm() {
  var days = validatePlanForm();
  if (!days) return;

  var session = getSession();
  var memberEmail = document.getElementById("pMember").value.trim();
  var existingPlan = editingPlanId ? getPlanById(editingPlanId) : null;
  var planData = {
    id: editingPlanId || generateId(),
    apiId: existingPlan ? existingPlan.apiId : null,
    memberEmail: memberEmail,
    planName: document.getElementById("pName").value.trim(),
    trainerName: session ? session.name : "Trainer",
    notes: document.getElementById("pNotes").value.trim(),
    days: days
  };

  var isEdit = !!editingPlanId;

  if (workoutsApiAvailable) {
    saveWorkoutWithApi(planData, isEdit).then(function (result) {
      if (result.ok) {
        closePlanModal();
        renderWorkoutPlansList();
        showToast(isEdit ? "Workout plan updated" : "Workout plan created", "success");
        return;
      }

      if (result.usedFallback) {
        saveWorkoutLocally(planData, isEdit);
        closePlanModal();
        renderWorkoutPlansList();
        showToast("Server unavailable. Workout saved locally only.", "info");
        return;
      }

      showToast(result.message || "Could not save workout plan.", "error");
    });
    return;
  }

  saveWorkoutLocally(planData, isEdit);
  closePlanModal();
  renderWorkoutPlansList();
  showToast(isEdit ? "Workout plan updated" : "Workout plan created", "success");
}

// ---------- PAGE INIT ----------

function initWorkoutPageUi() {
  var session = getSession();
  if (!session) return;

  var isManager = canManageWorkouts();

  if (isManager) {
    document.getElementById("workoutPageTitle").textContent = "Member Workout Plans";
    document.getElementById("workoutPageSubtitle").textContent = "Create and manage workout programs for your members.";
    document.getElementById("memberWorkoutView").style.display = "none";
    document.getElementById("trainerWorkoutView").style.display = "block";
    document.getElementById("addPlanBtn").style.display = "";

    renderWorkoutPlansList();

    document.getElementById("addPlanBtn").addEventListener("click", openPlanModal);
    document.getElementById("planModalClose").addEventListener("click", closePlanModal);
    document.getElementById("planCancel").addEventListener("click", closePlanModal);
    document.getElementById("addDayBtn").addEventListener("click", function () {
      document.getElementById("pDaysContainer").appendChild(createDayBlock(null));
    });
    document.getElementById("planForm").addEventListener("submit", function (event) {
      event.preventDefault();
      savePlanFromForm();
    });
    document.getElementById("planModal").addEventListener("click", function (event) {
      if (event.target === this) closePlanModal();
    });
  } else {
    document.getElementById("workoutPageTitle").textContent = "My Workout Program";
    document.getElementById("workoutPageSubtitle").textContent = "Follow your trainer's plan during your gym session.";
    document.getElementById("trainerWorkoutView").style.display = "none";
    renderWorkoutProgram();
  }
}

function initWorkoutPage() {
  seedWorkoutsIfEmpty();

  loadWorkoutsWithFallback().then(function () {
    initWorkoutPageUi();
  });
}

seedWorkoutsIfEmpty();
