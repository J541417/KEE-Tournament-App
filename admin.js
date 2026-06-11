const adminState = {
  password: "",
  players: [],
  courses: []
};

const elements = {
  adminStatusBadge: document.getElementById("adminStatusBadge"),
  loginForm: document.getElementById("loginForm"),
  adminPassword: document.getElementById("adminPassword"),
  adminPanel: document.getElementById("adminPanel"),
  roundDate: document.getElementById("roundDate"),
  courseSelect: document.getElementById("courseSelect"),
  scoringMode: document.getElementById("scoringMode"),
  teamCount: document.getElementById("teamCount"),
  buildTeamsButton: document.getElementById("buildTeamsButton"),
  teamsContainer: document.getElementById("teamsContainer"),
  saveRoundButton: document.getElementById("saveRoundButton"),
  message: document.getElementById("message")
};

elements.loginForm.addEventListener("submit", handleLogin);
elements.buildTeamsButton.addEventListener("click", buildTeamBoxes);
elements.saveRoundButton.addEventListener("click", saveActiveRound);

async function handleLogin(event) {
  event.preventDefault();

  clearMessage();

  const password = elements.adminPassword.value;

  if (!password) {
    showMessage("Please enter the admin password.");
    return;
  }

  const loginButton = elements.loginForm.querySelector("button");
  loginButton.disabled = true;
  loginButton.textContent = "Logging in...";

  try {
    const response = await fetch("/api/admin-login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Login failed.");
    }

    adminState.password = password;

    elements.adminStatusBadge.textContent = "Unlocked";
    elements.loginForm.classList.add("hidden");
    elements.adminPanel.classList.remove("hidden");

    await loadAdminData();
  } catch (error) {
    showMessage(error.message || "Login failed.");
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "Log In";
  }
}

async function loadAdminData() {
  clearMessage();

  try {
    const [playersResponse, coursesResponse] = await Promise.all([
      fetch("/api/list-players"),
      fetch("/api/list-courses")
    ]);

    const playersData = await playersResponse.json();
    const coursesData = await coursesResponse.json();

    if (!playersResponse.ok) {
      throw new Error(playersData.error || "Unable to load players.");
    }

    if (!coursesResponse.ok) {
      throw new Error(coursesData.error || "Unable to load courses.");
    }

    adminState.players = playersData.players || [];
    adminState.courses = coursesData.courses || [];

    populateCourses();

    const today = new Date();
    elements.roundDate.value = today.toISOString().slice(0, 10);

    buildTeamBoxes();
  } catch (error) {
    showMessage(error.message || "Unable to load admin data.");
  }
}

function populateCourses() {
  elements.courseSelect.innerHTML = "";

  if (adminState.courses.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No courses found";
    elements.courseSelect.appendChild(option);
    return;
  }

  adminState.courses.forEach((course) => {
    const option = document.createElement("option");
    option.value = course.courseName;
    option.textContent = course.courseName;
    elements.courseSelect.appendChild(option);
  });
}

function buildTeamBoxes() {
  clearMessage();

  const teamCount = Number(elements.teamCount.value);

  if (!Number.isInteger(teamCount) || teamCount < 1) {
    showMessage("Please enter a valid number of teams.");
    return;
  }

  elements.teamsContainer.innerHTML = "";

  for (let i = 1; i <= teamCount; i += 1) {
    const teamCard = document.createElement("section");
    teamCard.className = "round-panel team-card";
    teamCard.dataset.teamNumber = String(i);

    const header = document.createElement("div");
    header.className = "team-header";

    const title = document.createElement("h2");
    title.textContent = `Team ${i}`;

    const rating = document.createElement("div");
    rating.className = "team-rating";
    rating.textContent = "Rating: 0.00";

    header.appendChild(title);
    header.appendChild(rating);
    teamCard.appendChild(header);

    const helper = document.createElement("p");
    helper.className = "muted";
    helper.textContent = "Choose 2 to 4 players.";
    teamCard.appendChild(helper);

    for (let slot = 1; slot <= 4; slot += 1) {
      const label = document.createElement("label");
      label.textContent = `Player ${slot}`;

      const select = document.createElement("select");
      select.className = "player-select";
      select.dataset.teamNumber = String(i);
      select.dataset.slot = String(slot);

      const blankOption = document.createElement("option");
      blankOption.value = "";
      blankOption.textContent = slot <= 2 ? "Required" : "Optional";
      blankOption.dataset.rating = "0";
      select.appendChild(blankOption);

      adminState.players.forEach((player) => {
        const option = document.createElement("option");
        option.value = player.playerId;
        option.textContent = `${player.playerName} (${player.rating || "No rating"})`;
        option.dataset.playerName = player.playerName;
        option.dataset.rating = player.rating || "";
        select.appendChild(option);
      });

      select.addEventListener("change", () => {
        updateTeamRating(teamCard);
        updatePlayerAvailability();
      });

      label.appendChild(select);
      teamCard.appendChild(label);
    }

    elements.teamsContainer.appendChild(teamCard);
    updateTeamRating(teamCard);
  }

  updatePlayerAvailability();

  elements.teamsContainer.classList.remove("hidden");
  elements.saveRoundButton.classList.remove("hidden");
}

