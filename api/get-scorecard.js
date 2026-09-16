import { getDataRows, getRows, TAB_NAMES } from "../lib/googleSheets.js";
import { isAdminValue } from "../lib/playerUtils.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  // ⭐ Cache Buster for Vercel Backend
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    const token = String(req.query.token || "").trim();
    
    // ⭐ NEW: Allow the frontend to request a specific Round and Course for asynchronous play
    const targetRound = String(req.query.round || "").trim();
    const targetCourse = String(req.query.course || "").trim();

    if (!token) {
      return res.status(400).json({ error: "Scorecard token is required." });
    }

    // ⭐ NEW: We now fetch your brand new "round" tab alongside the other data
    const [dataRows, courseRows, playerRows, tournamentRoundRows] = await Promise.all([
      getDataRows(),                 // The 'Data-Tour' tab (Logs scores & tokens)
      getRows(TAB_NAMES.COURSES),    // The 'courses' tab (Pars)
      getRows(TAB_NAMES.PLAYERS),    // The 'players' tab (Admin check)
      getRows("round")               // The NEW 'round' matrix tab!
    ]);

    // 1. Authenticate the Player (Unchanged)
    let tokenRow = [...dataRows].reverse().find((row) =>
      String(row.token || "").trim() === token &&
      String(row.status || "").trim().toLowerCase() === "active"
    );

    if (!tokenRow && token.startsWith("player-")) {
      const parts = token.split("-");
      if (parts.length >= 3) {
        const pId = parts[1];
        tokenRow = [...dataRows].reverse().find((row) => 
          String(row.player_id || row.playerId || "").trim() === pId &&
          String(row.status || "").trim().toLowerCase() === "active"
        );
      }
    }

    if (!tokenRow) {
      return res.status(404).json({ error: "Scorecard token was not found or is no longer active." });
    }

    const loggedInPlayerId = String(tokenRow.player_id || tokenRow.playerId || "").trim();
    const loggedInPlayerSheetRow = playerRows.find((row) => 
      String(row["Player ID"] || row["ID"] || row["PlayerId"] || "").trim() === loggedInPlayerId
    );
    const loggedInIsAdmin = loggedInPlayerSheetRow ? isAdminValue(loggedInPlayerSheetRow.Admin) : false;

    // ⭐ NEW: 2. Determine the Active Round and Course
    // If the frontend didn't specify, find out where the logged-in player is assigned today from the new 'round' tab
    let activeRoundNumber = targetRound;
    let activeCourseName = targetCourse;

    if (!activeRoundNumber || !activeCourseName) {
       const playerSchedule = tournamentRoundRows.find(row => 
         String(row["Player 1"] || "").includes(loggedInPlayerId) ||
         String(row["Player 2"] || "").includes(loggedInPlayerId) ||
         String(row["Player 3"] || "").includes(loggedInPlayerId) ||
         String(row["Player 4"] || "").includes(loggedInPlayerId)
       );
       
       if (playerSchedule) {
         activeRoundNumber = String(playerSchedule.Round || "");
         activeCourseName = String(playerSchedule.Course || "");
       }
    }

    if (!activeRoundNumber || !activeCourseName) {
      return res.status(404).json({ error: "No course assignment found for this round." });
    }

    // ⭐ NEW: 3. Fetch Pars for the SPECIFIC course assigned to this team
    const course = courseRows.find((row) =>
      String(row["Hole #"] || "").trim().toLowerCase() === activeCourseName.toLowerCase()
    );

    const holes = [];
    for (let i = 1; i <= 18; i += 1) {
      holes.push({
        holeNumber: i,
        par: course ? String(course[String(i)] || "").trim() : ""
      });
    }

    // ⭐ NEW: 4. Build the Teams directly from your new 'round' tab
    const teams = [];
    const activeRosterRows = tournamentRoundRows.filter(row => 
      String(row.Round || "").trim() === activeRoundNumber && 
      String(row.Course || "").trim() === activeCourseName
    );

    activeRosterRows.forEach((row) => {
      const teamId = String(row.Team || "").trim();
      const players = [];
      
      // Loop through Player 1 to Player 4 columns
      [1, 2, 3, 4].forEach(num => {
        const playerNameStr = row[`Player ${num}`];
        if (playerNameStr && String(playerNameStr).trim() !== "") {
           players.push({
             playerId: playerNameStr, // Keeping this flexible based on how Admin saves it
             playerName: playerNameStr
           });
        }
      });

      if (teamId && players.length > 0) {
        teams.push({ teamId, teamNumber: teamId, players });
      }
    });

    // ⭐ NEW: 5. Fetch Scores from 'Data-Tour' but filter by Round and Course
    const scoreRows = dataRows.filter((row) =>
      ["team_score", "individual_score"].includes(String(row.record_type || "").trim()) &&
      String(row.status || "").trim().toLowerCase() === "active" &&
      String(row.round_number || "") === activeRoundNumber // Ensure we only get scores for THIS round
    );

    const scores = {};
    scoreRows.forEach((row) => {
      const recordType = String(row.record_type || "").trim();
      const holeNumber = String(row.hole_number || "").trim();
      let key = "";

      if (recordType === "team_score") key = `team:${row.team_id}:hole:${holeNumber}`;
      if (recordType === "individual_score") key = `player:${row.player_id}:hole:${holeNumber}`;

      if (key) {
        scores[key] = { score: row.score || "", updatedAt: row.updated_at || "" };
      }
    });

    return res.status(200).json({
      roundNumber: activeRoundNumber,
      courseName: activeCourseName,
      loggedInPlayerId,
      loggedInPlayerName: tokenRow.player_name || "",
      loggedInTeamId: tokenRow.team_id || "",
      loggedInIsAdmin,
      holes,
      teams,
      scores
    });

  } catch (error) {
    return res.status(500).json({ error: error.message || "Unable to load scorecard." });
  }
}
