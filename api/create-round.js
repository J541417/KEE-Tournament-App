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
    const {
      password,
      roundDate,
      courseName,
      scoringMode,
      teams
    } = req.body || {};

    if (!process.env.ADMIN_PASSWORD) {
      return res.status(500).json({
        error: "ADMIN_PASSWORD is not configured."
      });
    }

    if (!password || String(password) !== process.env.ADMIN_PASSWORD) {
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

      if (players.length < 2 || players.length > 4) {
        throw new Error(`Team ${index + 1} must have 2 to 4 players.`);
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
    
    // ⭐ NEW: Generate a unique token for this round
    const masterToken = `ADMIN-${Date.now()}`;

    const rows = [];

    // ⭐ NEW: Create the scorecard_token row so the database has a key!
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
      masterToken, // This places the token in the correct column
      "active",
      now,
      "Generated for Admin Panel"
    ]);

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
        rows.push([
          "round_player",
          tournamentId,
          roundId,
          roundNumber,
          team.teamId,
          team.teamNumber,
          player.playerId,
          player.playerName,
          player.rating || "",
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
      });
    });

    await clearDataRowsBelowHeader();
    await appendDataRows(rows);

    // ⭐ NEW: Pass the token back to the frontend in the success response
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
