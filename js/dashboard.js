/* ============================================================
   dashboard.js — load role-aware dashboard stats from MySQL API
   with localStorage emergency fallback.
   ============================================================ */

var DASHBOARD_STATS_API_URL = "api/dashboard/stats.php";

function loadDashboardStatsFromApi() {
  return fetch(DASHBOARD_STATS_API_URL, {
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
            message: data.message || "Could not load dashboard stats."
          };
        }

        return {
          ok: true,
          dashboardStats: data.data || {}
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

function countUp(el, target) {
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) {
    el.textContent = target;
    return;
  }

  var duration = 800;
  var startTime = null;
  function step(now) {
    if (startTime === null) startTime = now;
    var progress = Math.min((now - startTime) / duration, 1);
    el.textContent = Math.floor(progress * target);
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = target;
  }
  requestAnimationFrame(step);
}

function formatDashboardDate(isoDate) {
  if (!isoDate) return "";
  var parts = isoDate.split("-");
  var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return parseInt(parts[2], 10) + " " + months[parseInt(parts[1], 10) - 1] + " " + parts[0];
}

function renderEnrolledClassesFromApi(containerId, classes) {
  var container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = "";
  if (!classes || classes.length === 0) {
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
    li.textContent = item.class_name + " — " + formatDashboardDate(item.date) + " at " + item.time + " with " + item.trainer_name;
    list.appendChild(li);
  });
  container.appendChild(list);
}

function renderWorkoutPreviewFromApi(workoutPreview) {
  var container = document.getElementById("workoutContent");
  if (!container) return;

  container.innerHTML = "";

  if (!workoutPreview || !workoutPreview.plan_name) {
    if (typeof renderWorkoutProgram === "function") {
      renderWorkoutProgram();
    }
    return;
  }

  var title = document.createElement("h3");
  title.className = "wk-plan-title";
  title.textContent = workoutPreview.plan_name;
  container.appendChild(title);

  if (workoutPreview.notes) {
    var notes = document.createElement("p");
    notes.className = "subtitle";
    notes.textContent = workoutPreview.notes;
    container.appendChild(notes);
  }

  var hint = document.createElement("p");
  hint.className = "subtitle";
  hint.textContent = "Open the full workout page to follow your daily exercises.";
  container.appendChild(hint);
}

function renderMemberMembershipBadges(membership, accountStatusLabel) {
  var badgeWrap = document.getElementById("membershipBadges");
  if (!badgeWrap) return;

  badgeWrap.innerHTML = "";

  if (membership && membership.membership_type) {
    var typeBadge = document.createElement("span");
    var typeClass = membership.membership_type === "VIP"
      ? "badge-purple"
      : (membership.membership_type === "Premium" ? "badge-blue" : "badge-silver");
    typeBadge.className = "badge " + typeClass;
    typeBadge.textContent = membership.membership_type + " plan";
    badgeWrap.appendChild(typeBadge);
  } else {
    var unknownBadge = document.createElement("span");
    unknownBadge.className = "badge badge-silver";
    unknownBadge.textContent = "Member account";
    badgeWrap.appendChild(unknownBadge);
  }

  var statusBadge = document.createElement("span");
  if (accountStatusLabel === "Active") {
    statusBadge.className = "badge badge-green";
    statusBadge.textContent = "Status: Active";
  } else if (accountStatusLabel === "Pending activation") {
    statusBadge.className = "badge badge-amber";
    statusBadge.textContent = "Status: Pending";
  } else if (accountStatusLabel === "Inactive") {
    statusBadge.className = "badge badge-silver";
    statusBadge.textContent = "Status: Inactive";
  } else {
    statusBadge.className = "badge badge-amber";
    statusBadge.textContent = "Status: Pending";
  }
  badgeWrap.appendChild(statusBadge);
}

function renderAdminMeetingsFromApi(meetings) {
  var meetingsSection = document.getElementById("adminMeetingsSection");
  var meetingsList = document.getElementById("adminMeetingsList");
  if (!meetingsSection || !meetingsList) return;

  meetingsSection.style.display = "block";
  meetingsList.innerHTML = "";

  if (!meetings || meetings.length === 0) {
    meetingsList.innerHTML = '<p class="subtitle">No upcoming staff meetings scheduled.</p>';
    return;
  }

  var ul = document.createElement("ul");
  ul.className = "simple-list";
  meetings.forEach(function (meeting) {
    var li = document.createElement("li");
    li.textContent = meeting.title + " — " + meeting.date + " at " + meeting.time +
      (meeting.location ? " (" + meeting.location + ")" : "");
    ul.appendChild(li);
  });
  meetingsList.appendChild(ul);
}

