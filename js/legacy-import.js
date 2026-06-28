/* ============================================================
   legacy-import.js — admin legacy member CSV import (API-first).
   ============================================================ */

var LEGACY_PREVIEW_API_URL = "api/import/preview.php";
var LEGACY_RUN_API_URL = "api/import/run.php";
var LEGACY_BATCHES_API_URL = "api/import/batches.php";
var LEGACY_ERRORS_API_URL = "api/import/errors.php";

function parseLegacyImportApiResponse(response) {
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

function getSelectedLegacyCsvFile() {
  var input = document.getElementById("legacyCsvFile");
  if (!input || !input.files || !input.files.length) {
    return null;
  }
  return input.files[0];
}

function validateLegacyCsvSelection() {
  var errorEl = document.getElementById("legacyCsvFileError");
  var file = getSelectedLegacyCsvFile();

  if (errorEl) errorEl.textContent = "";

  if (!file) {
    if (errorEl) errorEl.textContent = "Select a CSV file first.";
    return null;
  }

  if (!/\.csv$/i.test(file.name)) {
    if (errorEl) errorEl.textContent = "Only .csv files are allowed.";
    return null;
  }

  return file;
}

function buildLegacyImportFormData(file) {
  var formData = new FormData();
  formData.append("file", file);
  return formData;
}

function renderLegacyPreview(data) {
  var section = document.getElementById("legacyPreviewSection");
  if (section) section.style.display = "";

  document.getElementById("previewTotalRows").textContent = String(data.total_rows || 0);
  document.getElementById("previewValidRows").textContent = String(data.valid_rows || 0);
  document.getElementById("previewInvalidRows").textContent = String(data.invalid_rows || 0);
  document.getElementById("previewDuplicateRows").textContent = String(data.duplicate_rows || 0);

  var cleanBody = document.getElementById("legacyCleanPreviewBody");
  cleanBody.innerHTML = "";

  (data.cleaned_preview || []).forEach(function (row) {
    var tr = document.createElement("tr");
    tr.innerHTML =
      "<td>" + row.row_number + "</td>" +
      "<td>" + escapeHtml(row.full_name) + "</td>" +
      "<td>" + escapeHtml(row.email) + "</td>" +
      "<td>" + escapeHtml(row.phone || "—") + "</td>" +
      "<td>" + escapeHtml(row.membership_type) + "</td>" +
      "<td>" + escapeHtml(row.start_date || "—") + "</td>" +
      "<td>" + (row.assigned_trainer_id ? row.assigned_trainer_id : "—") + "</td>";
    cleanBody.appendChild(tr);
  });

  if (!(data.cleaned_preview || []).length) {
    cleanBody.innerHTML = '<tr><td colspan="7">No valid rows in preview.</td></tr>';
  }

  var errorBody = document.getElementById("legacyErrorPreviewBody");
  errorBody.innerHTML = "";

  (data.errors_preview || []).forEach(function (row) {
    var tr = document.createElement("tr");
    tr.innerHTML =
      "<td>" + row.row_number + "</td>" +
      "<td>" + escapeHtml(row.error_message) + "</td>" +
      "<td><code>" + escapeHtml(row.raw_data || "") + "</code></td>";
    errorBody.appendChild(tr);
  });

  if (!(data.errors_preview || []).length) {
    errorBody.innerHTML = '<tr><td colspan="3">No validation errors in preview.</td></tr>';
  }
}

function renderLegacyBatches(batches) {
  var body = document.getElementById("legacyBatchesBody");
  if (!body) return;

  body.innerHTML = "";

  if (!batches.length) {
    body.innerHTML = '<tr><td colspan="8">No import batches yet.</td></tr>';
    return;
  }

  batches.forEach(function (batch) {
    var tr = document.createElement("tr");
    tr.innerHTML =
      "<td>" + batch.id + "</td>" +
      "<td>" + escapeHtml(batch.original_filename) + "</td>" +
      "<td>" + batch.total_rows + "</td>" +
      "<td>" + batch.imported_rows + "</td>" +
      "<td>" + batch.rejected_rows + "</td>" +
      "<td><span class=\"badge badge-silver\">" + escapeHtml(batch.status) + "</span></td>" +
      "<td>" + escapeHtml(batch.created_at) + "</td>" +
      "<td><button type=\"button\" class=\"btn btn-ghost btn-sm legacy-view-errors-btn\" data-batch-id=\"" + batch.id + "\">View errors</button></td>";
    body.appendChild(tr);
  });

  body.querySelectorAll(".legacy-view-errors-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var batchId = btn.getAttribute("data-batch-id");
      loadLegacyErrors(batchId);
    });
  });
}

