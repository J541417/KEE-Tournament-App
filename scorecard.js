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
  scorecardDate: document.getElementById("scorecardDate"),
  scorecardAdminButton: document.getElementById("scorecardAdminButton"),
  prevHoleWindowButton: document.getElementById("prevHoleWindowButton"),
  nextHoleWindowButton: document.getElementById("nextHoleWindowButton"),
  toggleFullCardButton: document.getElementById("toggleFullCardButton"),
  globalEnterScoresButton: document.getElementById("globalEnterScoresButton"),
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
  message: document.getElementById("message"),
  jumpToHoleSelect: document.getElementById("jumpToHoleSelect") 
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadScorecard);
} else {
  loadScorecard();
}

elements.prevHoleWindowButton?.addEventListener("click", () => moveHoleWindow(-5));
elements.nextHoleWindowButton?.addEventListener("click", () => moveHoleWindow(5));
elements.toggleFullCardButton?.addEventListener("click", toggleFullCard);

elements.globalEnterScoresButton?.addEventListener("click", openGlobalScoreEntry);

elements.scorecardAdminButton?.addEventListener("click", () => {
  window.location.href = "admin.html";
});

elements.prevEntryHoleButton?.addEventListener("click", () => moveEntryHole(-1));
elements.nextEntryHoleButton?.addEventListener("click", () => moveEntryHole(1));

elements.jumpToHoleSelect?.addEventListener("change", async (e) => {
  if (!scorecardState.entryTarget) return;
  
  await saveEntryScore(false); 
  scorecardState.entryTarget.holeNumber = parseInt(e.target.value, 10);
  renderEntryView();
});

elements.saveEntryScoreButton?.addEventListener("click", (e) => {
  e.preventDefault();
  saveEntryScore(true);
});

elements.returnToScorecardButton?.addEventListener("click", showScorecardView);

async function loadScorecard() {
  clearMessage();

  const params = new URLSearchParams(window.location.search);
  scorecardState.token = params.get("token") || "";

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
    showMessage(`BACKEND ERROR: ${error.message || "Unable to load scorecard."}`);
  }
}

function isUserAdmin() {
  const token = String(scorecardState.token).toLowerCase();
  const loggedInId = String(scorecardState.scorecard?.loggedInPlayerId || "").toLowerCase();
  const isServerAdmin = scorecardState.scorecard?.loggedInIsAdmin === true;

  return token.includes("admin") || loggedInId === "admin" || isServerAdmin;
}

