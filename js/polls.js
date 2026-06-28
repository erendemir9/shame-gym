/* ============================================================
   polls.js — confidential organization polls (API-first).
   ============================================================ */

var POLLS_LIST_API_URL = "api/polls/list.php";
var POLLS_CREATE_API_URL = "api/polls/create.php";
var POLLS_UPDATE_API_URL = "api/polls/update.php";
var POLLS_DELETE_API_URL = "api/polls/delete.php";
var POLLS_VOTE_API_URL = "api/polls/vote.php";
var POLLS_RESULTS_API_URL = "api/polls/results.php";

var pagePollList = [];

function parsePollApiResponse(response) {
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

function getPollStatusLabel(status, isOpen) {
  if (status === "open" && isOpen) return "Open";
  if (status === "open") return "Scheduled";
  if (status === "closed") return "Closed";
  return "Draft";
}

function getPollStatusBadgeClass(status, isOpen) {
  if (status === "open" && isOpen) return "badge-blue";
  if (status === "closed") return "badge-silver";
  return "badge-purple";
}

function loadPollsFromApi() {
  return fetch(POLLS_LIST_API_URL, {
    method: "GET",
    credentials: "same-origin"
  })
    .then(parsePollApiResponse)
    .then(function (result) {
      if (!result.ok) return result;
      return {
        ok: true,
        polls: result.data.polls || []
      };
    })
    .catch(function () {
      return { ok: false, message: "Network error." };
    });
}

function loadPollResultsFromApi(pollId) {
  return fetch(POLLS_RESULTS_API_URL + "?id=" + encodeURIComponent(pollId), {
    method: "GET",
    credentials: "same-origin"
  })
    .then(parsePollApiResponse)
    .catch(function () {
      return { ok: false, message: "Network error." };
    });
}

function votePollWithApi(pollId, optionId) {
  return fetch(POLLS_VOTE_API_URL, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      poll_id: pollId,
      option_id: optionId
    })
  })
    .then(parsePollApiResponse)
    .catch(function () {
      return { ok: false, message: "Network error." };
    });
}

function refreshPollsPage() {
  return loadPollsFromApi().then(function (result) {
    if (!result.ok) {
      showToast(result.message || "Could not load polls.", "error");
      return;
    }

    pagePollList = result.polls;
    renderPollCards();
  });
}

function renderPollResultsSection(poll, results) {
  if (!results || !results.options) {
    return '<p class="subtitle">Results are not available yet.</p>';
  }

  var html = '<div class="poll-results">';
  results.options.forEach(function (option) {
    html += '<div class="poll-result-row">';
    html += '<div class="poll-result-head">';
    html += '<span>' + escapeHtml(option.option_text) + "</span>";
    html += '<span>' + option.vote_count + " (" + option.percentage + "%)</span>";
    html += "</div>";
    html += '<div class="wk-progress-bar"><div class="wk-progress-fill" style="width:' + option.percentage + '%;"></div></div>';
    html += "</div>";
  });
  html += '<p class="subtitle" style="margin-top:10px;">Total votes: ' + results.total_votes + "</p>";
  html += "</div>";
  return html;
}

function renderPollVoteForm(poll) {
  if (poll.user_voted || !poll.is_open) {
    return "";
  }

  var html = '<form class="poll-vote-form" data-poll-id="' + poll.id + '">';
  poll.options.forEach(function (option) {
    html += '<label class="poll-option-choice">';
    html += '<input type="radio" name="poll_option_' + poll.id + '" value="' + option.id + '" />';
    html += "<span>" + escapeHtml(option.option_text) + "</span>";
    html += "</label>";
  });
  html += '<button type="submit" class="btn btn-primary btn-sm" style="margin-top:12px;">Submit vote</button>';
  html += "</form>";
  return html;
}

