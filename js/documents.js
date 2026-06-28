/* ============================================================
   documents.js — organization document library (API-first).
   ============================================================ */

var DOCUMENTS_LIST_API_URL = "api/documents/list.php";
var DOCUMENTS_UPLOAD_API_URL = "api/documents/upload.php";
var DOCUMENTS_UPDATE_API_URL = "api/documents/update.php";
var DOCUMENTS_DELETE_API_URL = "api/documents/delete.php";
var DOCUMENTS_DOWNLOAD_API_URL = "api/documents/download.php";

var pageDocumentList = [];
var documentCategoryOptions = {};
var editingDocumentId = null;
var documentSearchTimer = null;

var DOCUMENT_ACCESS_OPTIONS = [
  { value: "admin", label: "Admin", locked: true },
  { value: "trainer", label: "Trainer", locked: false },
  { value: "member", label: "Member", locked: false }
];

function parseDocumentApiResponse(response) {
  return response.text().then(function (text) {
    var data = {};

    try {
      data = text ? JSON.parse(text) : {};
    } catch (parseError) {
      return { ok: false, message: "Invalid server response." };
    }

    if (!response.ok || !data.success) {
      return { ok: false, message: data.message || "Request failed." };
    }

    return {
      ok: true,
      data: data.data || {},
      message: data.message || "Success"
    };
  });
}

function formatFileSize(bytes) {
  var size = Number(bytes) || 0;
  if (size < 1024) return size + " B";
  if (size < 1048576) return (size / 1024).toFixed(1) + " KB";
  return (size / 1048576).toFixed(1) + " MB";
}

function formatAccessRoles(roles) {
  if (!roles || !roles.length) return "Admin";
  return roles.map(function (role) {
    return role.charAt(0).toUpperCase() + role.slice(1);
  }).join(", ");
}

function buildDocumentListQuery() {
  var params = [];
  var search = document.getElementById("docSearch");
  var category = document.getElementById("docCategoryFilter");

  if (search && search.value.trim()) {
    params.push("search=" + encodeURIComponent(search.value.trim()));
  }
  if (category && category.value) {
    params.push("category=" + encodeURIComponent(category.value));
  }

  return params.length ? DOCUMENTS_LIST_API_URL + "?" + params.join("&") : DOCUMENTS_LIST_API_URL;
}

function loadDocumentsFromApi() {
  return fetch(buildDocumentListQuery(), {
    method: "GET",
    credentials: "same-origin"
  })
    .then(parseDocumentApiResponse)
    .then(function (result) {
      if (!result.ok) return result;
      return {
        ok: true,
        documents: result.data.documents || []
      };
    })
    .catch(function () {
      return { ok: false, message: "Network error." };
    });
}

function mergeDocumentCategories(documents) {
  (documents || []).forEach(function (doc) {
    if (doc.category) {
      documentCategoryOptions[doc.category] = true;
    }
  });
}

function loadAllDocumentCategories() {
  return fetch(DOCUMENTS_LIST_API_URL, {
    method: "GET",
    credentials: "same-origin"
  })
    .then(parseDocumentApiResponse)
    .then(function (result) {
      if (result.ok) {
        mergeDocumentCategories(result.data.documents || []);
      }
    })
    .catch(function () {
      return null;
    });
}

function refreshDocumentsPage() {
  return loadDocumentsFromApi().then(function (result) {
    if (!result.ok) {
      if (typeof showToast === "function") {
        showToast(result.message || "Could not load documents.", "error");
      }
      return;
    }

    pageDocumentList = result.documents;
    mergeDocumentCategories(pageDocumentList);
    updateDocumentCategoryFilter();
    renderDocumentsTable();
  });
}

function updateDocumentCategoryFilter() {
  var select = document.getElementById("docCategoryFilter");
  if (!select) return;

  var current = select.value;

  select.innerHTML = '<option value="">All categories</option>';
  Object.keys(documentCategoryOptions).sort().forEach(function (category) {
    var option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  });

  if (current && documentCategoryOptions[current]) {
    select.value = current;
  }
}

