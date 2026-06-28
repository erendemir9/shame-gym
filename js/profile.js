/* ============================================================
   profile.js — self-service profile update via api/profile/me.php
   with localStorage emergency fallback.
   ============================================================ */

var PROFILE_API_URL = "api/profile/me.php";
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

function populateProfileFormFromData(profile, user) {
  var fullName = profile && profile.full_name ? profile.full_name : (user && user.full_name ? user.full_name : "");
  var email = profile && profile.email ? profile.email : (user && user.email ? user.email : "");

  profileOriginalEmail = email;
  document.getElementById("pfName").value = fullName;
  document.getElementById("pfEmail").value = email;

  if (profile && profile.phone) {
    setPhoneFieldValues("pfPhoneCountry", "pfPhone", "pfPhoneHint", profile.phone);
  } else {
    initPhoneField("pfPhoneCountry", "pfPhone", "pfPhoneHint");
  }

  if (profile && profile.membership_type) {
    document.getElementById("pfMembershipReadonly").textContent = profile.membership_type;
    document.getElementById("pfStartReadonly").textContent = formatDate(profile.start_date);
  } else {
    document.getElementById("pfMembershipReadonly").textContent = "—";
    document.getElementById("pfStartReadonly").textContent = "—";
  }
}

function loadProfileFromApi() {
  return fetch(PROFILE_API_URL, {
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
            message: data.message || "Could not load profile."
          };
        }

        return {
          ok: true,
          user: data.data && data.data.user ? data.data.user : null,
          profile: data.data && data.data.profile ? data.data.profile : null
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

function loadProfileForm() {
  return loadProfileFromApi().then(function (result) {
    if (result.ok) {
      populateProfileFormFromData(result.profile, result.user);
      return;
    }

    console.warn("Profile API unavailable:", result.message);

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

    if (typeof showToast === "function") {
      showToast("Could not load profile from server. Showing saved local data.", "info");
    }
  });
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

function updateProfileWithApi(profileData) {
  return fetch(PROFILE_API_URL, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      full_name: profileData.name,
      email: profileData.email,
      phone: profileData.phone
    })
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
            status: response.status,
            message: data.message || "Could not update profile."
          };
        }

        return {
          ok: true,
          user: data.data && data.data.user ? data.data.user : null,
          profile: data.data && data.data.profile ? data.data.profile : null,
          message: data.message || "Profile updated successfully"
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

function saveProfileToLocalStorage(data) {
  var session = getSession();
  var user = findUserByEmail(session.email);
  var result = updateUserProfile(profileOriginalEmail, data);

  if (!result.ok) {
    return result;
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
  return { ok: true };
}

function saveProfile() {
  if (!validateProfileForm()) return;

  var profileData = {
    name: document.getElementById("pfName").value.trim(),
    email: document.getElementById("pfEmail").value.trim(),
    phone: getPhoneFormValue("pfPhoneCountry", "pfPhone")
  };

  updateProfileWithApi(profileData).then(function (result) {
    if (result.ok) {
      syncSessionProfile(profileData.name, profileData.email);
      profileOriginalEmail = profileData.email;
      document.getElementById("sidebarUserName").textContent = profileData.name;

      if (result.profile) {
        populateProfileFormFromData(result.profile, result.user);
      }

      showToast(result.message || "Profile updated successfully", "success");
      return;
    }

    if (result.networkError) {
      var localResult = saveProfileToLocalStorage(profileData);
      if (!localResult.ok) {
        if (localResult.reason === "email_taken") {
          showFieldError(document.getElementById("pfEmail"), document.getElementById("pfEmailError"), "That email is already in use.");
        } else {
          showToast("Could not update profile", "error");
        }
        return;
      }

      showToast("Server unavailable. Profile saved locally only.", "info");
      return;
    }

    if (result.status === 409) {
      showFieldError(document.getElementById("pfEmail"), document.getElementById("pfEmailError"), "That email is already in use.");
      return;
    }

    showToast(result.message || "Could not update profile", "error");
  });
}

function initProfilePage() {
  initPhoneField("pfPhoneCountry", "pfPhone", "pfPhoneHint");
  loadProfileForm();
  document.getElementById("profileForm").addEventListener("submit", function (event) {
    event.preventDefault();
    saveProfile();
  });
}
