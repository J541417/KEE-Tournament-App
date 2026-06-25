const adminState = {
  password: "",
  players: [],
  courses: [],
  activeToken: ""
};

const elements = {
  adminStatusBadge: document.getElementById("adminStatusBadge"),
  loginForm: document.getElementById("loginForm"),
  adminPassword: document.getElementById("adminPassword"),
  adminPanel: document.getElementById("adminPanel"),
  
  currentRoundPanel: document.getElementById("currentRoundPanel"),
  displayRoundDate: document.getElementById("displayRoundDate"),
  displayCourse: document.getElementById("displayCourse"),
  displayFormat: document.getElementById("displayFormat"),
  deleteRoundBtn: document.getElementById("deleteRoundBtn"),

  roundDate: document.getElementById("roundDate"),
  courseSelect: document.getElementById("courseSelect"),
  scoringMode: document.getElementById("scoringMode"),
  teamCount: document.getElementById("teamCount"),
  buildTeamsButton: document.getElementById("buildTeamsButton"),
  teamsContainer: document.getElementById("teamsContainer"),
  saveRoundButton: document.getElementById("saveRoundButton"),
  message: document.getElementById("message")
};

if (elements.loginForm) {
  elements.loginForm.addEventListener("submit", handleLogin);
}

elements.buildTeamsButton?.addEventListener("click", buildTeamBoxes);
elements.saveRoundButton?.addEventListener("click", saveActiveRound);
elements.deleteRoundBtn?.addEventListener("click", deleteActiveRound);

async function handleLogin(event) {
  event.preventDefault();
  clearMessage();

  const password = elements.adminPassword?.value;
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Login failed.");

    adminState.password = password;

    if (elements.adminStatusBadge) elements.adminStatusBadge.textContent = "Unlocked";
    if (elements.loginForm) elements.loginForm.classList.add("hidden");
    if (elements.adminPanel) elements.adminPanel.classList.remove("hidden");

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
    const [playersResponse, coursesResponse, activeRoundResponse] = await Promise.all([
      fetch("/api/list-players"),
      fetch("/api/list-courses"),
      fetch(`/api/active-round?t=${Date.now()}`)
    ]);

    const playersData = await playersResponse.json();
    const coursesData = await coursesResponse.json();
    
    if (!playersResponse.ok) throw new Error(playersData.error || "Unable to load players.");
    if (!coursesResponse.ok) throw new Error(coursesData.error || "Unable to load courses.");

    adminState.players = playersData.players || [];
    adminState.courses = coursesData.courses || [];
    populateCourses();

    const today = new Date();
    if (elements.roundDate) elements.roundDate.value = today.toISOString().slice(0, 10);

    // ⭐ DASHBOARD LOGIC: Pre-fill the form and player boxes if a round is active
    if (activeRoundResponse.ok) {
      const activeData = await activeRoundResponse.json();
      
      if (activeData.active && activeData.token) {
        adminState.activeToken = activeData.token;

        if (elements.currentRoundPanel) elements.currentRoundPanel.classList.remove("hidden");
        if (elements.displayRoundDate) elements.displayRoundDate.textContent = activeData.roundDate || "Active";
        if (elements.displayCourse) elements.displayCourse.textContent = activeData.courseName || "Unknown Course";
        if (elements.displayFormat) elements.displayFormat.textContent = activeData.scoringMode === "team" ? "Team Scoring" : "Individual Scoring";

        if (elements.roundDate && activeData.roundDate) elements.roundDate.value = activeData.roundDate;
        if (elements.courseSelect && activeData.courseName) elements.courseSelect.value = activeData.courseName;
        if (elements.scoringMode && activeData.scoringMode) elements.scoringMode.value = activeData.scoringMode;

        // Automatically build and pre-fill the team boxes with the active players!
        if (activeData.teams && activeData.teams.length > 0) {
          if (elements.teamCount) elements.teamCount.value = activeData.teams.length;
          
          buildTeamBoxes(); 

          activeData.teams.forEach((team, teamIndex) => {
            const teamNum = teamIndex + 1;
            team.players.forEach((player, playerIndex) => {
              const slot = playerIndex + 1;
              const select = document.querySelector(`.player-select[data-team-number="${teamNum}"][data-slot="${slot}"]`);
              if (select) {
                select.value = player.playerId;
              }
            });
          });

          const teamCards = Array.from(document.querySelectorAll(".team-card"));
          teamCards.forEach(updateTeamRating);
          updatePlayerAvailability();
          return; // Stop here so we don't accidentally build blank boxes below
        }
      }
    }

    // If there is no active round, just build default blank boxes
    buildTeamBoxes();
  } catch (error) {
    showMessage(error.message || "Unable to load admin data.");
  }
}

async function deleteActiveRound() {
  const confirmDelete = confirm("Are you sure you want to completely delete the active round? This will wipe the scorecard.");
  if (!confirmDelete) return;

  elements.deleteRoundBtn.disabled = true;
  elements.deleteRoundBtn.textContent = "Deleting...";

  try {
    const response = await fetch("/api/delete-round", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: adminState.password })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to delete round.");

    showSuccess("Active round successfully deleted.");
    
    adminState.activeToken = "";
    if (elements.currentRoundPanel) elements.currentRoundPanel.classList.add("hidden");
    
    // Reset form to defaults
    if (elements.teamCount) elements.teamCount.value = 2;
    buildTeamBoxes();

  } catch (error) {
    showMessage(error.message || "An error occurred while deleting.");
  } finally {
    elements.deleteRoundBtn.disabled = false;
    elements.deleteRoundBtn.textContent = "Delete Round";
  }
}

function populateCourses() {
  if (!elements.courseSelect) return;
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
  const teamCount = Number(elements.teamCount?.value);
  if (!Number.isInteger(teamCount) || teamCount < 1) {
    showMessage("Please enter a valid number of teams.");
    return;
  }
  if
