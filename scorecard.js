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

document.addEventListener("DOMContentLoaded", loadScorecard);

elements.prevHoleWindowButton.addEventListener("click", () => moveHoleWindow(-5));
elements.nextHoleWindowButton.addEventListener("click", () => moveHoleWindow(5));
elements.toggleFullCardButton.addEventListener("click", toggleFullCard);

// CORRECTED: Removed the leading slash to make it a relative path
elements.scorecardAdminButton.addEventListener("click", () => {
  window.location.href = "admin.html";
});

elements.prevEntryHoleButton.addEventListener("click", () => moveEntryHole(-1));
elements.nextEntryHoleButton.addEventListener("click", () => moveEntryHole(1));
elements.saveEntryScoreButton.addEventListener("click", saveEntryScore);
elements.returnToScorecardButton.addEventListener("click", showScorecardView);

async function loadScorecard() {
  clearMessage();

  const params = new URLSearchParams(window.location.search);
  scorecardState.token = params.get("token") || "";

  if (!scorecardState.token) {
    elements.scorecardBadge.textContent = "Error";
    showMessage("No scorecard token was provided.");
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

    elements.scorecardBadge.textContent = "Active";
  } catch (error) {
    elements.scorecardBadge.textContent = "Error";
    showMessage(error.message || "Unable to load scorecard.");
  }
}

function renderScorecardHeader() {
  const scorecard = scorecardState.scorecard;

  elements.courseName.textContent = scorecard.courseName || "Scorecard";

  if (scorecard.loggedInIsAdmin) {
    elements.scorecardAdminButton.classList.remove("hidden");
  } else {
    elements.scorecardAdminButton.classList.add("hidden");
  }
}

function renderScorecardTable() {
  const scorecard = scorecardState.scorecard;
  const holes = getVisibleHoles();

  const firstHole = holes[0]?.holeNumber || 1;
  const lastHole = holes[holes.length - 1]?.holeNumber || 18;

  elements.holeWindowLabel.textContent = scorecardState.showFullCard
    ? "Entire Card"
    : `Holes ${firstHole}-${lastHole}`;

  elements.toggleFullCardButton.textContent = scorecardState.showFullCard
    ? "Show Compact View"
    : "Show Entire Card";

  elements.prevHoleWindowButton.disabled = scorecardState.showFullCard || scorecardState.visibleStartHole <= 1;
  elements.nextHoleWindowButton.disabled = scorecardState.showFullCard || scorecardState.visibleStartHole >= 14;

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

  elements.scorecardTableWrapper.innerHTML = "";
  elements.scorecardTableWrapper.appendChild(table);
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
  scorecardState.showFullCard = !scorecardState.showFullCard;
  renderScorecardTable();
}

function openScoreEntry({ mode, team, player, holeNumber }) {
  clearMessage();

  scorecardState.entryTarget = {
    mode,
    team,
    player,
    holeNumber
  };

  renderEntryView();

  elements.scorecardView.classList.add("hidden");
  elements.scoreEntryView.classList.remove("hidden");

  setTimeout(() => {
    elements.entryScoreInput.focus();
    elements.entryScoreInput.select();
  }, 50);
}

function renderEntryView() {
  const target = scorecardState.entryTarget;
  const hole = scorecardState.scorecard.holes.find((item) =>
    Number(item.holeNumber) === Number(target.holeNumber)
  );

  const participantName = target.mode === "team"
    ? `Team ${target.team.teamNumber}`
    : target.player.playerName;

  const currentScore = target.mode === "team"
    ? getTeamScore(target.team.teamId, target.holeNumber)
    : getIndividualScore(target.player.playerId, target.holeNumber);

  elements.entryTypeLabel.textContent = target.mode === "team" ? "Team Score" : "Individual Score";
  elements.entryMainTitle.textContent = `${scorecardState.scorecard.courseName} Hole ${target.holeNumber}`;
  elements.entryParticipantName.textContent = participantName;
  elements.entryParBadge.textContent = `Par ${hole?.par || "-"}`;
  elements.entryScoreInput.value = currentScore || "";

  elements.prevEntryHoleButton.disabled = target.holeNumber <= 1;
  elements.nextEntryHoleButton.disabled = target.holeNumber >= 18;
}

