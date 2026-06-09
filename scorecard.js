const scorecardState = {
  token: "",
  scorecard: null,
  currentHole: 1
};

const elements = {
  scorecardBadge: document.getElementById("scorecardBadge"),
  courseName: document.getElementById("courseName"),
  roundDate: document.getElementById("roundDate"),
  scoringMode: document.getElementById("scoringMode"),
  loggedInPlayer: document.getElementById("loggedInPlayer"),
  currentHoleBadge: document.getElementById("currentHoleBadge"),
  holeNav: document.getElementById("holeNav"),
  holeTitle: document.getElementById("holeTitle"),
  parBadge: document.getElementById("parBadge"),
  teamsList: document.getElementById("teamsList"),
  message: document.getElementById("message")
};

document.addEventListener("DOMContentLoaded", loadScorecard);

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
    scorecardState.currentHole = 1;

    renderScorecardHeader();
    renderHoleNav();
    renderCurrentHole();

    elements.scorecardBadge.textContent = "Active";
  } catch (error) {
    elements.scorecardBadge.textContent = "Error";
    showMessage(error.message || "Unable to load scorecard.");
  }
}

function renderScorecardHeader() {
  const scorecard = scorecardState.scorecard;

  elements.courseName.textContent = scorecard.courseName || "Course";
  elements.roundDate.textContent = formatDisplayDate(scorecard.roundDate);
  elements.scoringMode.textContent = formatScoringMode(scorecard.scoringMode);
  elements.loggedInPlayer.textContent = scorecard.loggedInPlayerName || "-";
}

function renderHoleNav() {
  elements.holeNav.innerHTML = "";

  scorecardState.scorecard.holes.forEach((hole) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary-button hole-button";
    button.textContent = String(hole.holeNumber);

    if (hole.holeNumber === scorecardState.currentHole) {
      button.classList.add("active-hole");
    }

    button.addEventListener("click", () => {
      scorecardState.currentHole = hole.holeNumber;
      renderHoleNav();
      renderCurrentHole();
    });

    elements.holeNav.appendChild(button);
  });
}

function renderCurrentHole() {
  clearMessage();

  const scorecard = scorecardState.scorecard;
  const holeNumber = scorecardState.currentHole;
  const hole = scorecard.holes.find((item) => Number(item.holeNumber) === Number(holeNumber));

  elements.currentHoleBadge.textContent = `Hole ${holeNumber}`;
  elements.holeTitle.textContent = `Hole ${holeNumber}`;
  elements.parBadge.textContent = `Par ${hole?.par || "-"}`;

  elements.teamsList.innerHTML = "";

  scorecard.teams.forEach((team) => {
    const teamCard = document.createElement("section");
    teamCard.className = "round-panel score-team-card";

    const header = document.createElement("div");
    header.className = "team-header";

    const titleBlock = document.createElement("div");

    const title = document.createElement("h2");
    title.textContent = `Team ${team.teamNumber}`;

    const players = document.createElement("p");
    players.className = "muted";
    players.textContent = team.players.map((player) => player.playerName).join(", ");

    titleBlock.appendChild(title);
    titleBlock.appendChild(players);

    const currentScore = getDisplayedScore(scorecard, team, holeNumber);

    const scoreBadge = document.createElement("div");
    scoreBadge.className = "team-rating";
    scoreBadge.textContent = currentScore ? `Score: ${currentScore}` : "No Score";

    header.appendChild(titleBlock);
    header.appendChild(scoreBadge);
    teamCard.appendChild(header);

    const canScoreTeam = scorecard.scoringMode === "team" &&
      String(team.teamId || "") === String(scorecard.loggedInTeamId || "");

    if (scorecard.scoringMode === "team") {
      const row = createTeamScoreInput(team, holeNumber, currentScore, canScoreTeam);
      teamCard.appendChild(row);
    }

    if (scorecard.scoringMode === "individual") {
      const individualRows = createIndividualScoreInputs(team, holeNumber);
      individualRows.forEach((row) => teamCard.appendChild(row));
    }

    elements.teamsList.appendChild(teamCard);
  });
}

function createTeamScoreInput(team, holeNumber, currentScore, canScoreTeam) {
  const wrapper = document.createElement("div");
  wrapper.className = "score-entry-row";

  const input = document.createElement("input");
  input.type = "number";
  input.min = "1";
  input.max = "20";
  input.inputMode = "numeric";
  input.value = currentScore || "";
  input.placeholder = "Score";
  input.disabled = !canScoreTeam;

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = canScoreTeam ? "Enter Score" : "Team Only";
  button.disabled = !canScoreTeam;

  button.addEventListener("click", () => {
    saveScore({
      scoringMode: "team",
      teamId: team.teamId,
      playerId: "",
      holeNumber,
      score: input.value
    });
  });

  wrapper.appendChild(input);
  wrapper.appendChild(button);

  return wrapper;
}

function createIndividualScoreInputs(team, holeNumber) {
  return team.players.map((player) => {
    const wrapper = document.createElement("div");
    wrapper.className = "score-entry-row individual-score-row";

    const label = document.createElement("div");
    label.className = "score-player-name";
    label.textContent = player.playerName;

    const scoreKey = `player:${player.playerId}:hole:${holeNumber}`;
    const currentScore = scorecardState.scorecard.scores[scoreKey]?.score || "";

    const input = document.createElement("input");
    input.type = "number";
    input.min = "1";
    input.max = "20";
    input.inputMode = "numeric";
    input.value = currentScore;
    input.placeholder = "Score";

    const canScorePlayer =
      String(player.playerId || "") === String(scorecardState.scorecard.loggedInPlayerId || "");

    input.disabled = !canScorePlayer;

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = canScorePlayer ? "Enter Score" : "Player Only";
    button.disabled = !canScorePlayer;

    button.addEventListener("click", () => {
      saveScore({
        scoringMode: "individual",
        teamId: team.teamId,
        playerId: player.playerId,
        holeNumber,
        score: input.value
      });
    });

    wrapper.appendChild(label);
    wrapper.appendChild(input);
    wrapper.appendChild(button);

    return wrapper;
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

    showSuccess("Score saved.");

    await loadScorecard();
    scorecardState.currentHole = Number(holeNumber);
    renderHoleNav();
    renderCurrentHole();
  } catch (error) {
    showMessage(error.message || "Unable to save score.");
  }
}

function getDisplayedScore(scorecard, team, holeNumber) {
  if (scorecard.scoringMode === "team") {
    const key = `team:${team.teamId}:hole:${holeNumber}`;
    return scorecard.scores[key]?.score || "";
  }

  return "";
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