function renderStaffDashboardFromApi(dashboardStats, session) {
  document.getElementById("staffView").style.display = "block";

  var stats = dashboardStats.stats || {};
  var membersEl = document.getElementById("statMembers");
  var trainersEl = document.getElementById("statTrainers");
  var classesEl = document.getElementById("statClasses");

  if (dashboardStats.role === "trainer") {
    var memberLabel = document.querySelector("#staffView .stats-grid .stat-card:nth-child(1) .stat-label");
    var trainerLabel = document.querySelector("#staffView .stats-grid .stat-card:nth-child(2) .stat-label");
    var classLabel = document.querySelector("#staffView .stats-grid .stat-card:nth-child(3) .stat-label");
    if (memberLabel) memberLabel.textContent = "Assigned members";
    if (trainerLabel) trainerLabel.textContent = "My classes";
    if (classLabel) classLabel.textContent = "Class enrollments";

    countUp(membersEl, stats.assigned_members || 0);
    countUp(trainersEl, stats.scheduled_classes || 0);
    countUp(classesEl, stats.active_enrollments || 0);
  } else {
    countUp(membersEl, stats.active_members || 0);
    countUp(trainersEl, stats.active_trainers || 0);
    countUp(classesEl, stats.scheduled_classes || 0);
  }

  var quick = document.getElementById("quickLinks");
  quick.innerHTML = "";
  getVisibleNavLinks(session.role).forEach(function (link) {
    if (link.key === "dashboard") return;
    var a = document.createElement("a");
    a.className = "btn btn-ghost";
    a.href = link.href;
    a.textContent = "Open " + link.label;
    quick.appendChild(a);
  });

  if (dashboardStats.role === "admin") {
    renderAdminMeetingsFromApi(dashboardStats.upcoming_meetings || []);
  }
}

function renderMemberDashboardFromApi(dashboardStats) {
  document.getElementById("memberView").style.display = "block";
  renderMemberMembershipBadges(
    dashboardStats.membership,
    dashboardStats.account_status_label || "Pending activation"
  );
  renderEnrolledClassesFromApi("enrolledClassesList", dashboardStats.enrolled_classes || []);
  renderWorkoutPreviewFromApi(dashboardStats.workout_preview || null);
}

function renderStaffDashboardFallback(session) {
  document.getElementById("staffView").style.display = "block";
  countUp(document.getElementById("statMembers"), getMembers().length);
  countUp(document.getElementById("statTrainers"), getTrainers().length);
  countUp(document.getElementById("statClasses"), getSchedules().length);

  var quick = document.getElementById("quickLinks");
  quick.innerHTML = "";
  getVisibleNavLinks(session.role).forEach(function (link) {
    if (link.key === "dashboard") return;
    var a = document.createElement("a");
    a.className = "btn btn-ghost";
    a.href = link.href;
    a.textContent = "Open " + link.label;
    quick.appendChild(a);
  });

  if (session.role === "admin" && typeof getUpcomingMeetings === "function") {
    var meetingsSection = document.getElementById("adminMeetingsSection");
    var meetingsList = document.getElementById("adminMeetingsList");
    var upcoming = getUpcomingMeetings(3);
    meetingsSection.style.display = "block";
    meetingsList.innerHTML = "";

    if (upcoming.length === 0) {
      meetingsList.innerHTML = '<p class="subtitle">No upcoming staff meetings scheduled.</p>';
    } else {
      var ul = document.createElement("ul");
      ul.className = "simple-list";
      upcoming.forEach(function (meeting) {
        var li = document.createElement("li");
        li.textContent = meeting.title + " — " + meeting.date + " at " + meeting.time + " (" + meeting.location + ")";
        ul.appendChild(li);
      });
      meetingsList.appendChild(ul);
    }
  }
}

function renderMemberDashboardFallback(session) {
  document.getElementById("memberView").style.display = "block";

  var user = findUserByEmail(session.email);
  var member = findMemberForUser(user || session);
  var accountStatus = getAccountStatus(session.email);
  var membership = member ? {
    membership_type: member.type
  } : null;
  var accountStatusLabel = accountStatus === "active" ? "Active" : "Pending activation";

  renderMemberMembershipBadges(membership, accountStatusLabel);

  if (typeof renderEnrolledClassesList === "function") {
    renderEnrolledClassesList("enrolledClassesList");
  }

  if (typeof renderWorkoutProgram === "function") {
    renderWorkoutProgram();
  }
}

function initDashboardPage() {
  var session = getSession();
  if (!session) return;

  document.getElementById("welcomeTitle").textContent = "Welcome back, " + session.name;
  var headerBadge = document.getElementById("headerRoleBadge");
  headerBadge.className = "badge " + getRoleBadgeClass(session.role);
  headerBadge.textContent = getRoleLabel(session.role);

  if (sessionStorage.getItem("shame_access_denied")) {
    sessionStorage.removeItem("shame_access_denied");
    showToast("You don't have access to that page", "error");
  }

  loadDashboardStatsFromApi().then(function (result) {
    if (result.ok) {
      if (result.dashboardStats.role === "member") {
        renderMemberDashboardFromApi(result.dashboardStats);
      } else {
        renderStaffDashboardFromApi(result.dashboardStats, session);
      }
      return;
    }

    console.warn("Dashboard API unavailable:", result.message);

    if (typeof showToast === "function") {
      showToast("Could not load dashboard from server. Showing saved local data.", "info");
    }

    if (session.role === "member") {
      renderMemberDashboardFallback(session);
    } else {
      renderStaffDashboardFallback(session);
    }
  });
}
