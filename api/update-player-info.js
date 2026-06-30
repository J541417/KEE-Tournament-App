import { getRows, batchUpdateValues, TAB_NAMES } from "../lib/googleSheets.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const { firstName, lastName, cellPhone, email, birthdate, nextGolfDate } = req.body;

    if (!firstName || !lastName) {
      return res.status(400).json({ error: "First and Last name are required." });
    }

    const playerRows = await getRows(TAB_NAMES.PLAYERS);
    
    let rowIndex = -1;
    for (let i = 0; i < playerRows.length; i++) {
      const dbFirstName = String(playerRows[i].First || "").toLowerCase().trim();
      const dbLastName = String(playerRows[i].Last || "").toLowerCase().trim();
      
      if (dbFirstName === firstName.toLowerCase() && dbLastName === lastName.toLowerCase()) {
        // ⭐ UPGRADE: Uses the exact row number assigned by your Google Sheets lib
        rowIndex = playerRows[i]._rowNumber; 
        break;
      }
    }

    if (rowIndex === -1) {
      return res.status(404).json({ error: "Player not found. Please check your spelling." });
    }

    const golferFullName = `${firstName} ${lastName}`;
    const dateUpdated = new Date().toLocaleDateString(); 

    const updateData = [
      {
        range: `${TAB_NAMES.PLAYERS}!B${rowIndex}:D${rowIndex}`,
        values: [[golferFullName, firstName, lastName]]
      },
      {
        range: `${TAB_NAMES.PLAYERS}!H${rowIndex}:I${rowIndex}`,
        values: [[cellPhone, email]]
      },
      {
        range: `${TAB_NAMES.PLAYERS}!L${rowIndex}:N${rowIndex}`,
        values: [[birthdate, nextGolfDate, dateUpdated]]
      }
    ];

    await batchUpdateValues(updateData);

    return res.status(200).json({ 
      success: true, 
      message: "Player updated successfully." 
    });

  } catch (error) {
    return res.status(500).json({ error: error.message || "Failed to update player." });
  }
}