function renderPollCards() {
  var container = document.getElementById("pollsContainer");
  if (!container) return;

  var isAdmin = getRole() === "admin";
  container.innerHTML = "";

  if (!pagePollList.length) {
    container.innerHTML = '<div class="card premium-panel"><p class="subtitle">No polls available right now.</p></div>';
    return;
  }

  pagePollList.forEach(function (poll) {
    var card = document.createElement("article");
    card.className = "card premium-panel poll-card";
    card.dataset.pollId = String(poll.id);

    var statusLabel = getPollStatusLabel(poll.status, poll.is_open);
    var statusClass = getPollStatusBadgeClass(poll.status, poll.is_open);

    var headerHtml = '<div class="poll-card-head">';
    headerHtml += "<div>";
    headerHtml += "<h2 class=\"section-heading\">" + escapeHtml(poll.question) + "</h2>";
    if (poll.description) {
      headerHtml += '<p class="subtitle section-lead">' + escapeHtml(poll.description) + "</p>";
    }
    headerHtml += "</div>";
    headerHtml += '<div class="poll-badges">';
    headerHtml += '<span class="badge ' + statusClass + '">' + statusLabel + "</span>";
    if (poll.user_voted) {
      headerHtml += '<span class="badge badge-purple">Already voted</span>';
    }
    headerHtml += "</div></div>";

    card.innerHTML = headerHtml;

    if (!poll.user_voted && poll.is_open) {
      card.insertAdjacentHTML("beforeend", renderPollVoteForm(poll));
    } else if (poll.user_voted && poll.is_open) {
      card.insertAdjacentHTML("beforeend", '<p class="subtitle">Your vote has been recorded.</p>');
    }

    var resultsHost = document.createElement("div");
    resultsHost.className = "poll-results-host";
    card.appendChild(resultsHost);

    if (poll.can_view_results) {
      loadPollResultsFromApi(poll.id).then(function (result) {
        if (result.ok) {
          resultsHost.innerHTML = renderPollResultsSection(poll, result.data.results);
        }
      });
    }

    if (isAdmin) {
      var actions = document.createElement("div");
      actions.className = "poll-admin-actions";
      actions.style.marginTop = "16px";
      actions.style.display = "flex";
      actions.style.gap = "8px";
      actions.style.flexWrap = "wrap";

      var resultsBtn = document.createElement("button");
      resultsBtn.type = "button";
      resultsBtn.className = "btn btn-ghost btn-sm";
      resultsBtn.textContent = "Refresh results";
      resultsBtn.addEventListener("click", function () {
        loadPollResultsFromApi(poll.id).then(function (result) {
          if (!result.ok) {
            showToast(result.message || "Could not load results.", "error");
            return;
          }
          resultsHost.innerHTML = renderPollResultsSection(poll, result.data.results);
        });
      });

      var closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "btn btn-ghost btn-sm";
      closeBtn.textContent = poll.status === "closed" ? "Closed" : "Close poll";
      closeBtn.disabled = poll.status === "closed";
      closeBtn.addEventListener("click", function () {
        closePoll(poll);
      });

      actions.appendChild(resultsBtn);
      actions.appendChild(closeBtn);
      card.appendChild(actions);
    }

    container.appendChild(card);
  });

  container.querySelectorAll(".poll-vote-form").forEach(function (form) {
    form.addEventListener("submit", handlePollVoteSubmit);
  });
}

function handlePollVoteSubmit(event) {
  event.preventDefault();

  var form = event.target;
  var pollId = parseInt(form.getAttribute("data-poll-id"), 10);
  var selected = form.querySelector('input[type="radio"]:checked');

  if (!selected) {
    showToast("Select an option before submitting.", "error");
    return;
  }

  var optionId = parseInt(selected.value, 10);

  votePollWithApi(pollId, optionId).then(function (result) {
    if (!result.ok) {
      showToast(result.message || "Could not submit vote.", "error");
      return;
    }

    showToast("Vote recorded. Thank you.", "success");
    refreshPollsPage();
  });
}

