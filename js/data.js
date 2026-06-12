/* ============================================================
   data.js — sample/seed data + localStorage helpers (no backend).
   Every page reads and writes data through the get/save helpers below,
   so the same pattern is reused everywhere:
     var list = getMembers();   // read array
     list.push(newItem);        // change it
     saveMembers(list);         // persist + survives refresh
   ============================================================ */

// localStorage keys. One key per data type.
var MEMBERS_KEY = "shame_members";
var TRAINERS_KEY = "shame_trainers";
var SCHEDULES_KEY = "shame_schedules";

// Make a simple unique id (timestamp + random). Used for new records.
function generateId() {
  return "id-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
}

// ---------- SEED DATA ----------
// Realistic sample rows so no list is ever empty on first load.
var SEED_MEMBERS = [
  { id: "m1", name: "James Carter",  email: "james.carter@email.com",  phone: "+1 202 555 0143", type: "Premium", startDate: "2025-09-12" },
  { id: "m2", name: "Sofia Romano",  email: "sofia.romano@email.com",  phone: "+1 202 555 0188", type: "VIP",     startDate: "2025-10-01" },
  { id: "m3", name: "Liam Novak",    email: "liam.novak@email.com",    phone: "+1 202 555 0117", type: "Basic",   startDate: "2026-01-05" },
  { id: "m4", name: "Amara Okafor",  email: "amara.okafor@email.com",  phone: "+1 202 555 0162", type: "Premium", startDate: "2025-11-23" },
  { id: "m5", name: "Daniel Reyes",  email: "daniel.reyes@email.com",  phone: "+1 202 555 0109", type: "Basic",   startDate: "2026-02-14" },
  { id: "m6", name: "Elena Fischer", email: "elena.fischer@email.com", phone: "+1 202 555 0175", type: "VIP",     startDate: "2026-03-02" }
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

// Make sure the seed data exists the moment this file loads.
seedDataIfEmpty();
