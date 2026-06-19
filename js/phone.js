/* ============================================================
   phone.js — country picker + international phone validation.
   Shared by members, trainers, and profile forms (no external library).
   ============================================================ */

var PHONE_COUNTRIES = {
  US: { dial: "1",   label: "\uD83C\uDDFA\uD83C\uDDF8 +1",   placeholder: "202 555 0143",    hint: "US: 10 digits", digits: 10, format: function (d) { return "+1 " + d.slice(0, 3) + " " + d.slice(3, 6) + " " + d.slice(6); } },
  TR: { dial: "90",  label: "\uD83C\uDDF9\uD83C\uDDF7 +90",   placeholder: "532 123 4567",    hint: "TR: 10 digits", digits: 10, format: function (d) { return "+90 " + d.slice(0, 3) + " " + d.slice(3, 6) + " " + d.slice(6, 8) + " " + d.slice(8); } },
  GB: { dial: "44",  label: "\uD83C\uDDEC\uD83C\uDDE7 +44",   placeholder: "2079460958",      hint: "UK: 10 digits", digits: 10, format: function (d) { return "+44 " + d.slice(0, 2) + " " + d.slice(2, 6) + " " + d.slice(6); } },
  DE: { dial: "49",  label: "\uD83C\uDDE9\uD83C\uDDEA +49",   placeholder: "1512345678",      hint: "DE: 10 digits", digits: 10, format: function (d) { return "+49 " + d.slice(0, 3) + " " + d.slice(3); } },
  FR: { dial: "33",  label: "\uD83C\uDDEB\uD83C\uDDF7 +33",   placeholder: "612345678",       hint: "FR: 9 digits",  digits: 9,  format: function (d) { return "+33 " + d.slice(0, 1) + " " + d.slice(1, 3) + " " + d.slice(3, 5) + " " + d.slice(5, 7) + " " + d.slice(7); } },
  IT: { dial: "39",  label: "\uD83C\uDDEE\uD83C\uDDF9 +39",   placeholder: "3123456789",      hint: "IT: 10 digits", digits: 10, format: function (d) { return "+39 " + d.slice(0, 3) + " " + d.slice(3, 6) + " " + d.slice(6); } },
  ES: { dial: "34",  label: "\uD83C\uDDEA\uD83C\uDDF8 +34",   placeholder: "612345678",       hint: "ES: 9 digits",  digits: 9,  format: function (d) { return "+34 " + d.slice(0, 3) + " " + d.slice(3, 6) + " " + d.slice(6); } },
  NL: { dial: "31",  label: "\uD83C\uDDF3\uD83C\uDDF1 +31",   placeholder: "612345678",       hint: "NL: 9 digits",  digits: 9,  format: function (d) { return "+31 " + d.slice(0, 1) + " " + d.slice(1, 4) + " " + d.slice(4); } },
  BE: { dial: "32",  label: "\uD83C\uDDE7\uD83C\uDDEA +32",   placeholder: "470123456",       hint: "BE: 9 digits",  digits: 9,  format: function (d) { return "+32 " + d.slice(0, 3) + " " + d.slice(3, 5) + " " + d.slice(5); } },
  AT: { dial: "43",  label: "\uD83C\uDDE6\uD83C\uDDF9 +43",   placeholder: "6641234567",      hint: "AT: 10 digits", digits: 10, format: function (d) { return "+43 " + d.slice(0, 3) + " " + d.slice(3); } },
  CH: { dial: "41",  label: "\uD83C\uDDE8\uD83C\uDDED +41",   placeholder: "791234567",       hint: "CH: 9 digits",  digits: 9,  format: function (d) { return "+41 " + d.slice(0, 2) + " " + d.slice(2, 5) + " " + d.slice(5); } },
  SE: { dial: "46",  label: "\uD83C\uDDF8\uD83C\uDDEA +46",   placeholder: "701234567",       hint: "SE: 9 digits",  digits: 9,  format: function (d) { return "+46 " + d.slice(0, 2) + " " + d.slice(2, 5) + " " + d.slice(5); } },
  NO: { dial: "47",  label: "\uD83C\uDDF3\uD83C\uDDF4 +47",   placeholder: "41234567",        hint: "NO: 8 digits",  digits: 8,  format: function (d) { return "+47 " + d.slice(0, 3) + " " + d.slice(3); } },
  DK: { dial: "45",  label: "\uD83C\uDDE9\uD83C\uDDF0 +45",   placeholder: "12345678",        hint: "DK: 8 digits",  digits: 8,  format: function (d) { return "+45 " + d.slice(0, 2) + " " + d.slice(2, 4) + " " + d.slice(4); } },
  FI: { dial: "358", label: "\uD83C\uDDEB\uD83C\uDDEE +358",  placeholder: "412345678",       hint: "FI: 9 digits",  digits: 9,  format: function (d) { return "+358 " + d.slice(0, 2) + " " + d.slice(2, 5) + " " + d.slice(5); } },
  PL: { dial: "48",  label: "\uD83C\uDDF5\uD83C\uDDF1 +48",   placeholder: "512345678",       hint: "PL: 9 digits",  digits: 9,  format: function (d) { return "+48 " + d.slice(0, 3) + " " + d.slice(3, 6) + " " + d.slice(6); } },
  CZ: { dial: "420", label: "\uD83C\uDDE8\uD83C\uDDFF +420",  placeholder: "601234567",       hint: "CZ: 9 digits",  digits: 9,  format: function (d) { return "+420 " + d.slice(0, 3) + " " + d.slice(3, 6) + " " + d.slice(6); } },
  GR: { dial: "30",  label: "\uD83C\uDDEC\uD83C\uDDF7 +30",   placeholder: "6912345678",      hint: "GR: 10 digits", digits: 10, format: function (d) { return "+30 " + d.slice(0, 3) + " " + d.slice(3); } },
  PT: { dial: "351", label: "\uD83C\uDDF5\uD83C\uDDF9 +351",  placeholder: "912345678",       hint: "PT: 9 digits",  digits: 9,  format: function (d) { return "+351 " + d.slice(0, 3) + " " + d.slice(3, 6) + " " + d.slice(6); } },
  IE: { dial: "353", label: "\uD83C\uDDEE\uD83C\uDDEA +353",  placeholder: "851234567",       hint: "IE: 9 digits",  digits: 9,  format: function (d) { return "+353 " + d.slice(0, 2) + " " + d.slice(2, 5) + " " + d.slice(5); } },
  RO: { dial: "40",  label: "\uD83C\uDDF7\uD83C\uDDF4 +40",   placeholder: "712345678",       hint: "RO: 9 digits",  digits: 9,  format: function (d) { return "+40 " + d.slice(0, 3) + " " + d.slice(3, 6) + " " + d.slice(6); } },
  HU: { dial: "36",  label: "\uD83C\uDDED\uD83C\uDDFA +36",   placeholder: "201234567",       hint: "HU: 9 digits",  digits: 9,  format: function (d) { return "+36 " + d.slice(0, 2) + " " + d.slice(2, 5) + " " + d.slice(5); } },
  UA: { dial: "380", label: "\uD83C\uDDFA\uD83C\uDDE6 +380",  placeholder: "501234567",       hint: "UA: 9 digits",  digits: 9,  format: function (d) { return "+380 " + d.slice(0, 2) + " " + d.slice(2, 5) + " " + d.slice(5); } },
  RU: { dial: "7",   label: "\uD83C\uDDF7\uD83C\uDDFA +7",    placeholder: "9123456789",      hint: "RU: 10 digits", digits: 10, format: function (d) { return "+7 " + d.slice(0, 3) + " " + d.slice(3, 6) + " " + d.slice(6); } },
  AE: { dial: "971", label: "\uD83C\uDDE6\uD83C\uDDEA +971",  placeholder: "501234567",       hint: "AE: 9 digits",  digits: 9,  format: function (d) { return "+971 " + d.slice(0, 2) + " " + d.slice(2, 5) + " " + d.slice(5); } },
  SA: { dial: "966", label: "\uD83C\uDDF8\uD83C\uDDE6 +966",  placeholder: "501234567",       hint: "SA: 9 digits",  digits: 9,  format: function (d) { return "+966 " + d.slice(0, 2) + " " + d.slice(2, 5) + " " + d.slice(5); } },
  EG: { dial: "20",  label: "\uD83C\uDDEA\uD83C\uDDEC +20",   placeholder: "1012345678",      hint: "EG: 10 digits", digits: 10, format: function (d) { return "+20 " + d.slice(0, 3) + " " + d.slice(3); } },
  IL: { dial: "972", label: "\uD83C\uDDEE\uD83C\uDDF1 +972",  placeholder: "501234567",       hint: "IL: 9 digits",  digits: 9,  format: function (d) { return "+972 " + d.slice(0, 2) + " " + d.slice(2, 5) + " " + d.slice(5); } },
  IN: { dial: "91",  label: "\uD83C\uDDEE\uD83C\uDDF3 +91",   placeholder: "9876543210",      hint: "IN: 10 digits", digits: 10, format: function (d) { return "+91 " + d.slice(0, 5) + " " + d.slice(5); } },
  PK: { dial: "92",  label: "\uD83C\uDDF5\uD83C\uDDF0 +92",   placeholder: "3001234567",      hint: "PK: 10 digits", digits: 10, format: function (d) { return "+92 " + d.slice(0, 3) + " " + d.slice(3); } },
  CN: { dial: "86",  label: "\uD83C\uDDE8\uD83C\uDDF3 +86",   placeholder: "13123456789",     hint: "CN: 11 digits", digits: 11, format: function (d) { return "+86 " + d.slice(0, 3) + " " + d.slice(3, 7) + " " + d.slice(7); } },
  JP: { dial: "81",  label: "\uD83C\uDDEF\uD83C\uDDF5 +81",   placeholder: "9012345678",      hint: "JP: 10 digits", digits: 10, format: function (d) { return "+81 " + d.slice(0, 2) + " " + d.slice(2, 6) + " " + d.slice(6); } },
  KR: { dial: "82",  label: "\uD83C\uDDF0\uD83C\uDDF7 +82",   placeholder: "1012345678",      hint: "KR: 10 digits", digits: 10, format: function (d) { return "+82 " + d.slice(0, 2) + " " + d.slice(2, 6) + " " + d.slice(6); } },
  SG: { dial: "65",  label: "\uD83C\uDDF8\uD83C\uDDEC +65",   placeholder: "81234567",        hint: "SG: 8 digits",  digits: 8,  format: function (d) { return "+65 " + d.slice(0, 4) + " " + d.slice(4); } },
  MY: { dial: "60",  label: "\uD83C\uDDF2\uD83C\uDDDE +60",   placeholder: "123456789",       hint: "MY: 9 digits",  digits: 9,  format: function (d) { return "+60 " + d.slice(0, 2) + " " + d.slice(2, 5) + " " + d.slice(5); } },
  TH: { dial: "66",  label: "\uD83C\uDDF9\uD83C\uDDED +66",   placeholder: "812345678",       hint: "TH: 9 digits",  digits: 9,  format: function (d) { return "+66 " + d.slice(0, 2) + " " + d.slice(2, 5) + " " + d.slice(5); } },
  AU: { dial: "61",  label: "\uD83C\uDDE6\uD83C\uDDFA +61",   placeholder: "412345678",       hint: "AU: 9 digits",  digits: 9,  format: function (d) { return "+61 " + d.slice(0, 3) + " " + d.slice(3, 6) + " " + d.slice(6); } },
  NZ: { dial: "64",  label: "\uD83C\uDDF3\uD83C\uDDFF +64",   placeholder: "211234567",       hint: "NZ: 9 digits",  digits: 9,  format: function (d) { return "+64 " + d.slice(0, 2) + " " + d.slice(2, 5) + " " + d.slice(5); } },
  CA: { dial: "1",   label: "\uD83C\uDDE8\uD83C\uDDE6 +1",   placeholder: "4165550123",      hint: "CA: 10 digits", digits: 10, format: function (d) { return "+1 " + d.slice(0, 3) + " " + d.slice(3, 6) + " " + d.slice(6); } },
  MX: { dial: "52",  label: "\uD83C\uDDF2\uD83C\uDDFD +52",   placeholder: "5512345678",      hint: "MX: 10 digits", digits: 10, format: function (d) { return "+52 " + d.slice(0, 3) + " " + d.slice(3, 6) + " " + d.slice(6); } },
  BR: { dial: "55",  label: "\uD83C\uDDE7\uD83C\uDDF7 +55",   placeholder: "11987654321",     hint: "BR: 11 digits", digits: 11, format: function (d) { return "+55 " + d.slice(0, 2) + " " + d.slice(2, 7) + " " + d.slice(7); } },
  AR: { dial: "54",  label: "\uD83C\uDDE6\uD83C\uDDF7 +54",   placeholder: "91123456789",     hint: "AR: 11 digits", digits: 11, format: function (d) { return "+54 " + d.slice(0, 3) + " " + d.slice(3, 7) + " " + d.slice(7); } },
  ZA: { dial: "27",  label: "\uD83C\uDDFF\uD83C\uDDE6 +27",   placeholder: "821234567",       hint: "ZA: 9 digits",  digits: 9,  format: function (d) { return "+27 " + d.slice(0, 2) + " " + d.slice(2, 5) + " " + d.slice(5); } }
};

