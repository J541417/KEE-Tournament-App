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
  lastName: document.getElementById("lastName"),
  message: document.getElementById("message"),
  matches: document.getElementById("matches")
};

document.addEventListener("DOMContentLoaded", loadActiveRound);
elements.lookupForm.addEventListener("submit", handleLookupSubmit);

async function loadActiveRound() {
  clearMessage();
  clearMatches();

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

  const lastName = elements.lastName.value.trim();

  if (!lastName) {
    showMessage("Please enter your last name.");
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
      body: JSON.stringify({ lastName })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to find player.");
    }

    if (data.status === "no_match") {
      showMessage("No player was found for that last name in the active round.");
      return;
    }

    if (data.status === "single_match") {
      goToScorecard(data.player.token);
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
    button.innerHTML = `
      ${escapeHtml(player.playerName)}
      <span class="match-subtitle">Team ${escapeHtml(String(player.teamNumber || ""))}</span>
    `;

    button.addEventListener("click", () => goToScorecard(player.token));

    elements.matches.appendChild(button);
  });

  elements.matches.classList.remove("hidden");
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