function renderLegacyErrors(errors, batchId) {
  var body = document.getElementById("legacyErrorsBody");
  var lead = document.getElementById("legacyErrorsLead");
  if (!body) return;

  if (lead) {
    lead.textContent = batchId
      ? "Rejected rows for batch #" + batchId + "."
      : "Recent rejected rows from imports.";
  }

  body.innerHTML = "";

  if (!errors.length) {
    body.innerHTML = '<tr><td colspan="5">No import errors logged.</td></tr>';
    return;
  }

  errors.forEach(function (row) {
    var tr = document.createElement("tr");
    tr.innerHTML =
      "<td>" + row.batch_id + "</td>" +
      "<td>" + row.row_number + "</td>" +
      "<td>" + escapeHtml(row.error_message) + "</td>" +
      "<td><code>" + escapeHtml(row.raw_data || "") + "</code></td>" +
      "<td>" + escapeHtml(row.created_at) + "</td>";
    body.appendChild(tr);
  });
}

function loadLegacyBatches() {
  return fetch(LEGACY_BATCHES_API_URL, {
    method: "GET",
    credentials: "same-origin"
  })
    .then(parseLegacyImportApiResponse)
    .then(function (result) {
      if (!result.ok) {
        showToast(result.message || "Could not load import batches.", "error");
        return;
      }
      renderLegacyBatches(result.data.batches || []);
    })
    .catch(function () {
      showToast("Network error.", "error");
    });
}

function loadLegacyErrors(batchId) {
  var url = LEGACY_ERRORS_API_URL;
  if (batchId) {
    url += "?batch_id=" + encodeURIComponent(batchId);
  }

  return fetch(url, {
    method: "GET",
    credentials: "same-origin"
  })
    .then(parseLegacyImportApiResponse)
    .then(function (result) {
      if (!result.ok) {
        showToast(result.message || "Could not load import errors.", "error");
        return;
      }
      renderLegacyErrors(result.data.errors || [], batchId || null);
    })
    .catch(function () {
      showToast("Network error.", "error");
    });
}

function setLegacyImportButtonsLoading(loading) {
  ["legacyPreviewBtn", "legacyRunBtn"].forEach(function (id) {
    var btn = document.getElementById(id);
    if (!btn) return;
    btn.disabled = loading;
    btn.classList.toggle("btn-loading", loading);
  });
}

function previewLegacyImport() {
  var file = validateLegacyCsvSelection();
  if (!file) return;

  setLegacyImportButtonsLoading(true);

  fetch(LEGACY_PREVIEW_API_URL, {
    method: "POST",
    credentials: "same-origin",
    body: buildLegacyImportFormData(file)
  })
    .then(parseLegacyImportApiResponse)
    .then(function (result) {
      setLegacyImportButtonsLoading(false);

      if (!result.ok) {
        showToast(result.message || "Preview failed.", "error");
        return;
      }

      renderLegacyPreview(result.data);
      showToast("Import preview ready.", "success");
    })
    .catch(function () {
      setLegacyImportButtonsLoading(false);
      showToast("Network error.", "error");
    });
}

function runLegacyImport() {
  var file = validateLegacyCsvSelection();
  if (!file) return;

  if (!window.confirm("Run import for \"" + file.name + "\"? Valid rows will be inserted into members. No login accounts will be created.")) {
    return;
  }

  setLegacyImportButtonsLoading(true);

  fetch(LEGACY_RUN_API_URL, {
    method: "POST",
    credentials: "same-origin",
    body: buildLegacyImportFormData(file)
  })
    .then(parseLegacyImportApiResponse)
    .then(function (result) {
      setLegacyImportButtonsLoading(false);

      if (!result.ok) {
        showToast(result.message || "Import failed.", "error");
        return;
      }

      var summary = result.data;
      showToast(
        "Import complete: " + summary.inserted_count + " inserted, " + summary.error_count + " errors.",
        "success"
      );

      loadLegacyBatches();
      loadLegacyErrors(null);
    })
    .catch(function () {
      setLegacyImportButtonsLoading(false);
      showToast("Network error.", "error");
    });
}

function initLegacyImportPage() {
  var previewBtn = document.getElementById("legacyPreviewBtn");
  var runBtn = document.getElementById("legacyRunBtn");

  if (previewBtn) previewBtn.addEventListener("click", previewLegacyImport);
  if (runBtn) runBtn.addEventListener("click", runLegacyImport);

  loadLegacyBatches();
  loadLegacyErrors(null);
}
