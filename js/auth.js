/* ============================================================
   auth.js — simulated authentication + role-based access (no backend).
   Handles: hardcoded users, login check, session in localStorage,
   logout, route guard, and ONE central permissions map that every
   page asks about ("can this role do X?").
   ============================================================ */

// Hardcoded demo users. In a real app this lives on a server; for this
// Sprint we check credentials directly in JavaScript.
var USERS = [
  { email: "admin@shame.gym",   password: "admin123",   role: "admin",   name: "Admin User" },
  { email: "trainer@shame.gym", password: "trainer123", role: "trainer", name: "Trainer User" },
  { email: "member@shame.gym",  password: "member123",  role: "member",  name: "Member User" }
];

// localStorage key for the logged-in session.
var SESSION_KEY = "shame_session";
// sessionStorage key that remembers the splash already played this session.
var SPLASH_KEY = "shame_splash_played";

// ---------- ROLE-BASED ACCESS: ONE CENTRAL MAP ----------
// Each role lists which pages it can SEE (nav) and which things it can
// MANAGE (the add/edit buttons). Pages never hard-code roles; they ask the
// helper functions below, which read this single map. Easy to explain:
// "one permissions map, helpers read it, pages ask the helpers."
var PERMISSIONS = {
  admin: {
    label: "Administrator",
    badgeClass: "badge-blue",
    nav: ["dashboard", "members", "trainers", "schedules"],
    manageMembers: true,
    manageTrainers: true,
    manageSchedules: true
  },
  trainer: {
    label: "Trainer",
    badgeClass: "badge-silver",
    nav: ["dashboard", "members", "trainers", "schedules"], // view-only
    manageMembers: false,
    manageTrainers: false,
    manageSchedules: false
  },
  member: {
    label: "Member",
    badgeClass: "badge-purple",
    nav: ["dashboard", "schedules"], // members/trainers hidden entirely
    manageMembers: false,
    manageTrainers: false,
    manageSchedules: false
  }
};

// The full set of nav links. getVisibleNavLinks() filters this per role.
var NAV_LINKS = [
  { key: "dashboard", label: "Dashboard", href: "dashboard.html" },
  { key: "members",   label: "Members",   href: "members.html" },
  { key: "trainers",  label: "Trainers",  href: "trainers.html" },
  { key: "schedules", label: "Schedules", href: "schedules.html" }
];

// Check email + password against the user list.
// Returns the matching user object, or null if no match.
function findUser(email, password) {
  for (var i = 0; i < USERS.length; i++) {
    if (USERS[i].email === email && USERS[i].password === password) {
      return USERS[i];
    }
  }
  return null;
}

// Save the logged-in user as a session in localStorage.
// We store only what pages need (never the password).
function saveSession(user) {
  var session = {
    email: user.email,
    name: user.name,
    role: user.role,
    loggedInAt: new Date().toISOString()
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

// Read the current session, or null if nobody is logged in.
function getSession() {
  var raw = localStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

// Clear the session (used by logout).
function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// The role of the logged-in user, or null when nobody is logged in.
function getRole() {
  var session = getSession();
  return session ? session.role : null;
}

// ---------- PERMISSION HELPERS (pages call these) ----------

// Generic check: does the current role have this capability set to true?
function can(capability) {
  var role = getRole();
  if (!role || !PERMISSIONS[role]) return false;
  return PERMISSIONS[role][capability] === true;
}

// Friendly named helpers so page code reads clearly.
function canManageMembers() { return can("manageMembers"); }
function canManageTrainers() { return can("manageTrainers"); }
function canManageSchedules() { return can("manageSchedules"); }

// The nav links this role is allowed to see (used to build the sidebar).
function getVisibleNavLinks(role) {
  var allowed = PERMISSIONS[role] ? PERMISSIONS[role].nav : [];
  return NAV_LINKS.filter(function (link) {
    return allowed.indexOf(link.key) !== -1;
  });
}

// The human label + pill colour for a role (used on badges).
function getRoleLabel(role) { return PERMISSIONS[role] ? PERMISSIONS[role].label : role; }
function getRoleBadgeClass(role) { return PERMISSIONS[role] ? PERMISSIONS[role].badgeClass : "badge-silver"; }

// ---------- GUARDS ----------

// ROUTE GUARD: call at the top of every protected page.
// If there is no session, send the user back to the login page.
function requireAuth() {
  if (!getSession()) {
    window.location.replace("index.html");
  }
}

// PAGE ACCESS GUARD: call after requireAuth() with this page's key.
// If the role is not allowed to see this page, flag it and bounce to the
// dashboard (e.g. a member typing members.html in the address bar).
function requirePageAccess(pageKey) {
  var role = getRole();
  if (!role) return; // requireAuth() already handled the no-session case

  if (PERMISSIONS[role].nav.indexOf(pageKey) === -1) {
    // Leave a note so the dashboard can show a short "no access" toast.
    sessionStorage.setItem("shame_access_denied", "1");
    window.location.replace("dashboard.html");
  }
}

// Log out: clear the session, ALSO reset the splash flag so the full
// splash + login experience plays again, then return to the login page.
function logout() {
  clearSession();
  sessionStorage.removeItem(SPLASH_KEY); // splash plays again after logout
  window.location.replace("index.html");
}

// ---------- SIDEBAR ----------

// Build the sidebar for the current role: render the allowed nav links
// (marking the active one), show the user's name + role pill, wire Logout.
// Called once on every internal page, passing that page's key.
function mountSidebar(activeKey) {
  var session = getSession();
  if (!session) return; // requireAuth() already handles the no-session case

  // Render only the nav links this role may see.
  var nav = document.getElementById("nav");
  nav.innerHTML = "";
  getVisibleNavLinks(session.role).forEach(function (link) {
    var a = document.createElement("a");
    a.className = "nav-link" + (link.key === activeKey ? " active" : "");
    a.href = link.href;
    a.textContent = link.label;
    nav.appendChild(a);
  });

  // User name + a coloured role pill.
  document.getElementById("sidebarUserName").textContent = session.name;
  var roleEl = document.getElementById("sidebarUserRole");
  roleEl.className = "badge " + getRoleBadgeClass(session.role);
  roleEl.textContent = getRoleLabel(session.role);

  document.getElementById("logoutBtn").addEventListener("click", logout);
}
