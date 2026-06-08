import { appendDataRows, getDataRows } from "../lib/googleSheets.js";
import { makeToken, namesLastNameMatches } from "../lib/playerUtils.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  try {
    const { lastName } = req.body || {};

    if (!lastName || !String(lastName).trim()) {
      return res.status(400).json({
        error: "Last name is required."
      });
    }

    const rows = await getDataRows();

    const activeRound = rows.find((row) =>
      String(row.record_type || "").trim() === "round" &&
      String(row.status || "").trim().toLowerCase() === "active"
    );

    if (!activeRound) {
      return res.status(400).json({
        error: "There is no active round."
      });
    }

    const roundId = activeRound.round_id;
    const tournamentId = activeRound.tournament_id;

    const assignedPlayers = rows.filter((row) =>
      String(row.record_type || "").trim() === "round_player" &&
      String(row.round_id || "").trim() === String(roundId || "").trim() &&
      String(row.status || "").trim().toLowerCase() === "active"
    );

    const matches = assignedPlayers.filter((row) =>
      namesLastNameMatches(row.player_name, lastName)
    );

    if (matches.length === 0) {
      return res.status(200).json({
        status: "no_match",
        players: []
      });
    }

    const playersWithTokens = await Promise.all(
      matches.map(async (player) => {
        const token = await getOrCreateToken({
          rows,
          tournamentId,
          roundId,
          player
        });

        return {
          playerId: player.player_id || "",
          playerName: player.player_name || "",
          teamId: player.team_id || "",
          teamNumber: player.team_number || "",
          token
        };
      })
    );

    if (playersWithTokens.length === 1) {
      return res.status(200).json({
        status: "single_match",
        player: playersWithTokens[0]
      });
    }

    return res.status(200).json({
      status: "multiple_matches",
      players: playersWithTokens
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
