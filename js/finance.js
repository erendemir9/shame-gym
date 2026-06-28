/* ============================================================
   finance.js — admin finance ledger (API-first).
   ============================================================ */

var FINANCE_LIST_API_URL = "api/finance/list.php";
var FINANCE_SUMMARY_API_URL = "api/finance/summary.php";
var FINANCE_CREATE_API_URL = "api/finance/create.php";
var FINANCE_UPDATE_API_URL = "api/finance/update.php";
var FINANCE_DELETE_API_URL = "api/finance/delete.php";

var pageFinanceList = [];
var editingFinanceId = null;
var financeSearchTimer = null;

function parseFinanceApiResponse(response) {
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

function formatCurrency(amount) {
  var value = Number(amount) || 0;
  return "$" + value.toFixed(2);
}

function buildFinanceQuery(baseUrl) {
  var params = [];
  var search = document.getElementById("financeSearch");
  var type = document.getElementById("financeTypeFilter");
  var category = document.getElementById("financeCategoryFilter");
  var dateFrom = document.getElementById("financeDateFrom");
  var dateTo = document.getElementById("financeDateTo");

  if (search && search.value.trim()) {
    params.push("search=" + encodeURIComponent(search.value.trim()));
  }
  if (type && type.value) {
    params.push("type=" + encodeURIComponent(type.value));
  }
  if (category && category.value) {
    params.push("category=" + encodeURIComponent(category.value));
  }
  if (dateFrom && dateFrom.value) {
    params.push("date_from=" + encodeURIComponent(dateFrom.value));
  }
  if (dateTo && dateTo.value) {
    params.push("date_to=" + encodeURIComponent(dateTo.value));
  }

  return params.length ? baseUrl + "?" + params.join("&") : baseUrl;
}

function loadFinanceFromApi() {
  return fetch(buildFinanceQuery(FINANCE_LIST_API_URL), {
    method: "GET",
    credentials: "same-origin"
  })
    .then(parseFinanceApiResponse)
    .then(function (result) {
      if (!result.ok) return result;
      return {
        ok: true,
        transactions: result.data.transactions || []
      };
    })
    .catch(function () {
      return { ok: false, message: "Network error." };
    });
}

function loadFinanceSummaryFromApi() {
  return fetch(buildFinanceQuery(FINANCE_SUMMARY_API_URL), {
    method: "GET",
    credentials: "same-origin"
  })
    .then(parseFinanceApiResponse)
    .then(function (result) {
      if (!result.ok) return result;
      return {
        ok: true,
        summary: result.data.summary || {}
      };
    })
    .catch(function () {
      return { ok: false, message: "Network error." };
    });
}

function refreshFinancePage() {
  return Promise.all([loadFinanceFromApi(), loadFinanceSummaryFromApi()])
    .then(function (results) {
      var listResult = results[0];
      var summaryResult = results[1];

      if (!listResult.ok) {
        showToast(listResult.message || "Could not load transactions.", "error");
        return;
      }

      pageFinanceList = listResult.transactions;
      updateFinanceCategoryFilter();
      renderFinanceTable();

      if (summaryResult.ok) {
        renderFinanceSummary(summaryResult.summary);
      }
    });
}

function renderFinanceSummary(summary) {
  document.getElementById("financeIncome").textContent = formatCurrency(summary.total_income);
  document.getElementById("financeExpenses").textContent = formatCurrency(summary.total_expenses);
  document.getElementById("financeBalance").textContent = formatCurrency(summary.balance);
  document.getElementById("financeCount").textContent = String(summary.transaction_count || 0);
}

function updateFinanceCategoryFilter() {
  var select = document.getElementById("financeCategoryFilter");
  if (!select) return;

  var current = select.value;
  var categories = {};

  pageFinanceList.forEach(function (item) {
    if (item.category) categories[item.category] = true;
  });

  select.innerHTML = '<option value="">All categories</option>';
  Object.keys(categories).sort().forEach(function (category) {
    var option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  });

  if (current && categories[current]) {
    select.value = current;
  }
}

function renderFinanceTable() {
  var tbody = document.getElementById("financeBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!pageFinanceList.length) {
    var emptyRow = document.createElement("tr");
    emptyRow.innerHTML = '<td colspan="6" style="text-align:center; color:var(--text-muted);">No transactions found.</td>';
    tbody.appendChild(emptyRow);
    return;
  }

  pageFinanceList.forEach(function (item) {
    var row = document.createElement("tr");

    var dateCell = document.createElement("td");
    dateCell.textContent = item.transaction_date || item.date;

    var typeCell = document.createElement("td");
    var typeBadge = document.createElement("span");
    typeBadge.className = "badge " + (item.transaction_type === "income" ? "badge-blue" : "badge-silver");
    typeBadge.textContent = item.transaction_type === "income" ? "Income" : "Expense";
    typeCell.appendChild(typeBadge);

    var categoryCell = document.createElement("td");
    categoryCell.textContent = item.category;

    var amountCell = document.createElement("td");
    amountCell.textContent = formatCurrency(item.amount);
    amountCell.style.fontWeight = "600";

    var descCell = document.createElement("td");
    descCell.textContent = item.description || "—";

    var actionsCell = document.createElement("td");
    actionsCell.style.whiteSpace = "nowrap";

    var editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn btn-ghost btn-sm";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", function () {
      openFinanceModal(item);
    });

    var deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "btn btn-ghost btn-sm";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", function () {
      deleteFinanceTransaction(item);
    });

    actionsCell.appendChild(editBtn);
    actionsCell.appendChild(deleteBtn);

    row.appendChild(dateCell);
    row.appendChild(typeCell);
    row.appendChild(categoryCell);
    row.appendChild(amountCell);
    row.appendChild(descCell);
    row.appendChild(actionsCell);
    tbody.appendChild(row);
  });
}

