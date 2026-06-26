const state = {
  activeRound: null
};

const elements = {
  leagueName: document.getElementById("leagueName"),
  roundStatusBadge: document.getElementById("roundStatusBadge"),
  roundLoading: document.getElementById("roundLoading"),
  roundDetails: document.getElementById("roundDetails"),
  noActiveRound: document.getElementById("noActiveRound"),
  roundDate: document.getElementById("roundDate"),
  courseName: document.getElementById("courseName"),
  scoringMode: document.getElementById("scoringMode"),
  lookupForm: document.getElementById("lookupForm"),
  playerSearch: document.getElementById("playerSearch"),
  message: document.getElementById("message"),
  matches: document.getElementById("matches"),
  adminOptions: document.getElementById("adminOptions")
};

document.addEventListener("DOMContentLoaded", loadActiveRound);
elements.lookupForm.addEventListener("submit", handleLookupSubmit);

async function loadActiveRound() {
  clearMessage();
  clearMatches();
  clearAdminOptions();

  try {
    const response = await fetch("/api/active-round");

    if (!response.ok) {
      throw new Error("Unable to load active round.");
    }

    const data = await response.json();

    elements.roundLoading.classList.add("hidden");

    if (!data.active) {
      elements.roundStatusBadge.textContent = "No Active Round";
      elements.noActiveRound.classList.remove("hidden");
      elements.lookupForm.classList.remove("hidden");
      return;
    }

    state.activeRound = data;

    elements.roundStatusBadge.textContent = "Active";
    elements.roundDetails.classList.remove("hidden");
    elements.lookupForm.classList.remove("hidden");

    elements.roundDate.textContent = formatDisplayDate(data.roundDate);
    elements.courseName.textContent = data.courseName || "Not selected";
    elements.scoringMode.textContent = formatScoringMode(data.scoringMode);
  } catch (error) {
    elements.roundLoading.classList.add("hidden");
    elements.roundStatusBadge.textContent = "Error";
    showMessage(error.message || "Something went wrong loading the active round.");
  }
}

async function handleLookupSubmit(event) {
  event.preventDefault();

  clearMessage();
  clearMatches();
  clearAdminOptions();

  const search = elements.playerSearch.value.trim();

  if (!search) {
    // ⭐ UPDATED TEXT: Now prompts for first and/or last name
    showMessage("Please enter your first and/or last name.");
    return;
  }

  const submitButton = elements.lookupForm.querySelector("button");
  submitButton.disabled = true;
  submitButton.textContent = "Searching...";

  try {
    const response = await fetch("/api/find-player", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ search })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to find player.");
    }

    if (data.status === "no_match") {
      showMessage("No player was found for that name.");
      return;
    }

    if (data.status === "single_match") {
      handleResolvedPlayer(data.player);
      return;
    }

    if (data.status === "multiple_matches") {
      renderMatches(data.players);
      return;
    }

    showMessage("Unexpected response. Please try again.");
  } catch (error) {
    showMessage(error.message || "Something went wrong.");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Find My Scorecard";
  }
}

function handleResolvedPlayer(player) {
  if (player.isAdmin) {
    renderAdminOptions(player);
    return;
  }

  if (player.token) {
    goToScorecard(player.token);
    return;
  }

  showMessage("You were found, but you are not associated with the active round.");
}

function renderMatches(players) {
  elements.matches.innerHTML = "";

  const title = document.createElement("div");
  title.className = "muted";
  title.textContent = "More than one player matched. Please choose your name.";
  elements.matches.appendChild(title);

  players.forEach((player) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "match-button";

    const subtitleParts = [];

    if (player.teamNumber) {
      subtitleParts.push(`Team ${player.teamNumber}`);
    }

    if (player.isAdmin) {
      subtitleParts.push("Admin");
    }

    if (!player.token) {
      subtitleParts.push("No active scorecard");
    }

    button.innerHTML = `
      ${escapeHtml(player.playerName)}
      <span class="match-subtitle">${escapeHtml(subtitleParts.join(" | "))}</span>
    `;

    button.addEventListener("click", () => handleResolvedPlayer(player));

    elements.matches.appendChild(button);
  });

  elements.matches.classList.remove("hidden");
}

function renderAdminOptions(player) {
  elements.adminOptions.innerHTML = "";

  const title = document.createElement("div");
  title.className = "muted";
  title.textContent = `Welcome, ${player.playerName}. Choose where you want to go.`;
  elements.adminOptions.appendChild(title);

  const scorecardButton = document.createElement("button");
  scorecardButton.type = "button";
  scorecardButton.textContent = "Go to Scorecard";

  if (player.token) {
    scorecardButton.addEventListener("click", () => goToScorecard(player.token));
  } else {
    scorecardButton.disabled = true;
    scorecardButton.textContent = "No Active Scorecard";
  }

  const adminButton = document.createElement("button");
  adminButton.type = "button";
  adminButton.className = "secondary-button";
  adminButton.textContent = "Go to Admin Panel";
  adminButton.addEventListener("click", () => {
    window.location.href = "/admin.html";
  });

  elements.adminOptions.appendChild(scorecardButton);
  elements.adminOptions.appendChild(adminButton);
  elements.adminOptions.classList.remove("hidden");
}

function goToScorecard(token) {
  window.location.href = `/scorecard.html?token=${encodeURIComponent(token)}`;
}

function showMessage(text) {
  elements.message.textContent = text;
  elements.message.classList.remove("hidden");
}

function clearMessage() {
  elements.message.textContent = "";
  elements.message.classList.add("hidden");
}

function clearMatches() {
  elements.matches.innerHTML = "";
  elements.matches.classList.add("hidden");
}

function clearAdminOptions() {
  elements.adminOptions.innerHTML = "";
  elements.adminOptions.classList.add("hidden");
}

function formatScoringMode(value) {
  if (value === "team") return "Team scoring";
  if (value === "individual") return "Individual scoring";

  return value || "-";
}

function formatDisplayDate(value) {
  if (!value) return "-";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
