/* ============================================================
   whatsapp.js — WhatsApp export import and analysis (API-first).
   ============================================================ */

var WHATSAPP_LIST_API_URL = "api/whatsapp/list.php";
var WHATSAPP_IMPORT_API_URL = "api/whatsapp/import.php";
var WHATSAPP_SUMMARY_API_URL = "api/whatsapp/summary.php";
var WHATSAPP_MESSAGES_API_URL = "api/whatsapp/messages.php";
var WHATSAPP_DELETE_API_URL = "api/whatsapp/delete.php";

var selectedImportId = null;
var whatsappSearchTimer = null;

function parseWhatsAppApiResponse(response) {
  return response.text().then(function (text) {
    var data = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch (parseError) {
      return { ok: false, message: "Invalid server response." };
    }

    if (!response.ok || !data.success) {
      return {
        ok: false,
        status: response.status,
        message: data.message || "Request failed."
      };
    }

    return {
      ok: true,
      status: response.status,
      data: data.data || {},
      message: data.message || "Success"
    };
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatHourLabel(hour) {
  var h = Number(hour);
  if (isNaN(h)) return "—";
  return String(h).padStart(2, "0") + ":00";
}

function loadWhatsAppImportsFromApi() {
  return fetch(WHATSAPP_LIST_API_URL, {
    method: "GET",
    credentials: "same-origin"
  })
    .then(parseWhatsAppApiResponse)
    .then(function (result) {
      if (!result.ok) return result;
      return {
        ok: true,
        imports: result.data.imports || []
      };
    })
    .catch(function () {
      return { ok: false, message: "Network error." };
    });
}

function loadWhatsAppSummaryFromApi(importId) {
  return fetch(WHATSAPP_SUMMARY_API_URL + "?id=" + encodeURIComponent(importId), {
    method: "GET",
    credentials: "same-origin"
  })
    .then(parseWhatsAppApiResponse)
    .catch(function () {
      return { ok: false, message: "Network error." };
    });
}

function loadWhatsAppMessagesFromApi(importId) {
  var params = ["id=" + encodeURIComponent(importId)];
  var search = document.getElementById("waMessageSearch");
  var sender = document.getElementById("waSenderFilter");
  var dateFrom = document.getElementById("waDateFrom");
  var dateTo = document.getElementById("waDateTo");

  if (search && search.value.trim()) {
    params.push("search=" + encodeURIComponent(search.value.trim()));
  }
  if (sender && sender.value) {
    params.push("sender=" + encodeURIComponent(sender.value));
  }
  if (dateFrom && dateFrom.value) {
    params.push("date_from=" + encodeURIComponent(dateFrom.value));
  }
  if (dateTo && dateTo.value) {
    params.push("date_to=" + encodeURIComponent(dateTo.value));
  }

  return fetch(WHATSAPP_MESSAGES_API_URL + "?" + params.join("&"), {
    method: "GET",
    credentials: "same-origin"
  })
    .then(parseWhatsAppApiResponse)
    .catch(function () {
      return { ok: false, message: "Network error." };
    });
}

function importWhatsAppFile(formData) {
  return fetch(WHATSAPP_IMPORT_API_URL, {
    method: "POST",
    credentials: "same-origin",
    body: formData
  })
    .then(parseWhatsAppApiResponse)
    .catch(function () {
      return { ok: false, message: "Network error." };
    });
}

function renderImportsTable(imports) {
  var tbody = document.getElementById("whatsappImportsBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!imports.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">No imports yet.</td></tr>';
    return;
  }

  imports.forEach(function (item) {
    var row = document.createElement("tr");

    var titleCell = document.createElement("td");
    titleCell.textContent = item.title || item.original_filename;

    var dateCell = document.createElement("td");
    dateCell.textContent = item.imported_at || "—";

    var statusCell = document.createElement("td");
    var badge = document.createElement("span");
    badge.className = "badge " + (item.status === "completed" ? "badge-blue" : "badge-silver");
    badge.textContent = item.status;
    statusCell.appendChild(badge);

    var messagesCell = document.createElement("td");
    messagesCell.textContent = String(item.total_messages || 0);

    var participantsCell = document.createElement("td");
    participantsCell.textContent = String(item.unique_senders || 0);

    var actionsCell = document.createElement("td");
    actionsCell.style.whiteSpace = "nowrap";

    var viewBtn = document.createElement("button");
    viewBtn.type = "button";
    viewBtn.className = "btn btn-ghost btn-sm";
    viewBtn.textContent = "View";
    viewBtn.addEventListener("click", function () {
      selectImport(item.id);
    });

    var deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn btn-ghost btn-sm";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", function () {
      deleteWhatsAppImport(item);
    });

    actionsCell.appendChild(viewBtn);
    actionsCell.appendChild(deleteBtn);

    row.appendChild(titleCell);
    row.appendChild(dateCell);
    row.appendChild(statusCell);
    row.appendChild(messagesCell);
    row.appendChild(participantsCell);
    row.appendChild(actionsCell);
    tbody.appendChild(row);
  });
}

function renderSummaryCards(summary) {
  document.getElementById("waTotalMessages").textContent = String(summary.total_messages || 0);
  document.getElementById("waUniqueSenders").textContent = String(summary.unique_senders || 0);
  document.getElementById("waPeakHour").textContent = summary.peak_hour !== null && summary.peak_hour !== undefined
    ? formatHourLabel(summary.peak_hour)
    : "—";
  document.getElementById("waSpamCount").textContent = String(summary.spam_count || 0);
  document.getElementById("waPositiveCount").textContent = String(summary.positive_count || 0);
  document.getElementById("waNeutralCount").textContent = String(summary.neutral_count || 0);
  document.getElementById("waNegativeCount").textContent = String(summary.negative_count || 0);
  document.getElementById("waMediaCount").textContent = String(summary.media_message_count || 0);
}

function renderMetricBarRow(label, count, widthPercent, metaText) {
  var html = '<div class="metric-bar-row">';
  html += '<div class="metric-bar-head">';
  html += '<span class="metric-bar-label">' + escapeHtml(label) + "</span>";
  html += '<span class="metric-bar-count">' + count + "</span>";
  html += "</div>";
  if (metaText) {
    html += '<div class="metric-bar-meta">' + escapeHtml(metaText) + "</div>";
  }
  html += '<div class="wk-progress-bar"><div class="wk-progress-fill" style="width:' + widthPercent + '%;"></div></div>';
  html += "</div>";
  return html;
}

function renderParticipantsTable(summary) {
  var host = document.getElementById("waParticipantsTable");
  if (!host) return;

  var participants = summary.participants || {};
  var names = Object.keys(participants);
  if (!names.length) {
    host.innerHTML = '<p class="subtitle">No participant data available.</p>';
    return;
  }

  var maxCount = 0;
  names.forEach(function (name) {
    if (participants[name] > maxCount) maxCount = participants[name];
  });

  var html = "";
  names.sort(function (a, b) {
    return participants[b] - participants[a];
  }).forEach(function (name) {
    var count = participants[name];
    var width = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
    var meta = count === 1 ? "1 message" : count + " messages";
    html += renderMetricBarRow(name, count, width, meta);
  });

  host.innerHTML = html;
}

function renderHourlyActivity(summary) {
  var host = document.getElementById("waHourlyActivity");
  if (!host) return;

  var hourly = summary.hourly_activity || {};
  var hours = Object.keys(hourly);
  if (!hours.length) {
    host.innerHTML = '<p class="subtitle">No hourly activity data available.</p>';
    return;
  }

  var maxCount = 0;
  hours.forEach(function (hour) {
    if (hourly[hour] > maxCount) maxCount = hourly[hour];
  });

  var html = "";
  hours.sort(function (a, b) {
    return Number(a) - Number(b);
  }).forEach(function (hour) {
    var count = hourly[hour];
    var width = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
    var label = formatHourLabel(hour);
    var meta = count === 1 ? "1 message" : count + " messages";
    html += renderMetricBarRow(label, count, width, meta);
  });

  host.innerHTML = html;
}

function renderMessagesTable(messages) {
  var tbody = document.getElementById("whatsappMessagesBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!messages.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No messages match the current filters.</td></tr>';
    return;
  }

  messages.forEach(function (message) {
    var row = document.createElement("tr");

    var dateCell = document.createElement("td");
    dateCell.textContent = message.message_datetime || message.message_date;

    var senderCell = document.createElement("td");
    senderCell.textContent = message.sender_name;

    var textCell = document.createElement("td");
    textCell.textContent = message.message_text;

    var toneCell = document.createElement("td");
    toneCell.textContent = message.sentiment_label || "neutral";

    var spamCell = document.createElement("td");
    spamCell.textContent = message.is_spam ? (message.spam_reason || "Yes") : "No";

    row.appendChild(dateCell);
    row.appendChild(senderCell);
    row.appendChild(textCell);
    row.appendChild(toneCell);
    row.appendChild(spamCell);
    tbody.appendChild(row);
  });
}

function updateSenderFilterOptions(senders) {
  var select = document.getElementById("waSenderFilter");
  if (!select) return;

  var current = select.value;
  select.innerHTML = '<option value="">All participants</option>';

  (senders || []).forEach(function (sender) {
    var option = document.createElement("option");
    option.value = sender;
    option.textContent = sender;
    select.appendChild(option);
  });

  if (current) select.value = current;
}

function selectImport(importId) {
  selectedImportId = importId;
  document.getElementById("whatsappAnalysisSection").style.display = "";

  Promise.all([
    loadWhatsAppSummaryFromApi(importId),
    loadWhatsAppMessagesFromApi(importId)
  ]).then(function (results) {
    var summaryResult = results[0];
    var messagesResult = results[1];

    if (!summaryResult.ok) {
      showToast(summaryResult.message || "Could not load summary.", "error");
      return;
    }

    var summary = summaryResult.data.summary || {};
    renderSummaryCards(summary);
    renderParticipantsTable(summary);
    renderHourlyActivity(summary);

    if (messagesResult.ok) {
      renderMessagesTable(messagesResult.data.messages || []);
      updateSenderFilterOptions(messagesResult.data.senders || []);
    }
  });
}

function refreshImportsPage() {
  return loadWhatsAppImportsFromApi().then(function (result) {
    if (!result.ok) {
      showToast(result.message || "Could not load imports.", "error");
      return;
    }

    renderImportsTable(result.imports);

    if (selectedImportId) {
      var stillExists = result.imports.some(function (item) {
        return item.id === selectedImportId;
      });
      if (stillExists) {
        selectImport(selectedImportId);
      } else {
        selectedImportId = null;
        document.getElementById("whatsappAnalysisSection").style.display = "none";
      }
    } else if (result.imports.length) {
      selectImport(result.imports[0].id);
    }
  });
}

function handleImportSubmit(event) {
  event.preventDefault();

  var fileInput = document.getElementById("waFile");
  var fileError = document.getElementById("waFileError");
  fileError.textContent = "";

  if (!fileInput.files.length) {
    fileError.textContent = "Please choose a .txt export file.";
    return;
  }

  var formData = new FormData();
  formData.append("title", document.getElementById("waTitle").value.trim());
  formData.append("description", document.getElementById("waDescription").value.trim());
  formData.append("file", fileInput.files[0]);

  var importBtn = document.getElementById("waImportBtn");
  importBtn.disabled = true;
  importBtn.textContent = "Importing…";

  importWhatsAppFile(formData).then(function (result) {
    importBtn.disabled = false;
    importBtn.textContent = "Import and analyze";

    if (!result.ok) {
      showToast(result.message || "Import failed.", "error");
      return;
    }

    var skipped = result.data.skipped_line_count || 0;
    var parsed = result.data.parsed_message_count || 0;
    showToast("Imported " + parsed + " messages" + (skipped ? " (" + skipped + " lines skipped)." : "."), "success");

    document.getElementById("whatsappImportForm").reset();
    selectedImportId = result.data.id || (result.data.import && result.data.import.id);
    refreshImportsPage();
  });
}

function deleteWhatsAppImport(item) {
  var label = item.title || item.original_filename || "this import";
  if (!window.confirm('Delete "' + label + '" and all parsed messages?')) return;

  fetch(WHATSAPP_DELETE_API_URL, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: item.id })
  })
    .then(parseWhatsAppApiResponse)
    .then(function (result) {
      if (!result.ok) {
        showToast(result.message || "Could not delete import.", "error");
        return;
      }
      showToast("Import deleted.", "success");
      if (selectedImportId === item.id) {
        selectedImportId = null;
        document.getElementById("whatsappAnalysisSection").style.display = "none";
      }
      refreshImportsPage();
    })
    .catch(function () {
      showToast("Network error.", "error");
    });
}

