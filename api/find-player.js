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
    
    // Filter down to only rows that are actually marked "active"
    const activeDataRows = dataRows.filter(row => String(row.status || "").toLowerCase().trim() === "active");

    if (activeDataRows.length === 0) {
      return res.status(404).json({ error: "X-RAY VISION: There are no rows in the Data tab with an 'active' status." });
    }

    // Try to find the specific player in those active rows using ID *OR* First Name
    const activePlayerRow = activeDataRows.find((row) => {
      const rowPlayerId = String(row.player_id || row.playerId || "").trim();
      const rowPlayerName = String(row.player_name || "").toLowerCase().trim();
      
      return rowPlayerId === playerId || rowPlayerName.includes(firstName);
    });

    if (!activePlayerRow) {
      // 🚨 THE X-RAY ERROR MESSAGE: Spits out exactly who is in the active round 🚨
      const availablePlayers = activeDataRows
        .filter(r => r.player_name || (r.record_type && r.record_type.includes("player")))
        .map(r => `${r.player_name} (ID: ${r.player_id})`)
        .join(" | ");
        
      return res.status(404).json({ 
        error: `X-RAY VISION: Found you as ID [${playerId}] in Players tab. But the Data tab only has these active players: ${availablePlayers || "None found with player_names"}.` 
      });
    }

    // 3. Generate Token using the exact data from the DATA tab to ensure a flawless link
    const finalRoundId = String(activePlayerRow.round_id || "").trim();
    const finalPlayerId = String(activePlayerRow.player_id || "").trim();

    if (!finalRoundId) {
      return res.status(500).json({ error: "Found you in the active round, but the round_id is blank in the data tab." });
    }

    const token = `player-${finalPlayerId}-${finalRoundId}`;

    return res.status(200).json({ token });
    
  } catch (error) {
    return res.status(500).json({ error: error.message || "An error occurred." });
  }
}
