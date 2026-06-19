/* ============================================================
   auth.js — simulated authentication + role-based access (no backend).
   Handles: user accounts in localStorage, login check, session,
   account activation (first-time password setup), logout, route guard,
   and ONE central permissions map.
   ============================================================ */

var USERS_KEY = "shame_users";

// Seed accounts: admin + all demo members/trainers from data.js seeds.
var SEED_USERS = [
  { email: "admin@shame.gym",           password: "admin123",   role: "admin",   name: "Admin User",    needsPasswordSetup: false },
  { email: "trainer@shame.gym",         password: "trainer123", role: "trainer", name: "Trainer User",  needsPasswordSetup: false },
  { email: "marcus.hale@shame.gym",     password: "trainer123", role: "trainer", name: "Marcus Hale",   needsPasswordSetup: false, linkedId: "t1" },
  { email: "nadia.petrova@shame.gym",   password: "trainer123", role: "trainer", name: "Nadia Petrova", needsPasswordSetup: false, linkedId: "t2" },
  { email: "diego.santos@shame.gym",    password: "trainer123", role: "trainer", name: "Diego Santos",  needsPasswordSetup: false, linkedId: "t3" },
  { email: "priya.anand@shame.gym",     password: "trainer123", role: "trainer", name: "Priya Anand",   needsPasswordSetup: false, linkedId: "t4" },
  { email: "tyler.brooks@shame.gym",    password: "trainer123", role: "trainer", name: "Tyler Brooks",  needsPasswordSetup: false, linkedId: "t5" },
  { email: "member@shame.gym",          password: "member123",  role: "member",  name: "Member User",   needsPasswordSetup: false, linkedId: "m7" },
  { email: "james.carter@email.com",    password: "member123",  role: "member",  name: "James Carter",  needsPasswordSetup: false, linkedId: "m1" },
  { email: "sofia.romano@email.com",    password: "member123",  role: "member",  name: "Sofia Romano",  needsPasswordSetup: false, linkedId: "m2" },
  { email: "liam.novak@email.com",      password: "member123",  role: "member",  name: "Liam Novak",    needsPasswordSetup: false, linkedId: "m3" },
  { email: "amara.okafor@email.com",    password: "member123",  role: "member",  name: "Amara Okafor",  needsPasswordSetup: false, linkedId: "m4" },
  { email: "daniel.reyes@email.com",    password: "member123",  role: "member",  name: "Daniel Reyes",  needsPasswordSetup: false, linkedId: "m5" },
  { email: "elena.fischer@email.com",   password: "member123",  role: "member",  name: "Elena Fischer", needsPasswordSetup: false, linkedId: "m6" }
];

var SESSION_KEY = "shame_session";
var SPLASH_KEY = "shame_splash_played";

var PERMISSIONS = {
  admin: {
    label: "Administrator",
    badgeClass: "badge-blue",
    nav: ["dashboard", "members", "trainers", "schedules", "workouts", "meetings"],
    manageMembers: true,
    manageTrainers: true,
    manageSchedules: true,
    manageWorkouts: true,
    manageMeetings: true
  },
  trainer: {
    label: "Trainer",
    badgeClass: "badge-silver",
    nav: ["dashboard", "members", "schedules", "workouts"],
    manageMembers: false,
    manageTrainers: false,
    manageSchedules: false,
    manageWorkouts: true,
    manageMeetings: false
  },
  member: {
    label: "Member",
    badgeClass: "badge-purple",
    nav: ["dashboard", "schedules", "workouts", "profile"],
    manageMembers: false,
    manageTrainers: false,
    manageSchedules: false,
    manageWorkouts: false,
    manageMeetings: false
  }
};

var NAV_LINKS = [
  { key: "dashboard", label: "Dashboard", href: "dashboard.html" },
  { key: "members",   label: "Members",   href: "members.html" },
  { key: "trainers",  label: "Trainers",  href: "trainers.html" },
  { key: "schedules", label: "Schedules", href: "schedules.html" },
  { key: "workouts",  label: "Workouts",  href: "workouts.html" },
  { key: "meetings",  label: "Meetings",  href: "meetings.html" },
  { key: "profile",   label: "My Profile", href: "profile.html" }
];

