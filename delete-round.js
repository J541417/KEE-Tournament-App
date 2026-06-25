import { clearDataRowsBelowHeader } from "../lib/googleSheets.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  try {
    const { password } = req.body || {};
    
    // Fallback to hardcoded password if Vercel environment variables are missing
    const actualPassword = process.env.ADMIN_PASSWORD || "James2468";

    if (!password || String(password) !== actualPassword) {
      return res.status(401).json({
        error: "Invalid admin password."
      });
    }

    // This perfectly mirrors the secure wipe function from create-round.js
    await clearDataRowsBelowHeader();

    return res.status(200).json({
      success: true,
      message: "Active round successfully deleted."
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Unable to delete active round."
    });
  }
}