function renderDocumentsTable() {
  var tbody = document.getElementById("documentsBody");
  var actionsHead = document.getElementById("documentsActionsHead");
  if (!tbody) return;

  var isAdmin = getRole() === "admin";
  if (actionsHead) {
    actionsHead.textContent = isAdmin ? "Actions" : "Download";
  }

  tbody.innerHTML = "";

  if (!pageDocumentList.length) {
    var emptyRow = document.createElement("tr");
    emptyRow.innerHTML = '<td colspan="6" class="empty-state">No documents found.</td>';
    tbody.appendChild(emptyRow);
    return;
  }

  pageDocumentList.forEach(function (doc) {
    var row = document.createElement("tr");

    var titleCell = document.createElement("td");
    titleCell.innerHTML = "<strong>" + escapeHtml(doc.title) + "</strong>";
    if (doc.description) {
      titleCell.innerHTML += '<div class="subtitle" style="margin-top:4px;">' + escapeHtml(doc.description) + "</div>";
    }

    var categoryCell = document.createElement("td");
    categoryCell.textContent = doc.category || "General";

    var fileCell = document.createElement("td");
    fileCell.textContent = doc.original_filename || "—";

    var sizeCell = document.createElement("td");
    sizeCell.textContent = formatFileSize(doc.file_size);

    var accessCell = document.createElement("td");
    accessCell.textContent = formatAccessRoles(doc.access_roles);

    var actionsCell = document.createElement("td");
    actionsCell.style.whiteSpace = "nowrap";

    var downloadBtn = document.createElement("button");
    downloadBtn.type = "button";
    downloadBtn.className = "btn btn-ghost btn-sm";
    downloadBtn.textContent = "Download";
    downloadBtn.addEventListener("click", function () {
      downloadDocument(doc.id);
    });
    actionsCell.appendChild(downloadBtn);

    if (isAdmin) {
      var editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn btn-ghost btn-sm";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", function () {
        openDocumentModal(doc);
      });
      actionsCell.appendChild(editBtn);

      var deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "btn btn-ghost btn-sm";
      deleteBtn.textContent = "Archive";
      deleteBtn.addEventListener("click", function () {
        archiveDocument(doc);
      });
      actionsCell.appendChild(deleteBtn);
    }

    row.appendChild(titleCell);
    row.appendChild(categoryCell);
    row.appendChild(fileCell);
    row.appendChild(sizeCell);
    row.appendChild(accessCell);
    row.appendChild(actionsCell);
    tbody.appendChild(row);
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function downloadDocument(documentId) {
  window.location.href = DOCUMENTS_DOWNLOAD_API_URL + "?id=" + encodeURIComponent(documentId);
}

function archiveDocument(doc) {
  if (!window.confirm('Archive "' + doc.title + '"?')) return;

  fetch(DOCUMENTS_DELETE_API_URL, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: doc.id })
  })
    .then(parseDocumentApiResponse)
    .then(function (result) {
      if (!result.ok) {
        showToast(result.message || "Could not archive document.", "error");
        return;
      }
      showToast("Document archived.", "success");
      refreshDocumentsPage();
    })
    .catch(function () {
      showToast("Network error.", "error");
    });
}

function renderDocumentAccessCheckboxes(selectedRoles) {
  var container = document.getElementById("docAccessRoles");
  if (!container) return;

  var selected = {};
  (selectedRoles || []).forEach(function (role) {
    selected[role] = true;
  });
  selected.admin = true;

  container.innerHTML = "";
  DOCUMENT_ACCESS_OPTIONS.forEach(function (option) {
    var label = document.createElement("label");
    label.className = "checkbox-item";

    var input = document.createElement("input");
    input.type = "checkbox";
    input.value = option.value;
    input.checked = !!selected[option.value];
    input.disabled = option.locked;

    label.appendChild(input);
    label.appendChild(document.createTextNode(" " + option.label));
    container.appendChild(label);
  });
}

function getSelectedDocumentAccessRoles() {
  var container = document.getElementById("docAccessRoles");
  if (!container) return ["admin"];

  var roles = ["admin"];
  container.querySelectorAll('input[type="checkbox"]').forEach(function (input) {
    if (input.checked && roles.indexOf(input.value) === -1) {
      roles.push(input.value);
    }
  });
  return roles;
}

function openDocumentModal(doc) {
  editingDocumentId = doc ? doc.id : null;

  var modal = document.getElementById("documentModal");
  var titleEl = document.getElementById("documentModalTitle");
  var fileField = document.getElementById("docFileField");
  var submitBtn = document.getElementById("documentSubmitBtn");

  document.getElementById("docTitle").value = doc ? doc.title : "";
  document.getElementById("docCategory").value = doc ? doc.category : "General";
  document.getElementById("docDescription").value = doc ? (doc.description || "") : "";
  document.getElementById("docKeywords").value = doc ? (doc.keywords || "") : "";
  document.getElementById("docFile").value = "";

  renderDocumentAccessCheckboxes(doc ? doc.access_roles : ["admin", "trainer", "member"]);

  if (titleEl) {
    titleEl.textContent = doc ? "Edit document" : "Upload document";
  }
  if (fileField) {
    fileField.style.display = doc ? "none" : "block";
  }
  if (submitBtn) {
    submitBtn.textContent = doc ? "Save changes" : "Upload document";
  }

  clearDocumentFormErrors();
  modal.classList.add("open");
}

