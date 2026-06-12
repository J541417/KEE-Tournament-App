import { appendDataRows, getDataRows } from "../lib/googleSheets.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  try {
    const {
      token,
      scoringMode,
      roundId,
      teamId,
      playerId,
      holeNumber,
      score
    } = req.body || {};

    if (!token) {
      return res.status(400).json({
        error: "Scorecard token is required."
      });
    }

    if (!roundId) {
      return res.status(400).json({
        error: "Round ID is required."
      });
    }

    if (!holeNumber) {
      return res.status(400).json({
        error: "Hole number is required."
      });
    }

    if (score === undefined || score === null || String(score).trim() === "") {
      return res.status(400).json({
        error: "Score is required."
      });
    }

    const numericScore = Number(score);

    if (!Number.isInteger(numericScore) || numericScore < 1 || numericScore > 20) {
      return res.status(400).json({
        error: "Score must be a whole number between 1 and 20."
      });
    }

    if (!["team", "individual"].includes(scoringMode)) {
      return res.status(400).json({
        error: "Scoring mode must be team or individual."
      });
    }

    const rows = await getDataRows();

    const tokenRow = rows.find((row) =>
      String(row.record_type || "").trim() === "scorecard_token" &&
      String(row.token || "").trim() === String(token || "").trim() &&
      String(row.round_id || "").trim() === String(roundId || "").trim() &&
      String(row.status || "").trim().toLowerCase() === "active"
    );

    if (!tokenRow) {
      return res.status(403).json({
        error: "Invalid or expired scorecard token."
      });
    }

    const now = new Date().toISOString();

    // ⭐ THE VIP PASS: Check if the person saving the score is using the master Admin token
    const isAdminToken = String(tokenRow.player_id || "").trim().toLowerCase() === "admin";

    if (scoringMode === "team") {
      if (!teamId) {
        return res.status(400).json({
          error: "Team ID is required for team scoring."
        });
      }

      // ⭐ OVERRIDE: Allow if it is their team OR if they are the admin
      const authorizedForTeam = isAdminToken || String(tokenRow.team_id || "").trim() === String(teamId || "").trim();

      if (!authorizedForTeam) {
        return res.status(403).json({
          error: "You are not authorized to score for this team."
        });
      }

      // If Admin is saving, fetch the actual team's details so the Google Sheet stays accurate
      const targetTeamRow = rows.find(row => 
        String(row.record_type || "").trim() === "team" && 
        String(row.team_id || "").trim() === String(teamId).trim() &&
        String(row.round_id || "").trim() === String(roundId).trim()
      ) || tokenRow;

      await appendDataRows([
        [
          "team_score",
          targetTeamRow.tournament_id || "",
          roundId,
          targetTeamRow.round_number || "",
          teamId,
          targetTeamRow.team_number || "",
          "",
          "",
          "",
          "",
          "",
          "team",
          holeNumber,
          numericScore,
          "",
          "active",
          now,
          isAdminToken ? "Score entered by Admin" : "Score entered from scorecard"
        ]
      ]);

      return res.status(200).json({
        success: true
      });
    }

    if (scoringMode === "individual") {
      if (!playerId) {
        return res.status(400).json({
          error: "Player ID is required for individual scoring."
        });
      }

      // ⭐ OVERRIDE: Allow if it is their score OR if they are the admin
      const authorizedForPlayer = isAdminToken || String(tokenRow.player_id || "").trim() === String(playerId || "").trim();

      if (!authorizedForPlayer) {
        return res.status(403).json({
          error: "You are not authorized to score for this player."
        });
      }

      // If Admin is saving, fetch the actual player's details so the Google Sheet stays accurate
      const targetPlayerRow = rows.find(row => 
        String(row.record_type || "").trim() === "round_player" && 
        String(row.player_id || "").trim() === String(playerId).trim() &&
        String(row.round_id || "").trim() === String(roundId).trim()
      ) || tokenRow;

      await appendDataRows([
        [
          "individual_score",
          targetPlayerRow.tournament_id || "",
          roundId,
          targetPlayerRow.round_number || "",
          targetPlayerRow.team_id || "",
          targetPlayerRow.team_number || "",
          playerId,
          targetPlayerRow.player_name || "",
          "",
          "",
          "",
          "individual",
          holeNumber,
          numericScore,
          "",
          "active",
          now,
          isAdminToken ? "Score entered by Admin" : "Score entered from scorecard"
        ]
      ]);

      return res.status(200).json({
        success: true
      });
    }

    return res.status(400).json({
      error: "Unsupported scoring mode."
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Unable to save score."
    });
  }
}
