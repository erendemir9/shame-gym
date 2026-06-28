/* ============================================================
   enrollments.js — member class enrollment.
   Read data loads from api/enrollments/list.php with localStorage fallback.
   Enroll/unenroll use PHP APIs with localStorage emergency fallback.
   ============================================================ */

var ENROLLMENTS_API_URL = "api/enrollments/list.php";
var ENROLLMENTS_ENROLL_API_URL = "api/enrollments/enroll.php";
var ENROLLMENTS_UNENROLL_API_URL = "api/enrollments/unenroll.php";

// Enrollment read cache from API (null until first load finishes).
var pageEnrollmentList = null;

// ---------- API READ HELPERS ----------

function parseScheduleIdToApiClassId(scheduleId) {
  if (!scheduleId) return null;
  var match = String(scheduleId).match(/^s(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

function parseMemberIdToApiMemberId(memberId) {
  if (!memberId) return null;
  var match = String(memberId).match(/^m(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

function mapApiEnrollmentToFrontendEnrollment(apiEnrollment) {
  return {
    id: "e" + apiEnrollment.id,
    classId: "s" + apiEnrollment.class_id,
    memberId: "m" + apiEnrollment.member_id,
    memberName: apiEnrollment.member_name,
    memberEmail: apiEnrollment.member_email,
    enrolledAt: apiEnrollment.enrolled_at,
    status: apiEnrollment.status || "enrolled"
  };
}

function buildEnrollmentsApiUrl(queryParams) {
  var url = ENROLLMENTS_API_URL;
  var parts = [];

  if (queryParams && queryParams.class_id) {
    parts.push("class_id=" + encodeURIComponent(String(queryParams.class_id)));
  }
  if (queryParams && queryParams.member_id) {
    parts.push("member_id=" + encodeURIComponent(String(queryParams.member_id)));
  }

  if (parts.length > 0) {
    url += "?" + parts.join("&");
  }

  return url;
}

function loadEnrollmentsFromApi(queryParams) {
  return fetch(buildEnrollmentsApiUrl(queryParams), {
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
            message: data.message || "Could not load enrollments."
          };
        }

        var apiEnrollments = data.data && data.data.enrollments ? data.data.enrollments : [];
        var mappedEnrollments = apiEnrollments.map(mapApiEnrollmentToFrontendEnrollment);

        return {
          ok: true,
          enrollments: mappedEnrollments
        };
      });
    })
    .catch(function () {
      return {
        ok: false,
        message: "Network error."
      };
    });
}

function loadEnrollmentsWithFallback(queryParams) {
  return loadEnrollmentsFromApi(queryParams).then(function (result) {
    if (result.ok) {
      pageEnrollmentList = result.enrollments;
      return result;
    }

    console.warn("Enrollments API unavailable:", result.message);
    pageEnrollmentList = getEnrollments();

    if (typeof showToast === "function") {
      showToast("Could not load enrollments from server. Showing saved local data.", "info");
    }

    return result;
  });
}

function loadEnrollmentsForClassFromApi(classId) {
  var apiClassId = parseScheduleIdToApiClassId(classId);
  if (apiClassId === null) {
    return Promise.resolve({
      ok: false,
      message: "Invalid class id."
    });
  }

  return loadEnrollmentsWithFallback({ class_id: apiClassId });
}

function loadEnrollmentsForMemberFromApi(memberIdOrEmail) {
  var apiMemberId = null;

  if (typeof memberIdOrEmail === "number" || /^m\d+$/.test(String(memberIdOrEmail))) {
    apiMemberId = parseMemberIdToApiMemberId(memberIdOrEmail);
  } else if (typeof getSession === "function") {
    var session = getSession();
    if (session && session.userId) {
      apiMemberId = session.userId;
    }
    if (!apiMemberId && session && session.linkedId) {
      apiMemberId = parseMemberIdToApiMemberId(session.linkedId);
    }
  }

  if (apiMemberId === null) {
    return loadEnrollmentsWithFallback();
  }

  return loadEnrollmentsWithFallback({ member_id: apiMemberId });
}

function refreshEnrollmentsFromLocalStorage() {
  pageEnrollmentList = getEnrollments();
}

// ---------- API WRITE HELPERS ----------

function resolveMemberIdFromEmail(memberEmail) {
  var target = normalizeEnrollmentEmail(memberEmail);
  var session = typeof getSession === "function" ? getSession() : null;

  if (session && normalizeEnrollmentEmail(session.email) === target && session.linkedId) {
    return parseMemberIdToApiMemberId(session.linkedId);
  }

  var enrollments = getEnrollmentReadList();
  for (var e = 0; e < enrollments.length; e++) {
    if (normalizeEnrollmentEmail(enrollments[e].memberEmail) === target && enrollments[e].memberId) {
      return parseMemberIdToApiMemberId(enrollments[e].memberId);
    }
  }

  if (typeof pageMemberList !== "undefined" && pageMemberList !== null) {
    for (var i = 0; i < pageMemberList.length; i++) {
      if (normalizeEnrollmentEmail(pageMemberList[i].email) === target) {
        return parseMemberIdToApiMemberId(pageMemberList[i].id);
      }
    }
  }

  var members = getMembers();
  for (var j = 0; j < members.length; j++) {
    if (normalizeEnrollmentEmail(members[j].email) === target) {
      return parseMemberIdToApiMemberId(members[j].id);
    }
  }

  if (typeof findUserByEmail === "function") {
    var user = findUserByEmail(memberEmail);
    if (user && user.linkedId) {
      return parseMemberIdToApiMemberId(user.linkedId);
    }
  }

  return null;
}

function mapEnrollmentPayload(classId, memberId) {
  var payload = {
    class_id: classId
  };

  if (memberId !== null && memberId !== undefined) {
    payload.member_id = memberId;
  }

  return payload;
}

function callEnrollmentWriteApi(url, payload) {
  return fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  })
    .then(function (response) {
      return response.text().then(function (text) {
        var data = {};

        try {
          data = text ? JSON.parse(text) : {};
        } catch (parseError) {
          return {
            ok: false,
            message: "Invalid server response.",
            networkError: false
          };
        }

        if (!response.ok || !data.success) {
          return {
            ok: false,
            message: data.message || "Request failed.",
            networkError: false
          };
        }

        return {
          ok: true,
          message: data.message || "Success",
          data: data.data || {},
          networkError: false
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

function enrollWithApi(classId, memberId) {
  return callEnrollmentWriteApi(
    ENROLLMENTS_ENROLL_API_URL,
    mapEnrollmentPayload(classId, memberId)
  );
}

function unenrollWithApi(classId, memberId) {
  return callEnrollmentWriteApi(
    ENROLLMENTS_UNENROLL_API_URL,
    mapEnrollmentPayload(classId, memberId)
  );
}

function refreshEnrollmentDataAfterWrite() {
  var tasks = [loadEnrollmentsWithFallback()];

  if (typeof loadClassesWithFallback === "function") {
    tasks.push(loadClassesWithFallback());
  }

  return Promise.all(tasks).then(function () {
    if (typeof renderSchedules === "function") {
      renderSchedules();
    }
  });
}

function enrollInClassLocalStorage(classId, memberEmail) {
  if (isEnrolled(classId, memberEmail)) {
    return { ok: false, reason: "already_enrolled" };
  }

  var schedule = null;
  var schedules = typeof pageClassList !== "undefined" && pageClassList !== null
    ? pageClassList
    : getSchedules();

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
    enrolledAt: new Date().toISOString(),
    status: "enrolled"
  });
  saveEnrollments(list);
  refreshEnrollmentsFromLocalStorage();
  return { ok: true };
}

function unenrollFromClassLocalStorage(classId, memberEmail) {
  var target = normalizeEnrollmentEmail(memberEmail);
  var list = getEnrollments().filter(function (entry) {
    return !(entry.classId === classId && normalizeEnrollmentEmail(entry.memberEmail) === target);
  });
  saveEnrollments(list);
  refreshEnrollmentsFromLocalStorage();
  return { ok: true };
}

function enrollInClassWithApi(classId, memberEmail) {
  var isAdmin = typeof getRole === "function" && getRole() === "admin";
  var memberId = resolveMemberIdFromEmail(memberEmail);
  var payloadMemberId = isAdmin ? memberId : null;

  if (isAdmin && payloadMemberId === null) {
    return Promise.resolve({
      ok: false,
      message: "Could not resolve member id."
    });
  }

  return enrollWithApi(classId, payloadMemberId).then(function (result) {
    if (result.ok) {
      return refreshEnrollmentDataAfterWrite().then(function () {
        return result;
      });
    }

    if (result.networkError) {
      var localResult = enrollInClassLocalStorage(classId, memberEmail);
      if (localResult.ok) {
        if (typeof renderSchedules === "function") {
          renderSchedules();
        }
        return {
          ok: true,
          localOnly: true,
          message: "Server unavailable. Enrollment saved locally only."
        };
      }
      return {
        ok: false,
        message: localResult.reason === "full" ? "Class is full" : "Could not enroll."
      };
    }

    return result;
  });
}

function unenrollFromClassWithApi(classId, memberEmail) {
  var isAdmin = typeof getRole === "function" && getRole() === "admin";
  var memberId = resolveMemberIdFromEmail(memberEmail);
  var payloadMemberId = isAdmin ? memberId : null;

  if (isAdmin && payloadMemberId === null) {
    return Promise.resolve({
      ok: false,
      message: "Could not resolve member id."
    });
  }

  return unenrollWithApi(classId, payloadMemberId).then(function (result) {
    if (result.ok) {
      return refreshEnrollmentDataAfterWrite().then(function () {
        return result;
      });
    }

    if (result.networkError) {
      unenrollFromClassLocalStorage(classId, memberEmail);
      if (typeof renderSchedules === "function") {
        renderSchedules();
      }
      return {
        ok: true,
        localOnly: true,
        message: "Server unavailable. Change saved locally only."
      };
    }

    return result;
  });
}

function getEnrollmentReadList() {
  return pageEnrollmentList !== null ? pageEnrollmentList : getEnrollments();
}

function normalizeEnrollmentEmail(email) {
  return email ? email.trim().toLowerCase() : "";
}

function getEnrollmentsForClass(classId) {
  return getEnrollmentReadList().filter(function (entry) {
    return entry.classId === classId && entry.status !== "cancelled";
  });
}

function getEnrollmentCount(classId) {
  return getEnrollmentsForClass(classId).length;
}

function isEnrolled(classId, memberEmail) {
  var target = normalizeEnrollmentEmail(memberEmail);
  return getEnrollmentReadList().some(function (entry) {
    return entry.classId === classId &&
      normalizeEnrollmentEmail(entry.memberEmail) === target &&
      entry.status !== "cancelled";
  });
}

function getEnrollmentsForMember(memberEmail) {
  var target = normalizeEnrollmentEmail(memberEmail);
  return getEnrollmentReadList().filter(function (entry) {
    return normalizeEnrollmentEmail(entry.memberEmail) === target &&
      entry.status !== "cancelled";
  });
}

function getEnrolledClassesForMember(memberEmail) {
  var enrollmentIds = getEnrollmentsForMember(memberEmail).map(function (entry) {
    return entry.classId;
  });

  if (typeof pageClassList !== "undefined" && pageClassList !== null) {
    return pageClassList.filter(function (schedule) {
      return enrollmentIds.indexOf(schedule.id) !== -1;
    });
  }

  return getSchedules().filter(function (schedule) {
    return enrollmentIds.indexOf(schedule.id) !== -1;
  });
}

function enrollInClass(classId, memberEmail) {
  return enrollInClassWithApi(classId, memberEmail);
}

function unenrollFromClass(classId, memberEmail) {
  return unenrollFromClassWithApi(classId, memberEmail);
}

function removeEnrollmentsForClass(classId) {
  var list = getEnrollments().filter(function (entry) {
    return entry.classId !== classId;
  });
  saveEnrollments(list);
  refreshEnrollmentsFromLocalStorage();
}

function getMemberLabelForEmail(email) {
  var target = normalizeEnrollmentEmail(email);
  var members = getMembers();
  for (var i = 0; i < members.length; i++) {
    if (normalizeEnrollmentEmail(members[i].email) === target) {
      return members[i].name;
    }
  }
  if (typeof findUserByEmail === "function") {
    var user = findUserByEmail(email);
    if (user && user.name) return user.name;
  }
  return email;
}

function getEnrollmentRoster(classId) {
  return getEnrollmentsForClass(classId).map(function (entry) {
    return {
      email: entry.memberEmail,
      name: entry.memberName || getMemberLabelForEmail(entry.memberEmail),
      enrolledAt: entry.enrolledAt
    };
  }).sort(function (a, b) {
    return a.name.localeCompare(b.name);
  });
}
