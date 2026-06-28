/* ============================================================
   data.js — seed data and localStorage emergency fallback helpers.
   Primary application data is loaded and saved through PHP APIs
   and MySQL. These helpers remain for offline/API-failure fallback
   and for shared utilities such as generateId() and readList().
   ============================================================ */

// localStorage keys. One key per data type.
var MEMBERS_KEY = "shame_members";
var TRAINERS_KEY = "shame_trainers";
var SCHEDULES_KEY = "shame_schedules";
var MEETINGS_KEY = "shame_meetings";
var ENROLLMENTS_KEY = "shame_enrollments";

// Make a simple unique id (timestamp + random). Used for new records.
function generateId() {
  return "id-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
}

// ---------- SEED DATA ----------
// Realistic sample rows so no list is ever empty on first load.
var SEED_MEMBERS = [
  { id: "m1", name: "James Carter",  email: "james.carter@email.com",  phone: "+1 202 555 0143", type: "Premium", startDate: "2025-09-12", assignedTrainerEmail: "marcus.hale@shame.gym" },
  { id: "m2", name: "Sofia Romano",  email: "sofia.romano@email.com",  phone: "+1 202 555 0188", type: "VIP",     startDate: "2025-10-01", assignedTrainerEmail: "nadia.petrova@shame.gym" },
  { id: "m3", name: "Liam Novak",    email: "liam.novak@email.com",    phone: "+1 202 555 0117", type: "Basic",   startDate: "2026-01-05", assignedTrainerEmail: "" },
  { id: "m4", name: "Amara Okafor",  email: "amara.okafor@email.com",  phone: "+1 202 555 0162", type: "Premium", startDate: "2025-11-23", assignedTrainerEmail: "diego.santos@shame.gym" },
  { id: "m5", name: "Daniel Reyes",  email: "daniel.reyes@email.com",  phone: "+1 202 555 0109", type: "Basic",   startDate: "2026-02-14", assignedTrainerEmail: "" },
  { id: "m6", name: "Elena Fischer", email: "elena.fischer@email.com", phone: "+1 202 555 0175", type: "VIP",     startDate: "2026-03-02", assignedTrainerEmail: "priya.anand@shame.gym" },
  { id: "m7", name: "Member User",   email: "member@shame.gym",        phone: "+1 202 555 0100", type: "Premium", startDate: "2025-08-01", assignedTrainerEmail: "trainer@shame.gym" }
];

var SEED_TRAINERS = [
  { id: "t1", name: "Marcus Hale",   email: "marcus.hale@shame.gym",   phone: "+1 202 555 0211", specialization: "Strength", availability: "Full-time" },
  { id: "t2", name: "Nadia Petrova", email: "nadia.petrova@shame.gym", phone: "+1 202 555 0234", specialization: "Cardio",   availability: "Morning" },
  { id: "t3", name: "Diego Santos",  email: "diego.santos@shame.gym",  phone: "+1 202 555 0256", specialization: "CrossFit", availability: "Evening" },
  { id: "t4", name: "Priya Anand",   email: "priya.anand@shame.gym",   phone: "+1 202 555 0278", specialization: "Yoga",     availability: "Weekend" },
  { id: "t5", name: "Tyler Brooks",  email: "tyler.brooks@shame.gym",  phone: "+1 202 555 0290", specialization: "Boxing",   availability: "Full-time" }
];

var SEED_SCHEDULES = [
  { id: "s1", className: "Spinning Burn",  trainerName: "Nadia Petrova", date: "2026-06-15", time: "07:00", duration: 45, capacity: 20 },
  { id: "s2", className: "HIIT Inferno",   trainerName: "Diego Santos",  date: "2026-06-15", time: "18:30", duration: 30, capacity: 16 },
  { id: "s3", className: "Yoga Flow",      trainerName: "Priya Anand",   date: "2026-06-16", time: "09:00", duration: 60, capacity: 25 },
  { id: "s4", className: "Boxing Basics",  trainerName: "Tyler Brooks",  date: "2026-06-16", time: "19:00", duration: 50, capacity: 12 },
  { id: "s5", className: "Power Strength", trainerName: "Marcus Hale",   date: "2026-06-17", time: "17:00", duration: 60, capacity: 14 },
  { id: "s6", className: "Morning Cardio", trainerName: "Nadia Petrova", date: "2026-06-18", time: "06:30", duration: 40, capacity: 18 }
];

