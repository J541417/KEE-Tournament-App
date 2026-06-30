import { getRows, TAB_NAMES } from "../lib/googleSheets.js";

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    let name = "";

    // ⭐ THE ULTIMATE NAME CATCHER
    if (req.method === "POST") {
      let body = req.body;
      
      // Safety check in case Vercel receives raw text instead of JSON
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch (e) {}
      }
      
      // Check every common label the frontend might be using
      name = body?.name || body?.playerName || body?.player || body?.searchName || body?.golfer;
      
      // Bulletproof fallback: If we still don't have it, grab the first piece of text in the package
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

    // 1. Smart Search: Look for First, Last, or Full Name matches
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

    // 2. Grab the player's unique ID (their Phone Number)
    const playerId = String(matchedPlayer["Phone Number"] || "").trim();
    
    if (!playerId) {
      return res.status(404).json({ error: "Player found, but they do not have a Phone Number assigned in the database." });
    }

    // 3. Find the active round
    const dataRows = await getRows(TAB_NAMES.DATA);
    
    const activeRound = dataRows.find(
      (row) => String(row.type).toLowerCase() === "round" && 
               String(row.status).toLowerCase() === "active"
    );

    if (!activeRound) {
      return res.status(404).json({ error: "No active round found." });
    }

    const roundId = activeRound.id;

    // 4. Verify the player is actually in this active round
    const playerInRound = dataRows.find(
      (row) => String(row.type).toLowerCase() === "player" &&
               String(row.roundId) === String(roundId) &&
               String(row.playerId) === playerId
    );

    if (!playerInRound) {
      return res.status(404).json({ error: "You were found, but you are not associated with the active round." });
    }

    // 5. Success! Generate the login token
    const token = `player-${playerId}-${roundId}`;

    return res.status(200).json({ token });
    
  } catch (error) {
    return res.status(500).json({ error: error.message || "An error occurred." });
  }
}
