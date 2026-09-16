import {
  appendDataRows,
  clearDataRowsBelowHeader,
  appendRows,
  clearTab
} from "../lib/googleSheets.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  try {
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch (e) {}
    }

    const {
      password,
      roundDate,
      courseName,
      scoringMode,
      teams,
      roundNumber: rawRoundNumber,
      isNewTournament
    } = body || {};

    const actualPassword = process.env.ADMIN_PASSWORD || "James2468";

    if (!password || String(password) !== actualPassword) {
      return res.status(401).json({ error: "Invalid admin password." });
    }

    if (!roundDate) {
      return res.status(400).json({ error: "Round date is required." });
    }

    if (!courseName) {
      return res.status(400).json({ error: "Course is required." });
    }

    if (!["team", "individual"].includes(scoringMode)) {
      return res.status(400).json({ error: "Scoring mode must be team or individual." });
    }

    if (!Array.isArray(teams) || teams.length === 0) {
      return res.status(400).json({ error: "At least one team is required." });
    }

    const roundNumber = String(rawRoundNumber || "1").trim();
    const roundId = `R${roundNumber}`;

    const normalizedTeams = teams.map((team, index) => {
      const players = Array.isArray(team.players)
        ? team.players.filter((player) => player && player.playerId && player.playerName)
        : [];

      if (players.length < 1 || players.length > 6) {
        throw new Error(`Team ${index + 1} has an invalid number of players.`);
      }

      return {
        teamNumber: index + 1,
        teamId: team.teamId || `T${index + 1}`,
        players
      };
    });

    const now = new Date().toISOString();
    const tournamentId = `T${Date.now()}`;
    const masterToken = `ADMIN-${Date.now()}`;

    // 1. Prepare Data-Tour rows (Tokens, system metadata, round players)
    const tourRows = [];

    // Master Admin Token Row
    tourRows.push([
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

    // Round Metadata Row
    tourRows.push([
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

    // 2. Prepare 'round' Matrix Tab rows
    // Format: Round | Course | Team | Player 1 | Player 2 | Player 3 | Player 4 | Score | +/- Par
    const roundMatrixRows = [];

    normalizedTeams.forEach((team) => {
      // Team Row for Data-Tour
      tourRows.push([
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

      const playerIdentifiers = [];

      team.players.forEach((player) => {
        const playerToken = `player-${player.playerId}-${roundId}`;
        playerIdentifiers.push(player.playerName || player.playerId);

        tourRows.push([
          "round_player",       // 0: record_type
          tournamentId,         // 1: tournament_id
          roundId,              // 2: round_id
          roundNumber,          // 3: round_number
          team.teamId,          // 4: team_id
          team.teamNumber,      // 5: team_number
          player.playerId,      // 6: player_id
          player.playerName,    // 7: player_name
          player.rating || "",  // 8: player_rating
          courseName,           // 9: course_name
          roundDate,            // 10: round_date
          scoringMode,          // 11: scoring_mode
          "",                   // 12: hole_number
          "",                   // 13: score
          playerToken,          // 14: token
          "active",             // 15: status
          now,                  // 16: updated_at
          "Created from admin panel"
        ]);
      });

      // Add to round matrix tab
      roundMatrixRows.push([
        roundNumber,
        courseName,
        team.teamId,
        playerIdentifiers[0] || "",
        playerIdentifiers[1] || "",
        playerIdentifiers[2] || "",
        playerIdentifiers[3] || "",
        "", // Score (Calculated during tournament)
        ""  // +/- Par (Calculated during tournament)
      ]);
    });

    // Determine whether to wipe old data or append (Round 1 / explicit new tournament = clear)
    const shouldClear = isNewTournament || roundNumber === "1";

    if (shouldClear) {
      await clearDataRowsBelowHeader();
      if (typeof clearTab === "function") {
        await clearTab("round");
      }
    }

    // Append to Data-Tour
    await appendDataRows(tourRows);

    // Append to 'round' tab matrix
    if (typeof appendRows === "function") {
      await appendRows("round", roundMatrixRows);
    } else if (typeof appendDataRows === "function") {
      await appendDataRows(roundMatrixRows, "round");
    }

    return res.status(200).json({
      success: true,
      tournamentId,
      roundId,
      roundNumber,
      token: masterToken,
      rowsWritten: tourRows.length
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Unable to create active round."
    });
  }
}