var PHONE_COUNTRY_ORDER = Object.keys(PHONE_COUNTRIES).sort(function (a, b) {
  return PHONE_COUNTRIES[b].dial.length - PHONE_COUNTRIES[a].dial.length;
});

function getPhoneCountry(code) {
  return PHONE_COUNTRIES[code] || PHONE_COUNTRIES.US;
}

function phoneDigitsOnly(value) {
  return value.replace(/\D/g, "");
}

function populatePhoneCountrySelect(selectEl) {
  if (!selectEl) return;
  var current = selectEl.value;
  selectEl.innerHTML = "";
  Object.keys(PHONE_COUNTRIES).forEach(function (code) {
    var option = document.createElement("option");
    option.value = code;
    option.textContent = PHONE_COUNTRIES[code].label;
    selectEl.appendChild(option);
  });
  if (current && PHONE_COUNTRIES[current]) {
    selectEl.value = current;
  } else {
    selectEl.value = "US";
  }
}

function detectCountryFromPhone(stored) {
  if (!stored) return "US";
  var digits = phoneDigitsOnly(stored);

  for (var i = 0; i < PHONE_COUNTRY_ORDER.length; i++) {
    var code = PHONE_COUNTRY_ORDER[i];
    var dial = PHONE_COUNTRIES[code].dial;
    if (digits.indexOf(dial) === 0 && digits.length >= dial.length + 6) {
      return code;
    }
  }
  return "US";
}

