import { appendDataRows, getDataRows, getRows, TAB_NAMES } from "../lib/googleSheets.js";
import {
  isAdminValue,
  makeToken,
  nameMatchesSearch,
  normalizePhone
} from "../lib/playerUtils.js";

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({
      error: `Method not allowed: ${req.method}`
    });
  }

  try {
    const searchValue =
      req.method === "GET"
        ? req.query.search || req.query.lastName
        : req.body?.search || req.body?.lastName;

    if (!searchValue || !String(searchValue).trim()) {
      return res.status(400).json({
        error: "Name is required."
      });
    }

    const [dataRows, playerRows] = await Promise.all([
      getDataRows(),
      getRows(TAB_NAMES.PLAYERS)
    ]);

    const activeRound = dataRows.find((row) =>
      String(row.record_type || "").trim() === "round" &&
      String(row.status || "").trim().toLowerCase() === "active"
    );

    const allMatchingPlayers = playerRows
      .map((row) => ({
        playerId: normalizePhone(row["Phone Number"]),
        playerName: String(row.Golfer || "").trim(),
        playerRating: String(row.Rating || "").trim(),
        isAdmin: isAdminValue(row.Admin)
      }))
      .filter((player) =>
        player.playerId &&
        player.playerName &&
        nameMatchesSearch(player.playerName, searchValue)
      );

    if (allMatchingPlayers.length === 0) {
      return res.status(200).json({
        status: "no_match",
        players: []
      });
    }

    const playersWithRoundInfo = await Promise.all(
      allMatchingPlayers.map(async (player) => {
        const roundPlayer = activeRound
          ? dataRows.find((row) =>
              String(row.record_type || "").trim() === "round_player" &&
              String(row.round_id || "").trim() === String(activeRound.round_id || "").trim() &&
              String(row.player_id || "").trim() === String(player.playerId || "").trim() &&
              String(row.status || "").trim().toLowerCase() === "active"
            )
          : null;

        let token = "";

        if (activeRound && roundPlayer) {
          token = await getOrCreateToken({
            rows: dataRows,
            tournamentId: activeRound.tournament_id,
            roundId: activeRound.round_id,
            player: roundPlayer
          });
        }

        return {
          playerId: player.playerId,
          playerName: player.playerName,
          playerRating: player.playerRating,
          isAdmin: player.isAdmin,
          teamId: roundPlayer?.team_id || "",
          teamNumber: roundPlayer?.team_number || "",
          token
        };
      })
    );

    if (playersWithRoundInfo.length === 1) {
      return res.status(200).json({
        status: "single_match",
        player: playersWithRoundInfo[0]
      });
    }

    return res.status(200).json({
      status: "multiple_matches",
      players: playersWithRoundInfo
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Unable to find player."
    });
  }
}

async function getOrCreateToken({ rows, tournamentId, roundId, player }) {
  const existing = rows.find((row) =>
    String(row.record_type || "").trim() === "scorecard_token" &&
    String(row.round_id || "").trim() === String(roundId || "").trim() &&
    String(row.player_id || "").trim() === String(player.player_id || "").trim() &&
    String(row.status || "").trim().toLowerCase() === "active"
  );

  if (existing?.token) {
    return existing.token;
  }

  const token = makeToken();
  const updatedAt = new Date().toISOString();

  await appendDataRows([
    [
      "scorecard_token",
      tournamentId || "",
      roundId || "",
      "",
      player.team_id || "",
      player.team_number || "",
      player.player_id || "",
      player.player_name || "",
      player.player_rating || "",
      "",
      "",
      "",
      "",
      "",
      token,
      "active",
      updatedAt,
      "Created from user landing page"
    ]
  ]);

  return token;
}
