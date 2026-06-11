const scorecardState = {
  token: "",
  scorecard: null,
  visibleStartHole: 1,
  showFullCard: false,
  entryTarget: null
};

const elements = {
  scorecardBadge: document.getElementById("scorecardBadge"),
  courseName: document.getElementById("courseName"),
  scorecardAdminButton: document.getElementById("scorecardAdminButton"),
  prevHoleWindowButton: document.getElementById("prevHoleWindowButton"),
  nextHoleWindowButton: document.getElementById("nextHoleWindowButton"),
  toggleFullCardButton: document.getElementById("toggleFullCardButton"),
  holeWindowLabel: document.getElementById("holeWindowLabel"),
  scorecardTableWrapper: document.getElementById("scorecardTableWrapper"),
  scorecardView: document.getElementById("scorecardView"),
  scoreEntryView: document.getElementById("scoreEntryView"),
  entryTypeLabel: document.getElementById("entryTypeLabel"),
  entryMainTitle: document.getElementById("entryMainTitle"),
  entryParticipantName: document.getElementById("entryParticipantName"),
  entryParBadge: document.getElementById("entryParBadge"),
  entryScoreInput: document.getElementById("entryScoreInput"),
  prevEntryHoleButton: document.getElementById("prevEntryHoleButton"),
  saveEntryScoreButton: document.getElementById("saveEntryScoreButton"),
  nextEntryHoleButton: document.getElementById("nextEntryHoleButton"),
  returnToScorecardButton: document.getElementById("returnToScorecardButton"),
  message: document.getElementById("message")
};

// FIX: Force the script to run even if the browser loaded too fast
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadScorecard);
} else {
  loadScorecard();
}

// FIX: Added optional chaining (?.) to prevent crashing if HTML elements are missing
elements.prevHoleWindowButton?.addEventListener("click", () => moveHoleWindow(-5));
elements.nextHoleWindowButton?.addEventListener("click", () => moveHoleWindow(5));
elements.toggleFullCardButton?.addEventListener("click", toggleFullCard);

// CORRECTED PATH: Removed the leading slash so it can find the admin file
elements.scorecardAdminButton?.addEventListener("click", () => {
  window.location.href = "admin.html";
});

elements.prevEntryHoleButton?.addEventListener("click", () => moveEntryHole(-1));
elements.nextEntryHoleButton?.addEventListener("click", () => moveEntryHole(1));
elements.saveEntryScoreButton?.addEventListener("click", saveEntryScore);
elements.returnToScorecardButton?.addEventListener("click", showScorecardView);