function closeDocumentModal() {
  var modal = document.getElementById("documentModal");
  if (modal) modal.classList.remove("open");
  editingDocumentId = null;
}

function clearDocumentFormErrors() {
  ["docTitleError", "docCategoryError", "docFileError"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.textContent = "";
  });
}

function validateDocumentForm() {
  clearDocumentFormErrors();
  var valid = true;

  if (!document.getElementById("docTitle").value.trim()) {
    document.getElementById("docTitleError").textContent = "Title is required.";
    valid = false;
  }

  if (!document.getElementById("docCategory").value.trim()) {
    document.getElementById("docCategoryError").textContent = "Category is required.";
    valid = false;
  }

  if (!editingDocumentId && !document.getElementById("docFile").files.length) {
    document.getElementById("docFileError").textContent = "File is required.";
    valid = false;
  }

  return valid;
}

function saveDocumentForm(event) {
  event.preventDefault();
  if (!validateDocumentForm()) return;

  if (editingDocumentId) {
    fetch(DOCUMENTS_UPDATE_API_URL, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingDocumentId,
        title: document.getElementById("docTitle").value.trim(),
        category: document.getElementById("docCategory").value.trim(),
        description: document.getElementById("docDescription").value.trim(),
        keywords: document.getElementById("docKeywords").value.trim(),
        access_roles: getSelectedDocumentAccessRoles()
      })
    })
      .then(parseDocumentApiResponse)
      .then(function (result) {
        if (!result.ok) {
          showToast(result.message || "Could not update document.", "error");
          return;
        }
        showToast("Document updated.", "success");
        closeDocumentModal();
        refreshDocumentsPage();
      })
      .catch(function () {
        showToast("Network error.", "error");
      });
    return;
  }

  var formData = new FormData();
  formData.append("title", document.getElementById("docTitle").value.trim());
  formData.append("category", document.getElementById("docCategory").value.trim());
  formData.append("description", document.getElementById("docDescription").value.trim());
  formData.append("keywords", document.getElementById("docKeywords").value.trim());
  formData.append("access_roles", JSON.stringify(getSelectedDocumentAccessRoles()));
  formData.append("file", document.getElementById("docFile").files[0]);

  fetch(DOCUMENTS_UPLOAD_API_URL, {
    method: "POST",
    credentials: "same-origin",
    body: formData
  })
    .then(parseDocumentApiResponse)
    .then(function (result) {
      if (!result.ok) {
        showToast(result.message || "Could not upload document.", "error");
        return;
      }
      showToast("Document uploaded.", "success");
      closeDocumentModal();
      refreshDocumentsPage();
    })
    .catch(function () {
      showToast("Network error.", "error");
    });
}

function initDocumentsPage() {
  var uploadBtn = document.getElementById("uploadDocumentBtn");
  if (uploadBtn && getRole() === "admin") {
    uploadBtn.style.display = "";
    uploadBtn.addEventListener("click", function () {
      openDocumentModal(null);
    });
  }

  var form = document.getElementById("documentForm");
  if (form) form.addEventListener("submit", saveDocumentForm);

  ["documentModalClose", "documentCancel"].forEach(function (id) {
    var btn = document.getElementById(id);
    if (btn) btn.addEventListener("click", closeDocumentModal);
  });

  var searchInput = document.getElementById("docSearch");
  if (searchInput) {
    searchInput.addEventListener("input", function () {
      clearTimeout(documentSearchTimer);
      documentSearchTimer = setTimeout(refreshDocumentsPage, 300);
    });
  }

  var categoryFilter = document.getElementById("docCategoryFilter");
  if (categoryFilter) {
    categoryFilter.addEventListener("change", refreshDocumentsPage);
  }

  var clearBtn = document.getElementById("docClearFilters");
  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      if (searchInput) searchInput.value = "";
      if (categoryFilter) categoryFilter.value = "";
      refreshDocumentsPage();
    });
  }

  loadAllDocumentCategories().finally(function () {
    refreshDocumentsPage();
  });
}