// ---------- USER STORAGE ----------

function seedUsersIfEmpty() {
  if (localStorage.getItem(USERS_KEY) === null) {
    localStorage.setItem(USERS_KEY, JSON.stringify(SEED_USERS));
  }
  mergeMissingSeedUsers();
}

// Add any demo accounts missing from an existing localStorage install.
function mergeMissingSeedUsers() {
  var users = getUsers();
  var seen = {};
  var changed = false;

  users.forEach(function (u) {
    seen[normalizeEmail(u.email)] = true;
  });

  SEED_USERS.forEach(function (seed) {
    var key = normalizeEmail(seed.email);
    if (seen[key]) return;
    users.push({
      email: seed.email,
      password: seed.password,
      role: seed.role,
      name: seed.name,
      needsPasswordSetup: false,
      linkedId: seed.linkedId || null
    });
    seen[key] = true;
    changed = true;
  });

  if (changed) saveUsers(users);
}

function getUsers() {
  if (localStorage.getItem(USERS_KEY) === null) {
    localStorage.setItem(USERS_KEY, JSON.stringify(SEED_USERS));
  }
  var raw = localStorage.getItem(USERS_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveUsers(list) {
  localStorage.setItem(USERS_KEY, JSON.stringify(list));
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function findUserByEmail(email) {
  var target = normalizeEmail(email);
  var users = getUsers();
  for (var i = 0; i < users.length; i++) {
    if (normalizeEmail(users[i].email) === target) {
      return users[i];
    }
  }
  return null;
}

// Check email + password against stored users.
function findUser(email, password) {
  var user = findUserByEmail(email);
  if (!user) return null;
  if (user.needsPasswordSetup) return null;
  if (user.password !== password) return null;
  return user;
}

// Admin creates a member/trainer record — also provision a login account.
function createPendingUser(email, name, role, linkedId) {
  var normalized = normalizeEmail(email);
  var users = getUsers();

  for (var i = 0; i < users.length; i++) {
    if (normalizeEmail(users[i].email) === normalized) {
      users[i].name = name;
      users[i].role = role;
      if (linkedId) users[i].linkedId = linkedId;
      saveUsers(users);
      return users[i];
    }
  }

  var account = {
    email: email.trim(),
    password: null,
    role: role,
    name: name,
    needsPasswordSetup: true,
    linkedId: linkedId || null
  };
  users.push(account);
  saveUsers(users);
  return account;
}

// First-time activation: user sets their own password.
function activateUserPassword(email, password) {
  var users = getUsers();
  var target = normalizeEmail(email);
  var found = false;

  for (var i = 0; i < users.length; i++) {
    if (normalizeEmail(users[i].email) === target) {
      if (!users[i].needsPasswordSetup) {
        return { ok: false, reason: "already_active" };
      }
      users[i].password = password;
      users[i].needsPasswordSetup = false;
      found = true;
      break;
    }
  }

  if (!found) {
    return { ok: false, reason: "not_found" };
  }

  saveUsers(users);
  return { ok: true };
}

// Keep login account in sync when admin edits a member's email/name.
function syncMemberUserAccount(oldEmail, name, newEmail, memberId) {
  var users = getUsers();
  var oldTarget = normalizeEmail(oldEmail);
  var changed = false;

  for (var i = 0; i < users.length; i++) {
    if (users[i].role !== "member") continue;
    var match = normalizeEmail(users[i].email) === oldTarget ||
                (memberId && users[i].linkedId === memberId);
    if (match) {
      users[i].name = name;
      users[i].email = newEmail.trim();
      users[i].linkedId = memberId;
      changed = true;
      break;
    }
  }

  if (changed) saveUsers(users);
}

// Member self-service: update name/email on the login account.
function updateUserProfile(oldEmail, data) {
  var users = getUsers();
  var oldTarget = normalizeEmail(oldEmail);
  var newEmail = data.email.trim();
  var newTarget = normalizeEmail(newEmail);
  var found = false;

  for (var i = 0; i < users.length; i++) {
    if (normalizeEmail(users[i].email) === oldTarget) {
      if (oldTarget !== newTarget) {
        for (var j = 0; j < users.length; j++) {
          if (j !== i && normalizeEmail(users[j].email) === newTarget) {
            return { ok: false, reason: "email_taken" };
          }
        }
      }
      users[i].name = data.name.trim();
      users[i].email = newEmail;
      found = true;
      break;
    }
  }

  if (!found) return { ok: false, reason: "not_found" };
  saveUsers(users);
  return { ok: true };
}

// Refresh the active session after a profile edit.
function syncSessionProfile(name, email) {
  var session = getSession();
  if (!session) return;
  session.name = name;
  session.email = email;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function isUserPendingActivation(email) {
  var user = findUserByEmail(email);
  return user ? user.needsPasswordSetup === true : false;
}

function getAccountStatus(email) {
  var user = findUserByEmail(email);
  if (!user) return "none";
  return user.needsPasswordSetup ? "pending" : "active";
}

// ---------- SESSION ----------

function saveSession(user) {
  var session = {
    email: user.email,
    name: user.name,
    role: user.role,
    loggedInAt: new Date().toISOString()
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function getSession() {
  var raw = localStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function getRole() {
  var session = getSession();
  return session ? session.role : null;
}

// ---------- PERMISSION HELPERS ----------

function can(capability) {
  var role = getRole();
  if (!role || !PERMISSIONS[role]) return false;
  return PERMISSIONS[role][capability] === true;
}

function canManageMembers() { return can("manageMembers"); }
function canManageTrainers() { return can("manageTrainers"); }
function canManageSchedules() { return can("manageSchedules"); }
function canManageWorkouts() { return can("manageWorkouts"); }
function canManageMeetings() { return can("manageMeetings"); }

function getVisibleNavLinks(role) {
  var allowed = PERMISSIONS[role] ? PERMISSIONS[role].nav : [];
  return NAV_LINKS.filter(function (link) {
    return allowed.indexOf(link.key) !== -1;
  });
}

function getRoleLabel(role) { return PERMISSIONS[role] ? PERMISSIONS[role].label : role; }
function getRoleBadgeClass(role) { return PERMISSIONS[role] ? PERMISSIONS[role].badgeClass : "badge-silver"; }

// ---------- GUARDS ----------

function requireAuth() {
  if (!getSession()) {
    window.location.replace("index.html");
  }
}

function requirePageAccess(pageKey) {
  var role = getRole();
  if (!role) return;

  if (PERMISSIONS[role].nav.indexOf(pageKey) === -1) {
    sessionStorage.setItem("shame_access_denied", "1");
    window.location.replace("dashboard.html");
  }
}

function logout() {
  clearSession();
  sessionStorage.removeItem(SPLASH_KEY);
  window.location.replace("index.html");
}

// ---------- SIDEBAR ----------

// Apply a subtle accent theme on internal pages based on the logged-in role.
function applyRoleTheme() {
  var role = getRole();
  document.body.classList.remove("role-admin", "role-trainer", "role-member");
  if (role) {
    document.body.classList.add("role-" + role);
  }
}

function mountSidebar(activeKey) {
  var session = getSession();
  if (!session) return;

  applyRoleTheme();

  var nav = document.getElementById("nav");
  nav.innerHTML = "";
  getVisibleNavLinks(session.role).forEach(function (link, index) {
    var a = document.createElement("a");
    a.className = "nav-link" + (link.key === activeKey ? " active" : "");
    a.href = link.href;
    a.textContent = link.label;
    a.style.animationDelay = (index * 0.05) + "s";
    nav.appendChild(a);
  });

  document.getElementById("sidebarUserName").textContent = session.name;
  var roleEl = document.getElementById("sidebarUserRole");
  roleEl.className = "badge " + getRoleBadgeClass(session.role);
  roleEl.textContent = getRoleLabel(session.role);

  var logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn && !logoutBtn.dataset.wired) {
    logoutBtn.dataset.wired = "1";
    logoutBtn.addEventListener("click", logout);
  }
}

// Seed users on load (same pattern as data.js).
seedUsersIfEmpty();
