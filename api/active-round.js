import { getDataRows } from "../lib/googleSheets.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  try {
    const rows = await getDataRows();

    const activeRound = rows.find((row) =>
      String(row.record_type || "").trim() === "round" &&
      String(row.status || "").trim().toLowerCase() === "active"
    );

    if (!activeRound) {
      return res.status(200).json({
        active: false
      });
    }

    const tokenRow = rows.find((row) =>
      String(row.record_type || "").trim() === "scorecard_token" &&
      String(row.round_id || "").trim() === String(activeRound.round_id || "").trim() &&
      String(row.status || "").trim().toLowerCase() === "active"
    );

    const teamRows = rows.filter((row) => 
      String(row.record_type || "").trim() === "team" &&
      String(row.round_id || "").trim() === String(activeRound.round_id || "").trim() &&
      String(row.status || "").trim().toLowerCase() === "active"
    );

    const playerRows = rows.filter((row) => 
      String(row.record_type || "").trim() === "round_player" &&
      String(row.round_id || "").trim() === String(activeRound.round_id || "").trim() &&
      String(row.status || "").trim().toLowerCase() === "active"
    );

    const teams = teamRows.map((team) => {
      const teamPlayers = playerRows
        .filter((p) => String(p.team_id || "").trim() === String(team.team_id || "").trim())
        .map((p) => ({
          playerId: p.player_id || "",
          playerName: p.player_name || ""
        }));
      
      return {
        teamId: team.team_id || "",
        teamNumber: team.team_number || "",
        players: teamPlayers
      };
    });

    // ⭐ DATE TRANSLATOR FIX
    let displayDate = activeRound.round_date || "";
    if (!isNaN(displayDate) && Number(displayDate) > 40000) {
      // Translates the Google Sheet 5-digit number into YYYY-MM-DD
      const jsDate = new Date(Math.round((Number(displayDate) - 25569) * 86400 * 1000));
      displayDate = jsDate.toISOString().split("T")[0];
    }

    return res.status(200).json({
      active: true,
      tournamentId: activeRound.tournament_id || "",
      roundId: activeRound.round_id || "",
      roundNumber: activeRound.round_number || "",
      courseName: activeRound.course_name || "",
      roundDate: displayDate, // Send the safely translated date
      scoringMode: activeRound.scoring_mode || "",
      token: tokenRow ? String(tokenRow.token || "").trim() : "",
      teams: teams
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Unable to load active round."
    });
  }
}
