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

    // ⭐ NEW: Grab all teams attached to this specific round
    const teamRows = rows.filter((row) => 
      String(row.record_type || "").trim() === "team" &&
      String(row.round_id || "").trim() === String(activeRound.round_id || "").trim() &&
      String(row.status || "").trim().toLowerCase() === "active"
    );

    // ⭐ NEW: Grab all players attached to this specific round
    const playerRows = rows.filter((row) => 
      String(row.record_type || "").trim() === "round_player" &&
      String(row.round_id || "").trim() === String(activeRound.round_id || "").trim() &&
      String(row.status || "").trim().toLowerCase() === "active"
    );

    // ⭐ NEW: Bundle the players into their correct team boxes
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

    return res.status(200).json({
      active: true,
      tournamentId: activeRound.tournament_id || "",
      roundId: activeRound.round_id || "",
      roundNumber: activeRound.round_number || "",
      courseName: activeRound.course_name || "",
      roundDate: activeRound.round_date || "",
      scoringMode: activeRound.scoring_mode || "",
      token: tokenRow ? String(tokenRow.token || "").trim() : "",
      teams: teams // Send the fully built teams back to the frontend!
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Unable to load active round."
    });
  }
}