function moveEntryHole(direction) {
  if (!scorecardState.entryTarget) {
    return;
  }

  scorecardState.entryTarget.holeNumber += direction;

  if (scorecardState.entryTarget.holeNumber < 1) {
    scorecardState.entryTarget.holeNumber = 1;
  }

  if (scorecardState.entryTarget.holeNumber > 18) {
    scorecardState.entryTarget.holeNumber = 18;
  }

  renderEntryView();
}

async function saveEntryScore() {
  const target = scorecardState.entryTarget;

  if (!target) {
    return;
  }

  await saveScore({
    scoringMode: target.mode === "team" ? "team" : "individual",
    teamId: target.team.teamId,
    playerId: target.player?.playerId || "",
    holeNumber: target.holeNumber,
    score: elements.entryScoreInput.value
  });
}

async function saveScore({ scoringMode, teamId, playerId, holeNumber, score }) {
  clearMessage();

  try {
    const response = await fetch("/api/save-score", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        token: scorecardState.token,
        scoringMode,
        roundId: scorecardState.scorecard.roundId,
        teamId,
        playerId,
        holeNumber,
        score
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to save score.");
    }

    await loadScorecard();

    if (scorecardState.entryTarget) {
      renderEntryView();
    }

    showSuccess("Score saved.");
  } catch (error) {
    showMessage(error.message || "Unable to save score.");
  }
}

function showScorecardView() {
  clearMessage();
  elements.scoreEntryView.classList.add("hidden");
  elements.scorecardView.classList.remove("hidden");
  renderScorecardTable();
}

function getTeamScore(teamId, holeNumber) {
  const key = `team:${teamId}:hole:${holeNumber}`;
  return scorecardState.scorecard.scores[key]?.score || "";
}

function getIndividualScore(playerId, holeNumber) {
  const key = `player:${playerId}:hole:${holeNumber}`;
  return scorecardState.scorecard.scores[key]?.score || "";
}

function calculateTeamPlusMinus(teamId) {
  let scoreTotal = 0;
  let parTotal = 0;

  scorecardState.scorecard.holes.forEach((hole) => {
    const score = getTeamScore(teamId, hole.holeNumber);

    if (score) {
      scoreTotal += Number(score);
      parTotal += Number(hole.par || 0);
    }
  });

  if (parTotal === 0) {
    return null;
  }

  return scoreTotal - parTotal;
}

function calculateIndividualPlusMinus(playerId) {
  let scoreTotal = 0;
  let parTotal = 0;

  scorecardState.scorecard.holes.forEach((hole) => {
    const score = getIndividualScore(playerId, hole.holeNumber);

    if (score) {
      scoreTotal += Number(score);
      parTotal += Number(hole.par || 0);
    }
  });

  if (parTotal === 0) {
    return null;
  }

  return scoreTotal - parTotal;
}

function formatPlusMinus(value) {
  if (value === null || value === undefined) {
    return "-";
  }

  if (value === 0) {
    return "E";
  }

  return value > 0 ? `+${value}` : String(value);
}

function showMessage(text) {
  elements.message.textContent = text;
  elements.message.classList.remove("hidden");
  elements.message.style.background = "var(--danger-bg)";
  elements.message.style.color = "var(--danger-text)";
}

function showSuccess(text) {
  elements.message.textContent = text;
  elements.message.classList.remove("hidden");
  elements.message.style.background = "#ecf7ef";
  elements.message.style.color = "var(--primary-dark)";
}

function clearMessage() {
  elements.message.textContent = "";
  elements.message.classList.add("hidden");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
