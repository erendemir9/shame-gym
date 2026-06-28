/* ============================================================
   auth.js — authentication + role-based access.
   Login, logout, activation, and session validation use PHP
   (api/auth/*). A localStorage session cache mirrors the server
   user for page guards; shame_users seed data is kept for
   emergency fallback and legacy sync helpers only.
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

var AUTH_API_BASE = "api/auth/";

// ---------- PHP AUTH API HELPERS ----------

function authApiRequest(path, options) {
  var requestOptions = options || {};
  requestOptions.credentials = "same-origin";

  if (requestOptions.body && typeof requestOptions.body === "object") {
    requestOptions.headers = requestOptions.headers || {};
    requestOptions.headers["Content-Type"] = "application/json";
    requestOptions.body = JSON.stringify(requestOptions.body);
  }

  return fetch(AUTH_API_BASE + path, requestOptions)
    .then(function (response) {
      return response.text().then(function (text) {
        var data = {};

        if (text) {
          try {
            data = JSON.parse(text);
          } catch (parseError) {
            data = {
              success: false,
              message: "Invalid server response."
            };
          }
        }

        return {
          ok: response.ok,
          status: response.status,
          data: data
        };
      });
    })
    .catch(function () {
      return {
        ok: false,
        status: 0,
        data: {
          success: false,
          message: "Network error. Please try again."
        }
      };
    });
}

function authApiPost(path, body) {
  return authApiRequest(path, {
    method: "POST",
    body: body
  });
}

function authApiGet(path) {
  return authApiRequest(path, {
    method: "GET"
  });
}

function mapApiUserToSessionUser(apiUser) {
  var linkedId = null;

  if (apiUser.linked_member_id) {
    linkedId = "m" + apiUser.linked_member_id;
  } else if (apiUser.linked_trainer_id) {
    linkedId = "t" + apiUser.linked_trainer_id;
  }

  return {
    email: apiUser.email,
    name: apiUser.full_name,
    role: apiUser.role,
    linkedId: linkedId,
    userId: apiUser.id,
    loggedInAt: new Date().toISOString()
  };
}

function saveSessionFromApiUser(apiUser) {
  saveSession(mapApiUserToSessionUser(apiUser));
}

function loginWithApi(email, password) {
  return authApiPost("login.php", {
    email: email,
    password: password
  }).then(function (result) {
    if (result.ok && result.data.success && result.data.data && result.data.data.user) {
      return {
        ok: true,
        user: result.data.data.user
      };
    }

    var message = result.data.message || "Invalid email or password. Please try again.";

    if (result.status === 403 && message.toLowerCase().indexOf("activation") !== -1) {
      return {
        ok: false,
        reason: "needs_activation",
        message: message
      };
    }

    if (result.status === 401) {
      message = "Invalid email or password. Please try again.";
    }

    return {
      ok: false,
      message: message
    };
  });
}

function activateAccountWithApi(email, password, confirmPassword) {
  return authApiPost("activate.php", {
    email: email,
    password: password,
    confirmPassword: confirmPassword
  }).then(function (result) {
    if (result.ok && result.data.success) {
      return {
        ok: true,
        message: result.data.message || "Account activated successfully"
      };
    }

    var message = result.data.message || "Activation failed. Please try again.";
    var reason = null;

    if (result.status === 409) {
      reason = "already_active";
    } else if (result.status === 404) {
      reason = "not_found";
    }

    return {
      ok: false,
      reason: reason,
      message: message
    };
  });
}

function getServerSession() {
  return authApiGet("session.php").then(function (result) {
    if (result.ok && result.data.success && result.data.data && result.data.data.user) {
      return {
        ok: true,
        user: result.data.data.user
      };
    }

    return {
      ok: false
    };
  });
}

function syncServerSession() {
  return getServerSession().then(function (result) {
    if (result.ok) {
      saveSessionFromApiUser(result.user);
      return true;
    }

    clearSession();
    return false;
  });
}

function checkLoginPageSession() {
  return getServerSession().then(function (result) {
    if (result.ok) {
      saveSessionFromApiUser(result.user);
      window.location.replace("dashboard.html");
      return;
    }

    if (getSession()) {
      clearSession();
    }
  });
}

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

// Keep login account in sync when admin edits a trainer's email/name.
function syncTrainerUserAccount(oldEmail, name, newEmail, trainerId) {
  var users = getUsers();
  var oldTarget = normalizeEmail(oldEmail);
  var changed = false;

  for (var i = 0; i < users.length; i++) {
    if (users[i].role !== "trainer") continue;
    var match = normalizeEmail(users[i].email) === oldTarget ||
                (trainerId && users[i].linkedId === trainerId);
    if (match) {
      users[i].name = name;
      users[i].email = newEmail.trim();
      users[i].linkedId = trainerId;
      changed = true;
      break;
    }
  }

  if (changed) saveUsers(users);
}

// Remove the login account when admin deletes a trainer.
function removeTrainerUserAccount(email, trainerId) {
  var users = getUsers();
  var oldTarget = normalizeEmail(email);
  var filtered = users.filter(function (user) {
    if (user.role !== "trainer") return true;
    if (trainerId && user.linkedId === trainerId) return false;
    return normalizeEmail(user.email) !== oldTarget;
  });
  if (filtered.length !== users.length) saveUsers(filtered);
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
    loggedInAt: user.loggedInAt || new Date().toISOString()
  };

  if (user.linkedId) {
    session.linkedId = user.linkedId;
  }

  if (user.userId) {
    session.userId = user.userId;
  }

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
    return;
  }

  getServerSession().then(function (result) {
    if (result.ok) {
      saveSessionFromApiUser(result.user);
      return;
    }

    clearSession();
    window.location.replace("index.html");
  });
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
  authApiPost("logout.php", {}).finally(function () {
    clearSession();
    sessionStorage.removeItem(SPLASH_KEY);
    window.location.replace("index.html");
  });
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

// ---------- LOGIN PAGE (index.html) ----------

function setLoginFieldError(input, errorEl, message) {
  errorEl.textContent = message;
  errorEl.classList.add("show");
  input.classList.add("invalid");
  input.classList.remove("shake");
  void input.offsetWidth;
  input.classList.add("shake");
}

function clearLoginFieldError(input, errorEl) {
  errorEl.textContent = "";
  errorEl.classList.remove("show");
  input.classList.remove("invalid");
}

function setLoginButtonLoading(button, loading) {
  if (loading) {
    button.classList.add("btn-loading");
    button.disabled = true;
  } else {
    button.classList.remove("btn-loading");
    button.disabled = false;
  }
}

function initLoginPage() {
  var loginForm = document.getElementById("loginForm");
  var activateForm = document.getElementById("activateForm");
  if (!loginForm || !activateForm) return;

  var loginView = document.getElementById("loginView");
  var activateView = document.getElementById("activateView");
  var emailInput = document.getElementById("email");
  var passwordInput = document.getElementById("password");
  var loginError = document.getElementById("loginError");
  var activateError = document.getElementById("activateError");
  var activateSuccess = document.getElementById("activateSuccess");
  var activateEmail = document.getElementById("activateEmail");
  var activatePassword = document.getElementById("activatePassword");
  var activateConfirm = document.getElementById("activateConfirm");
  var strengthBar = document.getElementById("passwordStrengthBar");
  var showActivateBtn = document.getElementById("showActivateBtn");
  var showLoginBtn = document.getElementById("showLoginBtn");

  if (!emailInput || !passwordInput || !loginError || !activateError || !activateSuccess) return;

  function switchLoginView(showActivate) {
    if (showActivate) {
      loginView.style.display = "none";
      activateView.style.display = "block";
      activateView.classList.remove("view-switch");
      void activateView.offsetWidth;
      activateView.classList.add("view-switch");
      if (emailInput.value.trim() && activateEmail) {
        activateEmail.value = emailInput.value.trim();
      }
    } else {
      activateView.style.display = "none";
      loginView.style.display = "block";
      loginView.classList.remove("view-switch");
      void loginView.offsetWidth;
      loginView.classList.add("view-switch");
    }
  }

  if (showActivateBtn) {
    showActivateBtn.addEventListener("click", function () {
      switchLoginView(true);
    });
  }

  if (showLoginBtn) {
    showLoginBtn.addEventListener("click", function () {
      switchLoginView(false);
    });
  }

  function validateLoginForm() {
    var isValid = true;
    clearLoginFieldError(emailInput, document.getElementById("emailError"));
    clearLoginFieldError(passwordInput, document.getElementById("passwordError"));

    if (emailInput.value.trim() === "") {
      setLoginFieldError(emailInput, document.getElementById("emailError"), "Email is required.");
      isValid = false;
    }
    if (passwordInput.value.trim() === "") {
      setLoginFieldError(passwordInput, document.getElementById("passwordError"), "Password is required.");
      isValid = false;
    }
    return isValid;
  }

  function handleLoginSubmit(event) {
    event.preventDefault();

    loginError.classList.remove("show");
    if (!validateLoginForm()) return;

    var email = emailInput.value.trim();
    var loginBtn = document.getElementById("loginSubmitBtn");
    setLoginButtonLoading(loginBtn, true);

    loginWithApi(email, passwordInput.value)
      .then(function (result) {
        if (!result.ok) {
          if (result.reason === "needs_activation") {
            loginError.textContent = "Your account needs activation. Set your password first.";
            loginError.classList.add("show");
            switchLoginView(true);
            if (activateEmail) activateEmail.value = email;
          } else {
            loginError.textContent = result.message || "Invalid email or password. Please try again.";
            loginError.classList.add("show");
          }
          setLoginButtonLoading(loginBtn, false);
          return;
        }

        saveSessionFromApiUser(result.user);
        loginBtn.classList.add("btn-success-flash");
        setTimeout(function () {
          window.location.replace("dashboard.html");
        }, 350);
      })
      .catch(function () {
        loginError.textContent = "Network error. Please try again.";
        loginError.classList.add("show");
        setLoginButtonLoading(loginBtn, false);
      });
  }

  loginForm.addEventListener("submit", handleLoginSubmit);

  emailInput.addEventListener("input", function () {
    clearLoginFieldError(emailInput, document.getElementById("emailError"));
  });
  passwordInput.addEventListener("input", function () {
    clearLoginFieldError(passwordInput, document.getElementById("passwordError"));
  });

  function updatePasswordStrength(value) {
    if (!strengthBar) return;

    var score = 0;
    if (value.length >= 6) score++;
    if (value.length >= 10) score++;
    if (/[A-Z]/.test(value) && /[0-9]/.test(value)) score++;

    strengthBar.className = "password-strength-bar";
    if (score === 0) {
      strengthBar.style.width = "0%";
    } else if (score === 1) {
      strengthBar.classList.add("weak");
      strengthBar.style.width = "33%";
    } else if (score === 2) {
      strengthBar.classList.add("medium");
      strengthBar.style.width = "66%";
    } else {
      strengthBar.classList.add("strong");
      strengthBar.style.width = "100%";
    }
  }

  if (activatePassword) {
    activatePassword.addEventListener("input", function () {
      clearLoginFieldError(activatePassword, document.getElementById("activatePasswordError"));
      updatePasswordStrength(activatePassword.value);
    });
  }

  if (activateConfirm) {
    activateConfirm.addEventListener("input", function () {
      clearLoginFieldError(activateConfirm, document.getElementById("activateConfirmError"));
    });
  }

  if (activateEmail) {
    activateEmail.addEventListener("input", function () {
      clearLoginFieldError(activateEmail, document.getElementById("activateEmailError"));
    });
  }

  function validateActivateForm() {
    var isValid = true;
    activateError.classList.remove("show");
    activateSuccess.classList.remove("show");
    clearLoginFieldError(activateEmail, document.getElementById("activateEmailError"));
    clearLoginFieldError(activatePassword, document.getElementById("activatePasswordError"));
    clearLoginFieldError(activateConfirm, document.getElementById("activateConfirmError"));

    var email = activateEmail ? activateEmail.value.trim() : "";
    if (email === "") {
      setLoginFieldError(activateEmail, document.getElementById("activateEmailError"), "Email is required.");
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLoginFieldError(activateEmail, document.getElementById("activateEmailError"), "Enter a valid email address.");
      isValid = false;
    }

    var password = activatePassword ? activatePassword.value : "";
    if (password.length < 6) {
      setLoginFieldError(activatePassword, document.getElementById("activatePasswordError"), "Password must be at least 6 characters.");
      isValid = false;
    }
    if (activateConfirm && activateConfirm.value !== password) {
      setLoginFieldError(activateConfirm, document.getElementById("activateConfirmError"), "Passwords do not match.");
      isValid = false;
    }
    return isValid;
  }

  function handleActivateSubmit(event) {
    event.preventDefault();
    if (!validateActivateForm()) return;

    var activateBtn = document.getElementById("activateSubmitBtn");
    setLoginButtonLoading(activateBtn, true);

    activateAccountWithApi(
      activateEmail.value.trim(),
      activatePassword.value,
      activateConfirm.value
    )
      .then(function (result) {
        if (!result.ok) {
          if (result.reason === "already_active") {
            activateError.textContent = "This account is already active. Log in instead.";
          } else if (result.reason === "not_found") {
            activateError.textContent = "No account found. Contact your administrator.";
          } else {
            activateError.textContent = result.message || "Activation failed. Please try again.";
          }
          activateError.classList.add("show");
          setLoginButtonLoading(activateBtn, false);
          return;
        }

        activateSuccess.textContent = "Account activated! Redirecting to log in…";
        activateSuccess.classList.add("show");
        activateBtn.classList.add("btn-success-flash");

        setTimeout(function () {
          emailInput.value = activateEmail.value.trim();
          passwordInput.value = "";
          activateForm.reset();
          if (strengthBar) {
            strengthBar.style.width = "0%";
            strengthBar.className = "password-strength-bar";
          }
          setLoginButtonLoading(activateBtn, false);
          switchLoginView(false);
        }, 1200);
      })
      .catch(function () {
        activateError.textContent = "Network error. Please try again.";
        activateError.classList.add("show");
        setLoginButtonLoading(activateBtn, false);
      });
  }

  activateForm.addEventListener("submit", handleActivateSubmit);

  checkLoginPageSession();
}

function bootLoginPage() {
  if (!document.getElementById("loginForm")) return;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initLoginPage);
  } else {
    initLoginPage();
  }
}

// Seed users on load (same pattern as data.js).
seedUsersIfEmpty();
bootLoginPage();