var SEED_MEETINGS = [
  {
    id: "mt1",
    title: "Weekly Staff Sync",
    date: "2026-06-20",
    time: "10:00",
    location: "Main office",
    attendees: ["trainer@shame.gym", "marcus.hale@shame.gym", "nadia.petrova@shame.gym"],
    notes: "Review class coverage and member feedback."
  },
  {
    id: "mt2",
    title: "Safety & Equipment Review",
    date: "2026-06-27",
    time: "09:30",
    location: "Gym floor",
    attendees: ["trainer@shame.gym", "diego.santos@shame.gym", "tyler.brooks@shame.gym"],
    notes: "Quarterly equipment check and incident reporting."
  }
];

var SEED_ENROLLMENTS = [];

// On first ever load, copy the seed data into localStorage.
// If a key already exists we leave the user's saved data alone.
function seedDataIfEmpty() {
  if (localStorage.getItem(MEMBERS_KEY) === null) {
    localStorage.setItem(MEMBERS_KEY, JSON.stringify(SEED_MEMBERS));
  }
  if (localStorage.getItem(TRAINERS_KEY) === null) {
    localStorage.setItem(TRAINERS_KEY, JSON.stringify(SEED_TRAINERS));
  }
  if (localStorage.getItem(SCHEDULES_KEY) === null) {
    localStorage.setItem(SCHEDULES_KEY, JSON.stringify(SEED_SCHEDULES));
  }
  if (localStorage.getItem(MEETINGS_KEY) === null) {
    localStorage.setItem(MEETINGS_KEY, JSON.stringify(SEED_MEETINGS));
  }
  if (localStorage.getItem(ENROLLMENTS_KEY) === null) {
    localStorage.setItem(ENROLLMENTS_KEY, JSON.stringify(SEED_ENROLLMENTS));
  }
  migrateSeedData();
}

function mergeListById(existing, seeds) {
  var byId = {};
  existing.forEach(function (item) { byId[item.id] = item; });
  var changed = false;

  seeds.forEach(function (seed) {
    if (!byId[seed.id]) {
      existing.push(seed);
      byId[seed.id] = seed;
      changed = true;
    }
  });

  return changed;
}

function migrateSeedData() {
  var members = getMembers();
  var membersChanged = mergeListById(members, SEED_MEMBERS);

  SEED_MEMBERS.forEach(function (seed) {
    for (var i = 0; i < members.length; i++) {
      if (members[i].id !== seed.id) continue;
      if (members[i].assignedTrainerEmail === undefined) {
        members[i].assignedTrainerEmail = seed.assignedTrainerEmail || "";
        membersChanged = true;
      }
      break;
    }
  });

  if (membersChanged) saveMembers(members);

  var trainers = getTrainers();
  if (mergeListById(trainers, SEED_TRAINERS)) {
    saveTrainers(trainers);
  }

  if (localStorage.getItem(MEETINGS_KEY) === null) {
    localStorage.setItem(MEETINGS_KEY, JSON.stringify(SEED_MEETINGS));
  }
  if (localStorage.getItem(ENROLLMENTS_KEY) === null) {
    localStorage.setItem(ENROLLMENTS_KEY, JSON.stringify(SEED_ENROLLMENTS));
  }
}

// ---------- GET / SAVE HELPERS ----------
// Read an array from localStorage by key (empty array if nothing stored).
function readList(key) {
  var raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : [];
}

// Members
function getMembers() { return readList(MEMBERS_KEY); }
function saveMembers(list) { localStorage.setItem(MEMBERS_KEY, JSON.stringify(list)); }

// Trainers
function getTrainers() { return readList(TRAINERS_KEY); }
function saveTrainers(list) { localStorage.setItem(TRAINERS_KEY, JSON.stringify(list)); }

// Schedules
function getSchedules() { return readList(SCHEDULES_KEY); }
function saveSchedules(list) { localStorage.setItem(SCHEDULES_KEY, JSON.stringify(list)); }

// Staff meetings
function getMeetings() { return readList(MEETINGS_KEY); }
function saveMeetings(list) { localStorage.setItem(MEETINGS_KEY, JSON.stringify(list)); }

// Class enrollments
function getEnrollments() { return readList(ENROLLMENTS_KEY); }
function saveEnrollments(list) { localStorage.setItem(ENROLLMENTS_KEY, JSON.stringify(list)); }

// Find a member record linked to the logged-in user (by linkedId or email).
function findMemberForUser(user) {
  if (!user) return null;
  var members = getMembers();
  var target = user.email ? user.email.trim().toLowerCase() : "";

  for (var i = 0; i < members.length; i++) {
    if (user.linkedId && members[i].id === user.linkedId) return members[i];
    if (target && members[i].email.trim().toLowerCase() === target) return members[i];
  }
  return null;
}

// Make sure the seed data exists the moment this file loads.
seedDataIfEmpty();
