/* ============================================================
   profile.js — member self-service profile update.
   ============================================================ */

var profileOriginalEmail = null;

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
  if (!isoDate) return "—";
  var parts = isoDate.split("-");
  var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return parseInt(parts[2], 10) + " " + months[parseInt(parts[1], 10) - 1] + " " + parts[0];
}

function loadProfileForm() {
  var session = getSession();
  var user = findUserByEmail(session.email);
  var member = findMemberForUser(user || session);

  profileOriginalEmail = session.email;
  document.getElementById("pfName").value = session.name;
  document.getElementById("pfEmail").value = session.email;

  if (member && member.phone) {
    setPhoneFieldValues("pfPhoneCountry", "pfPhone", "pfPhoneHint", member.phone);
    document.getElementById("pfMembershipReadonly").textContent = member.type || "—";
    document.getElementById("pfStartReadonly").textContent = formatDate(member.startDate);
  } else {
    initPhoneField("pfPhoneCountry", "pfPhone", "pfPhoneHint");
    document.getElementById("pfMembershipReadonly").textContent = "—";
    document.getElementById("pfStartReadonly").textContent = "—";
  }
}

function validateProfileForm() {
  var ok = true;
  var name = document.getElementById("pfName");
  var email = document.getElementById("pfEmail");
  var phone = document.getElementById("pfPhone");

  clearFieldError(name, document.getElementById("pfNameError"));
  clearFieldError(email, document.getElementById("pfEmailError"));
  clearFieldError(phone, document.getElementById("pfPhoneError"));

  if (name.value.trim() === "") {
    showFieldError(name, document.getElementById("pfNameError"), "Full name is required.");
    ok = false;
  }
  if (email.value.trim() === "") {
    showFieldError(email, document.getElementById("pfEmailError"), "Email is required.");
    ok = false;
  } else if (!isValidEmail(email.value.trim())) {
    showFieldError(email, document.getElementById("pfEmailError"), "Enter a valid email address.");
    ok = false;
  }
  var phoneCheck = validatePhoneField("pfPhoneCountry", "pfPhone", document.getElementById("pfPhoneError"));
  if (!phoneCheck.ok) {
    showFieldError(phone, document.getElementById("pfPhoneError"), phoneCheck.message);
    ok = false;
  }
  return ok;
}

function saveProfile() {
  if (!validateProfileForm()) return;

  var session = getSession();
  var user = findUserByEmail(session.email);
  var data = {
    name: document.getElementById("pfName").value.trim(),
    email: document.getElementById("pfEmail").value.trim(),
    phone: getPhoneFormValue("pfPhoneCountry", "pfPhone")
  };

  var result = updateUserProfile(profileOriginalEmail, data);
  if (!result.ok) {
    if (result.reason === "email_taken") {
      showFieldError(document.getElementById("pfEmail"), document.getElementById("pfEmailError"), "That email is already in use.");
    } else {
      showToast("Could not update profile", "error");
    }
    return;
  }

  var member = findMemberForUser(user || session);
  if (member) {
    var members = getMembers();
    for (var i = 0; i < members.length; i++) {
      if (members[i].id === member.id) {
        members[i].name = data.name;
        members[i].email = data.email;
        members[i].phone = data.phone;
        break;
      }
    }
    saveMembers(members);
  }

  syncSessionProfile(data.name, data.email);
  profileOriginalEmail = data.email;
  document.getElementById("sidebarUserName").textContent = data.name;
  showToast("Profile updated successfully", "success");
}

function initProfilePage() {
  initPhoneField("pfPhoneCountry", "pfPhone", "pfPhoneHint");
  loadProfileForm();
  document.getElementById("profileForm").addEventListener("submit", function (event) {
    event.preventDefault();
    saveProfile();
  });
}
