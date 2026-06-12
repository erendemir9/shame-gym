/* ============================================================
   auth.js — simulated authentication (frontend only, no backend).
   Handles: hardcoded users, login check, session in localStorage,
   logout, and the route guard for protected pages.
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

// ROUTE GUARD: call at the top of every protected page.
// If there is no session, send the user back to the login page.
function requireAuth() {
  if (!getSession()) {
    window.location.replace("index.html");
  }
}

// Log out: clear the session and return to the login page.
function logout() {
  clearSession();
  window.location.replace("index.html");
}
