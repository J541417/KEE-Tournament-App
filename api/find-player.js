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

    const rawCell = matchedPlayer["Cell"] || matchedPlayer["Phone Number"] || matchedPlayer["Phone"] || matchedPlayer["Cell Phone"];
    const playerId = String(rawCell || "").trim();
    
    if (!playerId) {
      return res.status(404).json({ error: "Player found, but they do not have a Cell number assigned in the database." });
    }

    const dataRows = await getRows(TAB_NAMES.DATA);
    
    // ⭐ THE FIX: Added .trim() to ignore invisible spaces in your spreadsheet
    const activeRound = dataRows.find(
      (row) => String(row.type).toLowerCase().trim() === "round" && 
               String(row.status).toLowerCase().trim() === "active"
    );

    if (!activeRound) {
      return res.status(404).json({ error: "No active round found." });
    }

    const roundId = activeRound.id;

    // Added .trim() here as well for safety
    const playerInRound = dataRows.find(
      (row) => String(row.type).toLowerCase().trim() === "player" &&
               String(row.roundId).trim() === String(roundId).trim() &&
               String(row.playerId).trim() === playerId
    );

    if (!playerInRound) {
      return res.status(404).json({ error: "You were found, but you are not associated with the active round." });
    }

    const token = `player-${playerId}-${roundId}`;

    return res.status(200).json({ token });
    
  } catch (error) {
    return res.status(500).json({ error: error.message || "An error occurred." });
  }
}
