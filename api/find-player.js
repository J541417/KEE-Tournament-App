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
    
    // 1. Check the PLAYERS tab
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

    // Grab their ID from the PLAYERS tab
    const playerId = String(matchedPlayer["Player ID"] || matchedPlayer["ID"] || matchedPlayer["PlayerId"] || "").trim();
    
    if (!playerId) {
      return res.status(404).json({ error: "Player found, but they do not have a Player ID assigned." });
    }

    // 2. Check the DATA tab directly using the exact headers you provided
    const dataRows = await getRows(TAB_NAMES.DATA);
    
    // We look for a row where player_id matches AND status is active
    const activePlayerRow = dataRows.find((row) => {
      const rowStatus = String(row.status || "").toLowerCase().trim();
      const rowPlayerId = String(row.player_id || row.playerId || "").trim();
      
      return rowStatus === "active" && rowPlayerId === playerId;
    });

    if (!activePlayerRow) {
      return res.status(404).json({ error: "You were found, but you are not associated with the active round." });
    }

    // Grab the exact round_id from that row
    const roundId = String(activePlayerRow.round_id || "").trim();

    if (!roundId) {
      return res.status(500).json({ error: "Found you in the active round, but the round_id is missing." });
    }

    // 3. Generate Token!
    const token = `player-${playerId}-${roundId}`;

    return res.status(200).json({ token });
    
  } catch (error) {
    return res.status(500).json({ error: error.message || "An error occurred." });
  }
}
