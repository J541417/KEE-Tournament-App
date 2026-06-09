import { getDataRows, getRows, TAB_NAMES } from "../lib/googleSheets.js";
import { isAdminValue, normalizePhone } from "../lib/playerUtils.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  try {
    const token = String(req.query.token || "").trim();

    if (!token) {
      return res.status(400).json({
        error: "Scorecard token is required."
      });
    }

    const [dataRows, courseRows, playerRows] = await Promise.all([
      getDataRows(),
      getRows(TAB_NAMES.COURSES),
      getRows(TAB_NAMES.PLAYERS)
    ]);

    const tokenRow = dataRows.find((row) =>
      String(row.record_type || "").trim() === "scorecard_token" &&
      String(row.token || "").trim() === token &&
      String(row.status || "").trim().toLowerCase() === "active"
    );

    if (!tokenRow) {
      return res.status(404).json({
        error: "Scorecard token was not found or is no longer active."
      });
    }

    const roundId = tokenRow.round_id;
    const tournamentId = tokenRow.tournament_id;

    const round = dataRows.find((row) =>
      String(row.record_type || "").trim() === "round" &&
      String(row.round_id || "").trim() === String(roundId || "").trim() &&
      String(row.status || "").trim().toLowerCase() === "active"
    );

    if (!round) {
      return res.status(404).json({
        error: "Active round was not found."
      });
    }

    const loggedInPlayerId = String(tokenRow.player_id || "").trim();

    const loggedInPlayerSheetRow = playerRows.find((row) =>
      normalizePhone(row["Phone Number"]) === loggedInPlayerId
    );

    const loggedInIsAdmin = loggedInPlayerSheetRow
      ? isAdminValue(loggedInPlayerSheetRow.Admin)
      : false;

    const courseName = String(round.course_name || "").trim();

    const course = courseRows.find((row) =>
      String(row["Hole #"] || "").trim().toLowerCase() === courseName.toLowerCase()
    );

    const holes = [];

    for (let i = 1; i <= 18; i += 1) {
      holes.push({
        holeNumber: i,
        par: course ? String(course[String(i)] || "").trim() : ""
      });
    }

    const teamRows = dataRows
      .filter((row) =>
        String(row.record_type || "").trim() === "team" &&
        String(row.round_id || "").trim() === String(roundId || "").trim() &&
        String(row.status || "").trim().toLowerCase() === "active"
      )
      .sort((a, b) => Number(a.team_number || 0) - Number(b.team_number || 0));

    const playerAssignmentRows = dataRows.filter((row) =>
      String(row.record_type || "").trim() === "round_player" &&
      String(row.round_id || "").trim() === String(roundId || "").trim() &&
      String(row.status || "").trim().toLowerCase() === "active"
    );

    const teams = teamRows.map((team) => {
      const players = playerAssignmentRows
        .filter((player) =>
          String(player.team_id || "").trim() === String(team.team_id || "").trim()
        )
        .map((player) => ({
          playerId: player.player_id || "",
          playerName: player.player_name || "",
          playerRating: player.player_rating || ""
        }));

      return {
        teamId: team.team_id || "",
        teamNumber: team.team_number || "",
        players
      };
    });

    const scoreRows = dataRows.filter((row) =>
      ["team_score", "individual_score"].includes(String(row.record_type || "").trim()) &&
      String(row.round_id || "").trim() === String(roundId || "").trim() &&
      String(row.status || "").trim().toLowerCase() === "active"
    );

    const scores = {};

    scoreRows.forEach((row) => {
      const recordType = String(row.record_type || "").trim();
      const holeNumber = String(row.hole_number || "").trim();

      let key = "";

      if (recordType === "team_score") {
        key = `team:${row.team_id}:hole:${holeNumber}`;
      }

      if (recordType === "individual_score") {
        key = `player:${row.player_id}:hole:${holeNumber}`;
      }

      if (!key) {
        return;
      }

      scores[key] = {
        score: row.score || "",
        updatedAt: row.updated_at || ""
      };
    });

    return res.status(200).json({
      tournamentId,
      roundId,
      roundNumber: round.round_number || "",
      roundDate: round.round_date || "",
      courseName: round.course_name || "",
      scoringMode: round.scoring_mode || "",
      loggedInPlayerId,
      loggedInPlayerName: tokenRow.player_name || "",
      loggedInTeamId: tokenRow.team_id || "",
      loggedInIsAdmin,
      holes,
      teams,
      scores
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Unable to load scorecard."
    });
  }
}
