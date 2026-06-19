/* ============================================================
   enrollments.js — member class enrollment (localStorage).
   ============================================================ */

function normalizeEnrollmentEmail(email) {
  return email ? email.trim().toLowerCase() : "";
}

function getEnrollmentsForClass(classId) {
  return getEnrollments().filter(function (e) { return e.classId === classId; });
}

function getEnrollmentCount(classId) {
  return getEnrollmentsForClass(classId).length;
}

function isEnrolled(classId, memberEmail) {
  var target = normalizeEnrollmentEmail(memberEmail);
  return getEnrollments().some(function (e) {
    return e.classId === classId && normalizeEnrollmentEmail(e.memberEmail) === target;
  });
}

function getEnrollmentsForMember(memberEmail) {
  var target = normalizeEnrollmentEmail(memberEmail);
  return getEnrollments().filter(function (e) {
    return normalizeEnrollmentEmail(e.memberEmail) === target;
  });
}

function getEnrolledClassesForMember(memberEmail) {
  var enrollmentIds = getEnrollmentsForMember(memberEmail).map(function (e) { return e.classId; });
  return getSchedules().filter(function (s) { return enrollmentIds.indexOf(s.id) !== -1; });
}

function enrollInClass(classId, memberEmail) {
  if (isEnrolled(classId, memberEmail)) {
    return { ok: false, reason: "already_enrolled" };
  }

  var schedule = null;
  var schedules = getSchedules();
  for (var i = 0; i < schedules.length; i++) {
    if (schedules[i].id === classId) {
      schedule = schedules[i];
      break;
    }
  }
  if (!schedule) return { ok: false, reason: "not_found" };

  if (getEnrollmentCount(classId) >= schedule.capacity) {
    return { ok: false, reason: "full" };
  }

  var list = getEnrollments();
  list.push({
    id: generateId(),
    classId: classId,
    memberEmail: memberEmail.trim(),
    enrolledAt: new Date().toISOString()
  });
  saveEnrollments(list);
  return { ok: true };
}

function unenrollFromClass(classId, memberEmail) {
  var target = normalizeEnrollmentEmail(memberEmail);
  var list = getEnrollments().filter(function (e) {
    return !(e.classId === classId && normalizeEnrollmentEmail(e.memberEmail) === target);
  });
  saveEnrollments(list);
  return { ok: true };
}