function updateTeamRating(teamCard) {
  const selects = Array.from(teamCard.querySelectorAll(".player-select"));

  const total = selects.reduce((sum, select) => {
    const selectedOption = select.options[select.selectedIndex];
    const rating = Number(selectedOption?.dataset.rating || 0);

    return Number.isFinite(rating) ? sum + rating : sum;
  }, 0);

  const ratingDisplay = teamCard.querySelector(".team-rating");

  if (ratingDisplay) {
    ratingDisplay.textContent = `Rating: ${total.toFixed(2)}`;
  }
}

function updatePlayerAvailability() {
  const selects = Array.from(document.querySelectorAll(".player-select"));
  const selectedValues = selects
    .map((select) => select.value)
    .filter(Boolean);

  selects.forEach((select) => {
    const currentValue = select.value;

    Array.from(select.options).forEach((option) => {
      if (!option.value) {
        option.disabled = false;
        return;
      }

      option.disabled =
        option.value !== currentValue &&
        selectedValues.includes(option.value);
    });
  });
}

async function saveActiveRound() {
  clearMessage();

  const roundDate = elements.roundDate.value;
  const courseName = elements.courseSelect.value;
  const scoringMode = elements.scoringMode.value;

  if (!roundDate) {
    showMessage("Round date is required.");
    return;
  }

  if (!courseName) {
    showMessage("Course is required.");
    return;
  }

  const teams = collectTeams();

  if (!teams) {
    return;
  }

  const saveButton = elements.saveRoundButton;
  saveButton.disabled = true;
  saveButton.textContent = "Saving...";

  try {
    const response = await fetch("/api/create-round", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        password: adminState.password,
        roundDate,
        courseName,
        scoringMode,
        teams
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to create active round.");
    }

    showSuccess(`Active round created. ${data.rowsWritten} rows written to the data tab.`);
  } catch (error) {
    showMessage(error.message || "Unable to create active round.");
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = "Set Active Round";
  }
}

function collectTeams() {
  const teamCards = Array.from(document.querySelectorAll(".team-card"));
  const usedPlayerIds = new Set();
  const teams = [];

  for (const teamCard of teamCards) {
    const teamNumber = teamCard.dataset.teamNumber;
    const selects = Array.from(teamCard.querySelectorAll(".player-select"));

    const players = selects
      .filter((select) => select.value)
      .map((select) => {
        const selectedOption = select.options[select.selectedIndex];

        return {
          playerId: select.value,
          playerName: selectedOption.dataset.playerName,
          rating: selectedOption.dataset.rating || ""
        };
      });

    if (players.length < 2 || players.length > 4) {
      showMessage(`Team ${teamNumber} must have 2 to 4 players.`);
      return null;
    }

    for (const player of players) {
      if (usedPlayerIds.has(player.playerId)) {
        showMessage(`${player.playerName} is selected more than once.`);
        return null;
      }

      usedPlayerIds.add(player.playerId);
    }

    teams.push({
      teamNumber,
      players
    });
  }

  return teams;
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

/* ⭐ UPDATED FUNCTION ⭐ */
function goToScorecard() {
  // If they haven't logged in yet, adminState.password will be empty.
  // We can either pass an empty token or alert them. We'll try to pass the token.
  const token = adminState.password;
  
  // Use relative path (no leading slash) and append the token
  window.location.href = `scorecard.html?token=${encodeURIComponent(token)}`;
}
// END OF FILE
