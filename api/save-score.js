import { appendDataRows, getDataRows, getRows } from "../lib/googleSheets.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const {
      token,
      scoringMode,
      roundId,
      teamId,
      playerId,
      holeNumber,
      score,
      targetRound,   // ⭐ NEW: Allow frontend to specify which Round this score belongs to
      targetCourse   // ⭐ NEW: Allow frontend to specify the Course
    } = req.body || {};

    if (!token) return res.status(400).json({ error: "Scorecard token is required." });
    if (!roundId) return res.status(400).json({ error: "Round ID is required." });
    if (!holeNumber) return res.status(400).json({ error: "Hole number is required." });

    // Safely handles blanks without crashing
    let finalScore = "";
    if (score !== undefined && score !== null && String(score).trim() !== "") {
      const numericScore = Number(score);
      if (!Number.isInteger(numericScore) || numericScore < 1 || numericScore > 20) {
        return res.status(400).json({ error: "Score must be a whole number between 1 and 20 (or left blank)." });
      }
      finalScore = numericScore;
    }

    if (!["team", "individual"].includes(scoringMode)) {
      return res.status(400).json({ error: "Scoring mode must be team or individual." });
    }

    // ⭐ NEW: Fetch both Data-Tour AND the new 'round' matrix tab
    const [rows, tournamentRoundRows] = await Promise.all([
      getDataRows(),
      getRows("round")
    ]);

    let tokenRow = rows.find((row) =>
      String(row.token || "").trim() === String(token || "").trim() &&
      String(row.round_id || row.roundId || "").trim() === String(roundId || "").trim() &&
      String(row.status || "").trim().toLowerCase() === "active"
    );

    if (!tokenRow && String(token).startsWith("player-")) {
      const parts = String(token).split("-");
      if (parts.length >= 3) {
        const pId = parts[1];
        tokenRow = rows.find((row) => 
          (String(row.record_type || "").trim() === "round_player" || String(row.record_type || "").trim() === "player") &&
          String(row.player_id || row.playerId || "").trim() === pId &&
          String(row.round_id || row.roundId || "").trim() === String(roundId).trim() &&
          String(row.status || "").trim().toLowerCase() === "active"
        );
      }
    }

    if (!tokenRow) {
      return res.status(403).json({ error: "Invalid or expired scorecard token." });
    }

    // ⭐ NEW: Determine the active Round and Course for this specific score
    let activeRoundNumber = targetRound;
    let activeCourseName = targetCourse;
    const loggedInPlayerId = String(tokenRow.player_id || tokenRow.playerId || "").trim();

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

    const now = new Date().toISOString();
    const isAdminToken = loggedInPlayerId.toLowerCase() === "admin";

    if (scoringMode === "team") {
      if (!teamId) return res.status(400).json({ error: "Team ID is required for team scoring." });

      const authorizedForTeam = isAdminToken || String(tokenRow.team_id || "").trim() === String(teamId || "").trim();
      if (!authorizedForTeam) return res.status(403).json({ error: "You are not authorized to score for this team." });

      const targetTeamRow = rows.find(row => 
        String(row.record_type || "").trim() === "team" && 
        String(row.team_id || "").trim() === String(teamId).trim() &&
        String(row.round_id || row.roundId || "").trim() === String(roundId).trim()
      ) || tokenRow;

      await appendDataRows([
        [
          "team_score",
          targetTeamRow.tournament_id || "",
          roundId,
          activeRoundNumber || targetTeamRow.round_number || "", // ⭐ Saves Round (1-10)
          teamId,
          targetTeamRow.team_number || "",
          "",
          "",
          activeCourseName || "", // ⭐ Saves Course Name exactly where the database expects it
          "",
          "",
          "team",
          holeNumber,
          finalScore,
          "",
          "active",
          now,
          isAdminToken ? "Score entered by Admin" : "Score entered from scorecard"
        ]
      ]);

      return res.status(200).json({ success: true });
    }

    if (scoringMode === "individual") {
      if (!playerId) return res.status(400).json({ error: "Player ID is required for individual scoring." });

      const authorizedForPlayer = isAdminToken || String(tokenRow.player_id || tokenRow.playerId || "").trim() === String(playerId || "").trim();
      if (!authorizedForPlayer) return res.status(403).json({ error: "You are not authorized to score for this player." });

      const targetPlayerRow = rows.find(row => 
        (String(row.record_type || "").trim() === "round_player" || String(row.record_type || "").trim() === "player") && 
        String(row.player_id || row.playerId || "").trim() === String(playerId).trim() &&
        String(row.round_id || row.roundId || "").trim() === String(roundId).trim()
      ) || tokenRow;

      await appendDataRows([
        [
          "individual_score",
          targetPlayerRow.tournament_id || "",
          roundId,
          activeRoundNumber || targetPlayerRow.round_number || "", // ⭐ Saves Round (1-10)
          targetPlayerRow.team_id || "",
          targetPlayerRow.team_number || "",
          playerId,
          targetPlayerRow.player_name || "",
          activeCourseName || "", // ⭐ Saves Course Name
          "",
          "",
          "individual",
          holeNumber,
          finalScore,
          "",
          "active",
          now,
          isAdminToken ? "Score entered by Admin" : "Score entered from scorecard"
        ]
      ]);

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: "Unsupported scoring mode." });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Unable to save score." });
  }
}
