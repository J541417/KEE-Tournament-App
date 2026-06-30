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
    let firstName = "";

    for (const player of players) {
      firstName = String(player.First || "").toLowerCase().trim();
      const lastName = String(player.Last || "").toLowerCase().trim();
      const fullName = `${firstName} ${lastName}`;

      if (firstName === searchInput || lastName === searchInput || fullName === searchInput) {
        matchedPlayer = player;
        break;
      }
    }

    if (!matchedPlayer) {
      return res.status(404).json({ error: "No player was found for that name in the Players tab." });
    }

    const playerId = String(matchedPlayer["Player ID"] || matchedPlayer["ID"] || matchedPlayer["PlayerId"] || "").trim();
    
    if (!playerId) {
      return res.status(404).json({ error: "Player found, but they do not have a Player ID assigned." });
    }

    // 2. Look at the DATA tab
    const dataRows = await getRows(TAB_NAMES.DATA);
    
    const activeDataRows = dataRows.filter(row => String(row.status || "").toLowerCase().trim() === "active");

    if (activeDataRows.length === 0) {
      return res.status(404).json({ error: "There are no rows in the Data tab with an 'active' status." });
    }

    const activePlayerRow = activeDataRows.find((row) => {
      const rowPlayerId = String(row.player_id || row.playerId || "").trim();
      const rowPlayerName = String(row.player_name || "").toLowerCase().trim();
      
      return rowPlayerId === playerId || rowPlayerName.includes(firstName);
    });

    if (!activePlayerRow) {
      return res.status(404).json({ 
        error: "You were found, but you are not associated with the active round."
      });
    }

    // ⭐ THE FIX: Read the exact token directly from your database's 'token' column!
    const dbToken = String(activePlayerRow.token || "").trim();
    
    // (Fallback to the manufactured one just in case the column is somehow blank)
    const finalRoundId = String(activePlayerRow.round_id || "").trim();
    const finalPlayerId = String(activePlayerRow.player_id || "").trim();
    const token = dbToken ? dbToken : `player-${finalPlayerId}-${finalRoundId}`;

    return res.status(200).json({ token });
    
  } catch (error) {
    return res.status(500).json({ error: error.message || "An error occurred." });
  }
}
