import { getRows, TAB_NAMES } from "../lib/googleSheets.js";

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    let name = "";

    if (req.method === "POST") {
      let body = req.body;
      
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch (e) {}
      }
      
      name = body?.name || body?.playerName || body?.player || body?.searchName || body?.golfer;
      
      if (!name && typeof body === "object" && body !== null) {
        name = Object.values(body).find(val => typeof val === "string");
      }
    } else {
      name = req.query?.name || req.query?.playerName;
    }

    if (!name) {
      return res.status(400).json({ error: "Name is required." });
    }

    const searchInput = String(name).toLowerCase().trim();
    const players = await getRows(TAB_NAMES.PLAYERS);

    let matchedPlayer = null;

    for (const player of players) {
      const firstName = String(player.First || "").toLowerCase().trim();
      const lastName = String(player.Last || "").toLowerCase().trim();
      const fullName = `${firstName} ${lastName}`;

      if (
        firstName === searchInput ||
        lastName === searchInput ||
        fullName === searchInput
      ) {
        matchedPlayer = player;
        break;
      }
    }

    if (!matchedPlayer) {
      return res.status(404).json({ error: "No player was found for that name." });
    }

    const playerId = String(matchedPlayer["Player ID"] || matchedPlayer["ID"] || matchedPlayer["PlayerId"] || "").trim();
    
    if (!playerId) {
      return res.status(404).json({ error: "Player found, but they do not have a Player ID assigned in the database." });
    }

    const dataRows = await getRows(TAB_NAMES.DATA);
    
    const activeRound = dataRows.find((row) => {
      const recType = String(row.record_type || row.type || "").toLowerCase().trim();
      const status = String(row.status || "").toLowerCase().trim();
      return (recType === "round" || recType === "round_info") && status === "active";
    });

    if (!activeRound) {
      return res.status(404).json({ error: "No active round found." });
    }

    const roundId = String(activeRound.id || activeRound.round_id || "").trim();

    // ⭐ THE OMNI-SEARCH FIX
    const playerInRound = dataRows.find((row) => {
      const recType = String(row.record_type || row.type || "").toLowerCase().trim();
      
      // Make sure this is actually a player row
      if (recType !== "player" && recType !== "round_player" && recType !== "team_player") {
        return false;
      }

      // Grab every single value in this row, no matter what the column header is
      const allRowValues = Object.values(row).map(val => String(val).trim());
      
      // If the Round ID and Player ID both exist anywhere in this row, it's a match!
      const hasRoundId = allRowValues.includes(roundId);
      const hasPlayerId = allRowValues.includes(playerId);
      
      return hasRoundId && hasPlayerId;
    });

    if (!playerInRound) {
      return res.status(404).json({ error: "You were found, but you are not associated with the active round." });
    }

    const token = `player-${playerId}-${roundId}`;

    return res.status(200).json({ token });
    
  } catch (error) {
    return res.status(500).json({ error: error.message || "An error occurred." });
  }
}
