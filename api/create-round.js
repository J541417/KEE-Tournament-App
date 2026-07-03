import {
  appendDataRows,
  clearDataRowsBelowHeader
} from "../lib/googleSheets.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  try {
    // ⭐ THE FIX: Ultimate Catcher ensures we never drop Team 2's data
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch (e) {}
    }

    const {
      password,
      roundDate,
      courseName,
      scoringMode,
      teams
    } = body || {};

    const actualPassword = process.env.ADMIN_PASSWORD || "James2468";

    if (!password || String(password) !== actualPassword) {
      return res.status(401).json({
        error: "Invalid admin password."
      });
    }

    if (!roundDate) {
      return res.status(400).json({
        error: "Round date is required."
      });
    }

    if (!courseName) {
      return res.status(400).json({
        error: "Course is required."
      });
    }

    if (!["team", "individual"].includes(scoringMode)) {
      return res.status(400).json({
        error: "Scoring mode must be team or individual."
      });
    }

    if (!Array.isArray(teams) || teams.length === 0) {
      return res.status(400).json({
        error: "At least one team is required."
      });
    }

    const normalizedTeams = teams.map((team, index) => {
      const players = Array.isArray(team.players)
        ? team.players.filter((player) => player && player.playerId && player.playerName)
        : [];

      // Relaxed team sizing just in case of weird roster counts
      if (players.length < 1 || players.length > 6) {
        throw new Error(`Team ${index + 1} has an invalid number of players.`);
      }

      return {
        teamNumber: index + 1,
        teamId: `T${index + 1}`,
        players
      };
    });

    const now = new Date().toISOString();
    const tournamentId = `T${Date.now()}`;
    const roundId = "R1";
    const roundNumber = "1";
    
    const masterToken = `ADMIN-${Date.now()}`;

    const rows = [];

    // Master Admin Token Row
    rows.push([
      "scorecard_token",
      tournamentId,
      roundId,
      roundNumber,
      "",
      "",
      "admin",
      "Admin",
      "",
      "",
      "",
      "",
      "",
      "",
      masterToken, 
      "active",
      now,
      "Generated for Admin Panel"
    ]);

    // Round Row
    rows.push([
      "round",
      tournamentId,
      roundId,
      roundNumber,
      "",
      "",
      "",
      "",
      "",
      courseName,
      roundDate,
      scoringMode,
      "",
      "",
      "",
      "active",
      now,
      "Created from admin panel"
    ]);

    normalizedTeams.forEach((team) => {
      // Team Row
      rows.push([
        "team",
        tournamentId,
        roundId,
        roundNumber,
        team.teamId,
        team.teamNumber,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "active",
        now,
        "Created from admin panel"
      ]);

      team.players.forEach((player) => {
        // ⭐ THE FIX: Generate the token and explicitly put it in the database!
        const playerToken = `player-${player.playerId}-${roundId}`;

        rows.push([
          "round_player",      // 0: record_type
          tournamentId,        // 1: tournament_id
          roundId,             // 2: round_id
          roundNumber,         // 3: round_number
          team.teamId,         // 4: team_id
          team.teamNumber,     // 5: team_number
          player.playerId,     // 6: player_id
          player.playerName,   // 7: player_name
          player.rating || "", // 8: player_rating
          "",                  // 9: course_name
          "",                  // 10: round_date
          "",                  // 11: scoring_mode
          "",                  // 12: hole_number
          "",                  // 13: score
          playerToken,         // 14: token ⭐ WRITING IT DIRECTLY TO THE SHEET
          "active",            // 15: status
          now,                 // 16: updated_at
          "Created from admin panel" // 17: notes
        ]);
      });
    });

    await clearDataRowsBelowHeader();
    await appendDataRows(rows);

    return res.status(200).json({
      success: true,
      tournamentId,
      roundId,
      token: masterToken,
      rowsWritten: rows.length
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Unable to create active round."
    });
  }
}