function initWhatsAppPage() {
  var form = document.getElementById("whatsappImportForm");
  if (form) form.addEventListener("submit", handleImportSubmit);

  var searchInput = document.getElementById("waMessageSearch");
  if (searchInput) {
    searchInput.addEventListener("input", function () {
      clearTimeout(whatsappSearchTimer);
      whatsappSearchTimer = setTimeout(function () {
        if (selectedImportId) {
          loadWhatsAppMessagesFromApi(selectedImportId).then(function (result) {
            if (result.ok) renderMessagesTable(result.data.messages || []);
          });
        }
      }, 300);
    });
  }

  ["waSenderFilter", "waDateFrom", "waDateTo"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener("change", function () {
        if (selectedImportId) {
          loadWhatsAppMessagesFromApi(selectedImportId).then(function (result) {
            if (result.ok) renderMessagesTable(result.data.messages || []);
          });
        }
      });
    }
  });

  var clearBtn = document.getElementById("waClearFilters");
  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      if (searchInput) searchInput.value = "";
      document.getElementById("waSenderFilter").value = "";
      document.getElementById("waDateFrom").value = "";
      document.getElementById("waDateTo").value = "";
      if (selectedImportId) {
        loadWhatsAppMessagesFromApi(selectedImportId).then(function (result) {
          if (result.ok) renderMessagesTable(result.data.messages || []);
        });
      }
    });
  }

  refreshImportsPage();
}
