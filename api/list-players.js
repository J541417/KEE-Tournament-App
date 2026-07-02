import { getRows, TAB_NAMES } from "../lib/googleSheets.js";
import {
  getFirstName,
  getLastName,
  isAdminValue,
  normalizePhone
} from "../lib/playerUtils.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  try {
    const rows = await getRows(TAB_NAMES.PLAYERS);

    const players = rows
      .map((row) => {
        // ⭐ THE FIX: Grab names from First/Last if Golfer column is empty
        const firstName = String(row.First || "").trim();
        const lastName = String(row.Last || "").trim();
        const fallbackName = `${firstName} ${lastName}`.trim();
        const name = String(row.Golfer || fallbackName).trim();
        
        // ⭐ THE FIX: Use the actual Player ID column!
        const rawPlayerId = String(row["Player ID"] || row["ID"] || row["PlayerId"] || "").trim();
        
        // (We can still load the phone number for display if it exists, but not as an ID)
        const rawPhone = String(row.Cell || row["Phone Number"] || row.Phone || "").trim();
        const phone = rawPhone ? normalizePhone(rawPhone) : "";
        
        const rating = String(row.Rating || "").trim();
        const email = String(row.Email || "").trim();
        const isAdmin = isAdminValue(row.Admin);

        return {
          playerId: rawPlayerId,
          playerName: name,
          firstName: firstName || getFirstName(name),
          lastName: lastName || getLastName(name),
          rating,
          phone,
          email,
          isAdmin
        };
      })
      // ⭐ THE FIX: Now this will successfully keep everyone who has a real Player ID!
      .filter((player) => player.playerName && player.playerId)
      .sort((a, b) => a.playerName.localeCompare(b.playerName));

    return res.status(200).json({
      players
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Unable to load players."
    });
  }
}