function renderScorecardHeader() {
  const scorecard = scorecardState.scorecard;

  if (elements.courseName) {
    elements.courseName.textContent = scorecard.courseName || "Scorecard";
  }
  
  if (elements.scorecardDate) {
    elements.scorecardDate.textContent = scorecard.roundDate || "";
  }

  if (elements.scorecardAdminButton) {
    if (isUserAdmin()) {
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
  nameCell.textContent = "Player";
  
  // ⭐ UI FIX: The Ultimate Pixel Lock! Prevents stretching under any circumstance
  nameCell.style.width = "65px";
  nameCell.style.minWidth = "65px";
  nameCell.style.maxWidth = "65px";
  nameCell.style.overflow = "hidden";
  nameCell.style.whiteSpace = "nowrap";
  nameCell.style.paddingLeft = "4px"; // Reduced padding to reclaim space
  nameCell.style.paddingRight = "4px";
  
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

function formatShortName(fullName) {
  if (!fullName) return "Player";
  const parts = fullName.trim().split(/\s+/);
  let formatted = parts[0];
  if (parts.length > 1) {
    const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
    formatted = `${parts[0]} ${lastInitial}.`;
  }
  return formatted.length > 7 ? formatted.substring(0, 7).trim() : formatted;
}

function formatIndividualName(fullName) {
  if (!fullName) return "Player";
  let formatted = fullName.trim();
  return formatted.length > 7 ? formatted.substring(0, 7).trim() : formatted;
}

function getFirstBlankHole(targetId, mode) {
  const holes = scorecardState.scorecard.holes;
  for (const hole of holes) {
    const score = mode === "team" 
      ? getTeamScore(targetId, hole.holeNumber) 
      : getIndividualScore(targetId, hole.holeNumber);
    
    if (score === "" || score === null || score === undefined) {
      return hole.holeNumber;
    }
  }
  return 1; 
}

function buildTeamScoreRow(team, holes) {
  const row = document.createElement("tr");

  const firstPlayerName = team.players.length > 0 ? formatShortName(team.players[0].playerName) : "";
  let dropdownHtml = "";
  
  if (team.players.length > 1) {
    const otherPlayers = team.players.slice(1);
    // ⭐ UI FIX: Restricted the width of the dropdown to strictly 55px so it doesn't break the cell
    dropdownHtml = `
      <select class="scorecard-subtext" style="background: transparent; border: 1px solid #ccc; border-radius: 4px; padding: 0px 2px; margin-top: 4px; width: 55px; max-width: 55px; font-size: 0.75em; overflow: hidden;">
        <option value="">+${otherPlayers.length}</option>
        ${otherPlayers.map(p => `<option disabled>${escapeHtml(formatShortName(p.playerName))}</option>`).join("")}
      </select>
    `;
  }

  const nameCell = document.createElement("td");
  // ⭐ UI FIX: The Ultimate Pixel Lock for the rows
  nameCell.style.width = "65px";
  nameCell.style.minWidth = "65px";
  nameCell.style.maxWidth = "65px";
  nameCell.style.overflow = "hidden";
  nameCell.style.whiteSpace = "nowrap";
  nameCell.style.paddingLeft = "4px";
  nameCell.style.paddingRight = "4px";

  nameCell.innerHTML = `
    <div style="font-weight: bold; color: var(--primary-dark); font-size: 0.95em; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(firstPlayerName)}</div>
    ${dropdownHtml}
  `;
  row.appendChild(nameCell);

  holes.forEach((hole) => {
    const score = getTeamScore(team.teamId, hole.holeNumber);
    const cell = document.createElement("td");
    cell.textContent = score || "-";
    
    cell.style.fontWeight = "bold";

    if (score !== "") {
      const outrightWinnerId = getOutrightLowest(hole.holeNumber);
      if (outrightWinnerId === team.teamId) {
        cell.style.backgroundColor = "#e8f5e9";
        cell.style.color = "#1b5e20";
      }
    }

    row.appendChild(cell);
  });

  const plusMinusCell = document.createElement("td");
  plusMinusCell.textContent = formatPlusMinus(calculateTeamPlusMinus(team.teamId));
  plusMinusCell.style.fontWeight = "bold"; 
  row.appendChild(plusMinusCell);

  const actionCell = document.createElement("td");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "small-enter-button";
  button.textContent = "Enter";
  
  const isMyTeam = String(team.teamId || "") === String(scorecardState.scorecard.loggedInTeamId || "");
  button.disabled = !(isUserAdmin() || isMyTeam);

  button.addEventListener("click", () => {
    openScoreEntry({
      mode: "team",
      team,
      player: null,
      holeNumber: getFirstBlankHole(team.teamId, "team") 
    });
  });

  actionCell.appendChild(button);
  row.appendChild(actionCell);

  return row;
}

function buildIndividualScoreRow(team, player, holes) {
  const row = document.createElement("tr");

  const nameCell = document.createElement("td");
  // ⭐ UI FIX: The Ultimate Pixel Lock for individual rows
  nameCell.style.width = "65px";
  nameCell.style.minWidth = "65px";
  nameCell.style.maxWidth = "65px";
  nameCell.style.overflow = "hidden";
  nameCell.style.whiteSpace = "nowrap";
  nameCell.style.paddingLeft = "4px";
  nameCell.style.paddingRight = "4px";

  const displayName = formatIndividualName(player.playerName);

  nameCell.innerHTML = `
    <div style="font-weight: bold; font-size: 0.95em; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(displayName)}</div>
  `;
  row.appendChild(nameCell);

  holes.forEach((hole) => {
    const score = getIndividualScore(player.playerId, hole.holeNumber);
    const cell = document.createElement("td");
    cell.textContent = score || "-";
    
    cell.style.fontWeight = "bold";

    if (score !== "") {
      const outrightWinnerId = getOutrightLowest(hole.holeNumber);
      if (outrightWinnerId === player.playerId) {
        cell.style.backgroundColor = "#e8f5e9";
        cell.style.color = "#1b5e20";
      }
    }

    row.appendChild(cell);
  });

  const plusMinusCell = document.createElement("td");
  plusMinusCell.textContent = formatPlusMinus(calculateIndividualPlusMinus(player.playerId));
  plusMinusCell.style.fontWeight = "bold"; 
  row.appendChild(plusMinusCell);

  const actionCell = document.createElement("td");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "small-enter-button";
  button.textContent = "Enter";
  
  const isMe = String(player.playerId || "") === String(scorecardState.scorecard.loggedInPlayerId || "");
  button.disabled = !(isUserAdmin() || isMe);

  button.addEventListener("click", () => {
    openScoreEntry({
      mode: "individual",
      team,
      player,
      holeNumber: getFirstBlankHole(player.playerId, "individual") 
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

function openGlobalScoreEntry() {
  const scorecard = scorecardState.scorecard;
  if (!scorecard || !scorecard.teams || scorecard.teams.length === 0) return;

  let targetTeam = scorecard.teams[0];
  let targetPlayer = targetTeam.players[0] || null;

  if (scorecard.loggedInTeamId) {
    const foundTeam = scorecard.teams.find(t => String(t.teamId) === String(scorecard.loggedInTeamId));
    if (foundTeam) targetTeam = foundTeam;
  }
  
  if (scorecard.loggedInPlayerId && String(scorecard.loggedInPlayerId).toLowerCase() !== "admin") {
    for (const t of scorecard.teams) {
      const p = t.players.find(pl => String(pl.playerId) === String(scorecard.loggedInPlayerId));
      if (p) {
        targetTeam = t;
        targetPlayer = p;
        break;
      }
    }
  }

  const targetId = scorecard.scoringMode === "team" ? targetTeam.teamId : targetPlayer.playerId;

  openScoreEntry({
    mode: scorecard.scoringMode,
    team: targetTeam,
    player: targetPlayer,
    holeNumber: getFirstBlankHole(targetId, scorecard.scoringMode) 
  });
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

  if (elements.scorecardView) elements.scorecardView.classList.add("hidden");
  if (elements.scoreEntryView) elements.scoreEntryView.classList.remove("hidden");

  setTimeout(() => {
    if (elements.entryScoreInput) {
      elements.entryScoreInput.focus();
      elements.entryScoreInput.select();
    }
  }, 50);
}

function renderEntryView() {
  const target = scorecardState.entryTarget;
  const hole = scorecardState.scorecard.holes.find((item) =>
    Number(item.holeNumber) === Number(target.holeNumber)
  );

  const participantName = target.mode === "team"
    ? (target.team.players.length > 0 ? formatShortName(target.team.players[0].playerName) : "Team")
    : formatIndividualName(target.player.playerName);

  const currentScore = target.mode === "team"
    ? getTeamScore(target.team.teamId, target.holeNumber)
    : getIndividualScore(target.player.playerId, target.holeNumber);

  if (elements.entryTypeLabel) elements.entryTypeLabel.textContent = target.mode === "team" ? "Team Score" : "Individual Score";
  if (elements.entryMainTitle) elements.entryMainTitle.textContent = `${scorecardState.scorecard.courseName} Hole ${target.holeNumber}`;
  if (elements.entryParticipantName) elements.entryParticipantName.textContent = participantName;
  if (elements.entryParBadge) elements.entryParBadge.textContent = `Par ${hole?.par || "-"}`;
  if (elements.entryScoreInput) elements.entryScoreInput.value = currentScore || "";

  if (elements.jumpToHoleSelect) {
    elements.jumpToHoleSelect.value = target.holeNumber;
  }

  if (elements.prevEntryHoleButton) elements.prevEntryHoleButton.disabled = target.holeNumber <= 1;
  if (elements.nextEntryHoleButton) elements.nextEntryHoleButton.disabled = target.holeNumber >= 18;
}

async function moveEntryHole(direction) {
  if (!scorecardState.entryTarget) return;

  if (elements.prevEntryHoleButton) elements.prevEntryHoleButton.disabled = true;
  if (elements.nextEntryHoleButton) elements.nextEntryHoleButton.disabled = true;

  await saveEntryScore(false);

  scorecardState.entryTarget.holeNumber += direction;

  if (scorecardState.entryTarget.holeNumber < 1) {
    scorecardState.entryTarget.holeNumber = 1;
  }

  if (scorecardState.entryTarget.holeNumber > 18) {
    scorecardState.entryTarget.holeNumber = 18;
  }

  renderEntryView();
}

async function saveEntryScore(closeView = true) {
  const target = scorecardState.entryTarget;
  if (!target) return;

  const btn = elements.saveEntryScoreButton;
  if (btn) {
    btn.disabled = true;
    btn.textContent = closeView ? "Saving..." : "Save & Close"; 
  }

  try {
    await saveScore({
      scoringMode: target.mode === "team" ? "team" : "individual",
      teamId: target.team.teamId,
      playerId: target.player?.playerId || "",
      holeNumber: target.holeNumber,
      score: elements.entryScoreInput?.value || "" 
    });

    if (closeView) {
      showScorecardView();
      showSuccess("Score saved.");
    }
  } catch (error) {
    showMessage(error.message || "Unable to save score.");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Save & Close";
    }
  }
}

async function saveScore({ scoringMode, teamId, playerId, holeNumber, score }) {
  clearMessage();

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
}

function showScorecardView() {
  clearMessage();
  if (elements.scoreEntryView) elements.scoreEntryView.classList.add("hidden");
  if (elements.scorecardView) elements.scorecardView.classList.remove("hidden");
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

function getOutrightLowest(holeNumber) {
  const scorecard = scorecardState.scorecard;
  let scores = [];

  if (scorecard.scoringMode === "team") {
    scorecard.teams.forEach((team) => {
      const score = getTeamScore(team.teamId, holeNumber);
      if (score !== "") scores.push({ id: team.teamId, val: Number(score) });
    });
  } else {
    scorecard.teams.forEach((team) => {
      team.players.forEach((player) => {
        const score = getIndividualScore(player.playerId, holeNumber);
        if (score !== "") scores.push({ id: player.playerId, val: Number(score) });
      });
    });
  }

  if (scores.length === 0) return null;

  const minScore = Math.min(...scores.map((s) => s.val));
  const lowScores = scores.filter((s) => s.val === minScore);

  return lowScores.length === 1 ? lowScores[0].id : null;
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
  if (!elements.message) return;
  elements.message.textContent = text;
  elements.message.classList.remove("hidden");
  elements.message.style.background = "var(--danger-bg)";
  elements.message.style.color = "var(--danger-text)";
}

function showSuccess(text) {
  if (!elements.message) return;
  elements.message.textContent = text;
  elements.message.classList.remove("hidden");
  elements.message.style.background = "#ecf7ef";
  elements.message.style.color = "var(--primary-dark)";
}

function clearMessage() {
  if (!elements.message) return;
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
