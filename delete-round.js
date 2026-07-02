import { clearDataRowsBelowHeader } from "../lib/googleSheets.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  try {
    // ⭐ THE FIX: Safely parse the package so it never misses the password!
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch (e) {}
    }

    const password = body?.password;
    
    // Fallback to hardcoded password if Vercel environment variables are missing
    const actualPassword = process.env.ADMIN_PASSWORD || "James2468";

    if (!password || String(password) !== String(actualPassword)) {
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
