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

    // ⭐ NEW: Find the matching token for the active round!
    const tokenRow = rows.find((row) =>
      String(row.record_type || "").trim() === "scorecard_token" &&
      String(row.round_id || "").trim() === String(activeRound.round_id || "").trim() &&
      String(row.status || "").trim().toLowerCase() === "active"
    );

    return res.status(200).json({
      active: true,
      tournamentId: activeRound.tournament_id || "",
      roundId: activeRound.round_id || "",
      roundNumber: activeRound.round_number || "",
      courseName: activeRound.course_name || "",
      roundDate: activeRound.round_date || "",
      scoringMode: activeRound.scoring_mode || "",
      // ⭐ NEW: Send the token back to the Admin page
      token: tokenRow ? String(tokenRow.token || "").trim() : "" 
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Unable to load active round."
    });
  }
}
