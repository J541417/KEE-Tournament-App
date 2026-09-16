import {
  appendDataRows,
  clearDataRowsBelowHeader,
  appendRoundRows,
  clearRoundRowsBelowHeader
} from "../lib/googleSheets.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch (e) {}
    }

    const {
      password,
      tournamentName, // ⭐ NEW: Captures the Tournament Name
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

    if (!roundDate) return res.status(400).json({ error: "Round date is required." });
    if (!courseName) return res.status(400).json({ error: "Course is required." });
    if (!["team", "individual"].includes(scoringMode)) return res.status(400).json({ error: "Scoring mode must be team or individual." });
    if (!Array.isArray(teams) || teams.length === 0) return res.status(400).json({ error: "At least one team is required." });

    const roundNumber = String(rawRoundNumber || "1").trim();
    const roundId = `R${roundNumber}`;
    const tName = tournamentName || "Kee Golf Tournament"; // Fallback name

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

    const tourRows = [];
    const roundMatrixRows = [];

    // Master Admin Token Row
    tourRows.push([
      "scorecard_token", tournamentId, roundId, roundNumber, "", "", "admin", "Admin", "", "", "", "", "", "", masterToken, "active", now, "Generated for Admin Panel"
    ]);

    // Round Row (⭐ Saves the Tournament Name in the notes column so the scorecard can read it)
    tourRows.push([
      "round", tournamentId, roundId, roundNumber, "", "", "", "", "", courseName, roundDate, scoringMode, "", "", "", "active", now, tName
    ]);

    normalizedTeams.forEach((team) => {
      // Team Row
      tourRows.push([
        "team", tournamentId, roundId, roundNumber, team.teamId, team.teamNumber, "", "", "", "", "", "", "", "", "", "active", now, "Created from admin panel"
      ]);

      const playerIdentifiers = [];

      team.players.forEach((player) => {
        const playerToken = `player-${player.playerId}-${roundId}`;
        playerIdentifiers.push(player.playerName || player.playerId);

        tourRows.push([
          "round_player", tournamentId, roundId, roundNumber, team.teamId, team.teamNumber, player.playerId, player.playerName, player.rating || "", courseName, roundDate, scoringMode, "", "", playerToken, "active", now, "Created from admin panel"
        ]);
      });

      // ⭐ THE MATRIX TAB ROW: Round | Course | Team | Player 1 | Player 2 | Player 3 | Player 4 | Score | +/- Par
      roundMatrixRows.push([
        roundNumber,
        courseName,
        team.teamId,
        playerIdentifiers[0] || "",
        playerIdentifiers[1] || "",
        playerIdentifiers[2] || "",
        playerIdentifiers[3] || "",
        "", // Score
        ""  // +/- Par
      ]);
    });

    const shouldClear = isNewTournament || roundNumber === "1";

    // 1. Wipe old data if starting a New Tournament
    if (shouldClear) {
      await clearDataRowsBelowHeader();
      await clearRoundRowsBelowHeader();
    }

    // 2. Write to BOTH tabs simultaneously
    await appendDataRows(tourRows);
    await appendRoundRows(roundMatrixRows);

    return res.status(200).json({
      success: true,
      tournamentId,
      roundId,
      roundNumber,
      token: masterToken,
      rowsWritten: tourRows.length
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Unable to create active round." });
  }
}
