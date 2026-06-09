import { getRows, TAB_NAMES } from "../lib/googleSheets.js";
import { getLastName, normalizePhone } from "../lib/playerUtils.js";

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
        const name = String(row.Golfer || "").trim();
        const phone = normalizePhone(row["Phone Number"]);
        const rating = String(row.Rating || "").trim();
        const email = String(row.Email || "").trim();

        return {
          playerId: phone,
          playerName: name,
          lastName: getLastName(name),
          rating,
          phone,
          email
        };
      })
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