function getLocalPhoneDigits(stored, countryCode) {
  var country = getPhoneCountry(countryCode);
  var digits = phoneDigitsOnly(stored);
  if (digits.indexOf(country.dial) === 0) {
    return digits.slice(country.dial.length);
  }
  return digits;
}

function normalizePhoneInput(countryCode, localValue) {
  var country = getPhoneCountry(countryCode);
  var digits = phoneDigitsOnly(localValue);
  if (digits.length !== country.digits) {
    return localValue.trim();
  }
  return country.format(digits);
}

function isValidPhoneInput(countryCode, localValue) {
  var country = getPhoneCountry(countryCode);
  return phoneDigitsOnly(localValue).length === country.digits;
}

function getPhoneValidationMessage(countryCode) {
  return "Enter a valid number (" + getPhoneCountry(countryCode).hint + ")";
}

function updatePhoneFieldUI(countrySelect, phoneInput, hintEl) {
  var country = getPhoneCountry(countrySelect.value);
  phoneInput.placeholder = country.placeholder;
  if (hintEl) {
    hintEl.textContent = country.hint;
  }
}

function initPhoneField(countrySelectId, phoneInputId, hintId) {
  var countrySelect = document.getElementById(countrySelectId);
  var phoneInput = document.getElementById(phoneInputId);
  var hintEl = hintId ? document.getElementById(hintId) : null;
  if (!countrySelect || !phoneInput) return;

  populatePhoneCountrySelect(countrySelect);

  countrySelect.addEventListener("change", function () {
    updatePhoneFieldUI(countrySelect, phoneInput, hintEl);
  });

  updatePhoneFieldUI(countrySelect, phoneInput, hintEl);
}