function openFinanceModal(item) {
  editingFinanceId = item ? item.id : null;

  var modal = document.getElementById("financeModal");
  var titleEl = document.getElementById("financeModalTitle");

  document.getElementById("finDate").value = item ? (item.transaction_date || item.date) : new Date().toISOString().slice(0, 10);
  document.getElementById("finType").value = item ? item.transaction_type : "income";
  document.getElementById("finCategory").value = item ? item.category : "";
  document.getElementById("finAmount").value = item ? item.amount : "";
  document.getElementById("finDescription").value = item ? (item.description || "") : "";

  if (titleEl) {
    titleEl.textContent = item ? "Edit transaction" : "Add transaction";
  }

  clearFinanceFormErrors();
  modal.classList.add("open");
}

function closeFinanceModal() {
  var modal = document.getElementById("financeModal");
  if (modal) modal.classList.remove("open");
  editingFinanceId = null;
}

function clearFinanceFormErrors() {
  ["finDateError", "finCategoryError", "finAmountError"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.textContent = "";
  });
}

function validateFinanceForm() {
  clearFinanceFormErrors();
  var valid = true;

  if (!document.getElementById("finDate").value) {
    document.getElementById("finDateError").textContent = "Date is required.";
    valid = false;
  }

  if (!document.getElementById("finCategory").value.trim()) {
    document.getElementById("finCategoryError").textContent = "Category is required.";
    valid = false;
  }

  var amount = parseFloat(document.getElementById("finAmount").value);
  if (!amount || amount <= 0) {
    document.getElementById("finAmountError").textContent = "Enter a valid amount.";
    valid = false;
  }

  return valid;
}

function saveFinanceForm(event) {
  event.preventDefault();
  if (!validateFinanceForm()) return;

  var payload = {
    transaction_date: document.getElementById("finDate").value,
    type: document.getElementById("finType").value,
    category: document.getElementById("finCategory").value.trim(),
    amount: parseFloat(document.getElementById("finAmount").value),
    description: document.getElementById("finDescription").value.trim()
  };

  var url = editingFinanceId ? FINANCE_UPDATE_API_URL : FINANCE_CREATE_API_URL;
  if (editingFinanceId) {
    payload.id = editingFinanceId;
  }

  fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
    .then(parseFinanceApiResponse)
    .then(function (result) {
      if (!result.ok) {
        showToast(result.message || "Could not save transaction.", "error");
        return;
      }
      showToast(editingFinanceId ? "Transaction updated." : "Transaction created.", "success");
      closeFinanceModal();
      refreshFinancePage();
    })
    .catch(function () {
      showToast("Network error.", "error");
    });
}

function deleteFinanceTransaction(item) {
  if (!window.confirm("Delete this transaction?")) return;

  fetch(FINANCE_DELETE_API_URL, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: item.id })
  })
    .then(parseFinanceApiResponse)
    .then(function (result) {
      if (!result.ok) {
        showToast(result.message || "Could not delete transaction.", "error");
        return;
      }
      showToast("Transaction deleted.", "success");
      refreshFinancePage();
    })
    .catch(function () {
      showToast("Network error.", "error");
    });
}

function initFinancePage() {
  var addBtn = document.getElementById("addFinanceBtn");
  if (addBtn) {
    addBtn.addEventListener("click", function () {
      openFinanceModal(null);
    });
  }

  var form = document.getElementById("financeForm");
  if (form) form.addEventListener("submit", saveFinanceForm);

  ["financeModalClose", "financeCancel"].forEach(function (id) {
    var btn = document.getElementById(id);
    if (btn) btn.addEventListener("click", closeFinanceModal);
  });

  var searchInput = document.getElementById("financeSearch");
  if (searchInput) {
    searchInput.addEventListener("input", function () {
      clearTimeout(financeSearchTimer);
      financeSearchTimer = setTimeout(refreshFinancePage, 300);
    });
  }

  ["financeTypeFilter", "financeCategoryFilter", "financeDateFrom", "financeDateTo"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener("change", refreshFinancePage);
  });

  var clearBtn = document.getElementById("financeClearFilters");
  if (clearBtn) {
    clearBtn.addEventListener("click", function () {
      if (searchInput) searchInput.value = "";
      document.getElementById("financeTypeFilter").value = "";
      document.getElementById("financeCategoryFilter").value = "";
      document.getElementById("financeDateFrom").value = "";
      document.getElementById("financeDateTo").value = "";
      refreshFinancePage();
    });
  }

  refreshFinancePage();
}