async function loadScorecard() {
  clearMessage();

  const params = new URLSearchParams(window.location.search);
  scorecardState.token = params.get("token") || "";

  // DEBUG MESSAGE ADDED
  if (!scorecardState.token) {
    if (elements.scorecardBadge) elements.scorecardBadge.textContent = "Error";
    showMessage("FRONTEND ERROR: No scorecard token was provided in the URL.");
    return;
  }

  try {
    const response = await fetch(`/api/get-scorecard?token=${encodeURIComponent(scorecardState.token)}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to load scorecard.");
    }

    scorecardState.scorecard = data;

    renderScorecardHeader();
    renderScorecardTable();

    if (elements.scorecardBadge) elements.scorecardBadge.textContent = "Active";
  } catch (error) {
    if (elements.scorecardBadge) elements.scorecardBadge.textContent = "Error";
    // DEBUG MESSAGE ADDED
    showMessage(`BACKEND ERROR: ${error.message || "Unable to load scorecard."}`);
  }
}

function renderScorecardHeader() {
  const scorecard = scorecardState.scorecard;

  if (elements.courseName) {
    elements.courseName.textContent = scorecard.courseName || "Scorecard";
  }

  if (elements.scorecardAdminButton) {
    if (scorecard.loggedInIsAdmin) {
      elements.scorecardAdminButton.classList.remove("hidden");
    } else {
      elements.scorecardAdminButton.classList.add("hidden");
    }
  }
}

function renderScorecardTable() {
  const scorecard = scorecardState.scorecard;
  const holes = getVisibleHoles();

  const firstHole = holes[0]?.holeNumber || 1;
  const lastHole = holes[holes.length - 1]?.holeNumber || 18;

  if (elements.holeWindowLabel) {
    elements.holeWindowLabel.textContent = scorecardState.showFullCard
      ? "Entire Card"
      : `Holes ${firstHole}-${lastHole}`;
  }

  if (elements.toggleFullCardButton) {
    elements.toggleFullCardButton.textContent = scorecardState.showFullCard
      ? "Show Compact View"
      : "Show Entire Card";
  }

  if (elements.prevHoleWindowButton) {
    elements.prevHoleWindowButton.disabled = scorecardState.showFullCard || scorecardState.visibleStartHole <= 1;
  }
  if (elements.nextHoleWindowButton) {
    elements.nextHoleWindowButton.disabled = scorecardState.showFullCard || scorecardState.visibleStartHole >= 14;
  }

  const table = document.createElement("table");
  table.className = "scorecard-table clean-scorecard-table";

  table.appendChild(buildHeaderRow(holes));
  table.appendChild(buildParRow(holes));

  if (scorecard.scoringMode === "team") {
    scorecard.teams.forEach((team) => {
      table.appendChild(buildTeamScoreRow(team, holes));
    });
  } else {
    scorecard.teams.forEach((team) => {
      team.players.forEach((player) => {
        table.appendChild(buildIndividualScoreRow(team, player, holes));
      });
    });
  }

  if (elements.scorecardTableWrapper) {
    elements.scorecardTableWrapper.innerHTML = "";
    elements.scorecardTableWrapper.appendChild(table);
  }
}

function buildHeaderRow(holes) {
  const row = document.createElement("tr");

  const nameCell = document.createElement("th");
  nameCell.textContent = scorecardState.scorecard.scoringMode === "team" ? "Team" : "Player";
  row.appendChild(nameCell);

  holes.forEach((hole) => {
    const cell = document.createElement("th");
    cell.textContent = hole.holeNumber;
    row.appendChild(cell);
  });

  const totalCell = document.createElement("th");
  totalCell.textContent = "+/-";
  row.appendChild(totalCell);

  const actionCell = document.createElement("th");
  actionCell.textContent = "Enter";
  row.appendChild(actionCell);

  return row;
}

function buildParRow(holes) {
  const row = document.createElement("tr");
  row.className = "par-row";

  const labelCell = document.createElement("td");
  labelCell.textContent = "Par";
  row.appendChild(labelCell);

  holes.forEach((hole) => {
    const cell = document.createElement("td");
    cell.textContent = hole.par || "-";
    row.appendChild(cell);
  });

  const totalCell = document.createElement("td");
  totalCell.textContent = "";
  row.appendChild(totalCell);

  const actionCell = document.createElement("td");
  actionCell.textContent = "";
  row.appendChild(actionCell);

  return row;
}

function buildTeamScoreRow(team, holes) {
  const row = document.createElement("tr");

  const nameCell = document.createElement("td");
  nameCell.innerHTML = `
    <strong>Team ${escapeHtml(team.teamNumber)}</strong>
    <span class="scorecard-subtext">${escapeHtml(team.players.map((player) => player.playerName).join(", "))}</span>
  `;
  row.appendChild(nameCell);

  holes.forEach((hole) => {
    const score = getTeamScore(team.teamId, hole.holeNumber);
    const cell = document.createElement("td");
    cell.textContent = score || "-";
    row.appendChild(cell);
  });

  const plusMinusCell = document.createElement("td");
  plusMinusCell.textContent = formatPlusMinus(calculateTeamPlusMinus(team.teamId));
  row.appendChild(plusMinusCell);

  const actionCell = document.createElement("td");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "small-enter-button";
  button.textContent = "Enter";
  button.disabled = String(team.teamId || "") !== String(scorecardState.scorecard.loggedInTeamId || "");
  button.addEventListener("click", () => {
    openScoreEntry({
      mode: "team",
      team,
      player: null,
      holeNumber: scorecardState.visibleStartHole
    });
  });

  actionCell.appendChild(button);
  row.appendChild(actionCell);

  return row;
}

function buildIndividualScoreRow(team, player, holes) {
  const row = document.createElement("tr");

  const nameCell = document.createElement("td");
  nameCell.innerHTML = `
    <strong>${escapeHtml(player.playerName)}</strong>
    <span class="scorecard-subtext">Team ${escapeHtml(team.teamNumber)}</span>
  `;
  row.appendChild(nameCell);

  holes.forEach((hole) => {
    const score = getIndividualScore(player.playerId, hole.holeNumber);
    const cell = document.createElement("td");
    cell.textContent = score || "-";
    row.appendChild(cell);
  });

  const plusMinusCell = document.createElement("td");
  plusMinusCell.textContent = formatPlusMinus(calculateIndividualPlusMinus(player.playerId));
  row.appendChild(plusMinusCell);

  const actionCell = document.createElement("td");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "small-enter-button";
  button.textContent = "Enter";
  button.disabled = String(player.playerId || "") !== String(scorecardState.scorecard.loggedInPlayerId || "");
  button.addEventListener("click", () => {
    openScoreEntry({
      mode: "individual",
      team,
      player,
      holeNumber: scorecardState.visibleStartHole
    });
  });

  actionCell.appendChild(button);
  row.appendChild(actionCell);

  return row;
}

function getVisibleHoles() {
  if (scorecardState.showFullCard) {
    return scorecardState.scorecard.holes;
  }

  return scorecardState.scorecard.holes.filter((hole) =>
    hole.holeNumber >= scorecardState.visibleStartHole &&
    hole.holeNumber <= scorecardState.visibleStartHole + 4
  );
}

function moveHoleWindow(direction) {
  scorecardState.visibleStartHole += direction;

  if (scorecardState.visibleStartHole < 1) {
    scorecardState.visibleStartHole = 1;
  }

  if (scorecardState.visibleStartHole > 14) {
    scorecardState.visibleStartHole = 14;
  }

  renderScorecardTable();
}

function toggleFullCard() {
  scorecardState.showFullCard = !scorecardState.