function setPhoneFieldValues(countrySelectId, phoneInputId, hintId, storedPhone) {
  var countrySelect = document.getElementById(countrySelectId);
  var phoneInput = document.getElementById(phoneInputId);
  var hintEl = hintId ? document.getElementById(hintId) : null;
  if (!countrySelect || !phoneInput) return;

  populatePhoneCountrySelect(countrySelect);
  var code = detectCountryFromPhone(storedPhone);
  countrySelect.value = code;
  phoneInput.value = getLocalPhoneDigits(storedPhone, code);
  updatePhoneFieldUI(countrySelect, phoneInput, hintEl);
}

function getPhoneFormValue(countrySelectId, phoneInputId) {
  var countrySelect = document.getElementById(countrySelectId);
  var phoneInput = document.getElementById(phoneInputId);
  return normalizePhoneInput(countrySelect.value, phoneInput.value.trim());
}

function validatePhoneField(countrySelectId, phoneInputId, errorEl) {
  var countrySelect = document.getElementById(countrySelectId);
  var phoneInput = document.getElementById(phoneInputId);
  var local = phoneInput.value.trim();

  if (local === "") {
    return { ok: false, message: "Phone number is required." };
  }
  if (!isValidPhoneInput(countrySelect.value, local)) {
    return { ok: false, message: getPhoneValidationMessage(countrySelect.value) };
  }
  return { ok: true };
}