function closePoll(poll) {
  if (!window.confirm('Close poll "' + poll.question + '"?')) return;

  fetch(POLLS_DELETE_API_URL, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: poll.id })
  })
    .then(parsePollApiResponse)
    .then(function (result) {
      if (!result.ok) {
        showToast(result.message || "Could not close poll.", "error");
        return;
      }
      showToast("Poll closed.", "success");
      refreshPollsPage();
    })
    .catch(function () {
      showToast("Network error.", "error");
    });
}

function addPollOptionField(value) {
  var list = document.getElementById("pollOptionsList");
  if (!list) return;

  var row = document.createElement("div");
  row.className = "poll-option-field";
  row.style.display = "flex";
  row.style.gap = "8px";
  row.style.marginBottom = "8px";

  var input = document.createElement("input");
  input.type = "text";
  input.className = "poll-option-input";
  input.placeholder = "Option text";
  input.value = value || "";

  var removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn btn-ghost btn-sm";
  removeBtn.textContent = "Remove";
  removeBtn.addEventListener("click", function () {
    if (list.querySelectorAll(".poll-option-field").length <= 2) {
      showToast("A poll needs at least two options.", "info");
      return;
    }
    row.remove();
  });

  row.appendChild(input);
  row.appendChild(removeBtn);
  list.appendChild(row);
}

function resetPollForm() {
  document.getElementById("pollQuestion").value = "";
  document.getElementById("pollDescription").value = "";
  document.getElementById("pollOptionsList").innerHTML = "";
  addPollOptionField("");
  addPollOptionField("");
  document.getElementById("pollQuestionError").textContent = "";
  document.getElementById("pollOptionsError").textContent = "";
}

function openPollModal() {
  resetPollForm();
  document.getElementById("pollModal").classList.add("open");
}

function closePollModal() {
  document.getElementById("pollModal").classList.remove("open");
}

function collectPollOptionsFromForm() {
  var inputs = document.querySelectorAll("#pollOptionsList .poll-option-input");
  var options = [];

  inputs.forEach(function (input) {
    var value = input.value.trim();
    if (value) options.push(value);
  });

  return options;
}

function savePollForm(event) {
  event.preventDefault();

  var question = document.getElementById("pollQuestion").value.trim();
  var description = document.getElementById("pollDescription").value.trim();
  var options = collectPollOptionsFromForm();

  document.getElementById("pollQuestionError").textContent = "";
  document.getElementById("pollOptionsError").textContent = "";

  if (!question) {
    document.getElementById("pollQuestionError").textContent = "Question is required.";
    return;
  }

  if (options.length < 2) {
    document.getElementById("pollOptionsError").textContent = "At least two options are required.";
    return;
  }

  fetch(POLLS_CREATE_API_URL, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: question,
      question: question,
      description: description,
      options: options,
      status: "open"
    })
  })
    .then(parsePollApiResponse)
    .then(function (result) {
      if (!result.ok) {
        showToast(result.message || "Could not create poll.", "error");
        return;
      }
      showToast("Poll created.", "success");
      closePollModal();
      refreshPollsPage();
    })
    .catch(function () {
      showToast("Network error.", "error");
    });
}

function initPollsPage() {
  var createBtn = document.getElementById("createPollBtn");
  if (createBtn && getRole() === "admin") {
    createBtn.style.display = "";
    createBtn.addEventListener("click", openPollModal);
  }

  var form = document.getElementById("pollForm");
  if (form) form.addEventListener("submit", savePollForm);

  var addOptionBtn = document.getElementById("addPollOptionBtn");
  if (addOptionBtn) {
    addOptionBtn.addEventListener("click", function () {
      addPollOptionField("");
    });
  }

  ["pollModalClose", "pollCancel"].forEach(function (id) {
    var btn = document.getElementById(id);
    if (btn) btn.addEventListener("click", closePollModal);
  });

  refreshPollsPage();
}
