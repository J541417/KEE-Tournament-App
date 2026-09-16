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
      tournamentName,
      roundDate,
      courseName,
      scoringMode,
      teams,
      roundNumber: rawRoundNumber,
      isNewTournament
    } = body || {};

    const actualPassword = process.env.ADMIN_PASSWORD || "James2468";
    if (!password || String(password) !== actualPassword) return res.status(401).json({ error: "Invalid admin password." });
    if (!roundDate) return res.status(400).json({ error: "Round date is required." });
    if (!courseName) return res.status(400).json({ error: "Course is required." });
    if (!Array.isArray(teams) || teams.length === 0) return res.status(400).json({ error: "At least one team is required." });

    const roundNumber = String(rawRoundNumber || "1").trim();
    const roundId = `R${roundNumber}`;
    const tName = tournamentName || "Kee Golf Tournament"; 

    const normalizedTeams = teams.map((team, index) => {
      const players = Array.isArray(team.players) ? team.players.filter((p) => p && p.playerId) : [];
      return { teamNumber: index + 1, teamId: team.teamId || `T${index + 1}`, players };
    });

    const now = new Date().toISOString();
    const tournamentId = `T${Date.now()}`;
    const masterToken = `ADMIN-${Date.now()}`;

    const tourRows = [];
    const roundMatrixRows = [];

    // Tokens & Metadata
    tourRows.push(["scorecard_token", tournamentId, roundId, roundNumber, "", "", "admin", "Admin", "", "", "", "", "", "", masterToken, "active", now, "Admin Panel"]);
    tourRows.push(["round", tournamentId, roundId, roundNumber, "", "", "", "", "", courseName, roundDate, scoringMode || "team", "", "", "", "active", now, tName]);

    normalizedTeams.forEach((team) => {
      tourRows.push(["team", tournamentId, roundId, roundNumber, team.teamId, team.teamNumber, "", "", "", "", "", "", "", "", "", "active", now, ""]);

      const playerIdentifiers = [];
      team.players.forEach((player) => {
        const playerToken = `player-${player.playerId}-${roundId}`;
        playerIdentifiers.push(player.playerName || player.playerId);
        tourRows.push(["round_player", tournamentId, roundId, roundNumber, team.teamId, team.teamNumber, player.playerId, player.playerName, "", courseName, roundDate, scoringMode || "team", "", "", playerToken, "active", now, ""]);
      });

      // Matrix Row
      roundMatrixRows.push([
        roundNumber, courseName, team.teamId,
        playerIdentifiers[0] || "", playerIdentifiers[1] || "", playerIdentifiers[2] || "", playerIdentifiers[3] || "",
        "", ""
      ]);
    });

    const shouldClear = isNewTournament || roundNumber === "1";

    // 1. Wipe old data
    if (shouldClear) {
      await clearDataRowsBelowHeader();
      try {
        await clearRoundRowsBelowHeader();
      } catch (clearErr) {
        console.warn("Could not clear round tab:", clearErr.message);
      }
    }

    // 2. Write to Data-Tour (We know this works)
    await appendDataRows(tourRows);

    // 3. Write to 'round' with a dedicated Error Catcher
    let matrixErrorMessage = null;
    try {
      await appendRoundRows(roundMatrixRows);
    } catch (matrixErr) {
      matrixErrorMessage = matrixErr.message;
    }

    // If the matrix fails, we send a 500 error so your browser alerts you immediately
    if (matrixErrorMessage) {
       return res.status(500).json({ 
         error: `Google Sheets Error on 'round' tab: ${matrixErrorMessage}` 
       });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Unable to create active round." });
  }
}
