export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  try {
    const { password } = req.body || {};
    
    // ⭐ THE FIX: Hardcoded fallback so you never get locked out
    const actualPassword = process.env.ADMIN_PASSWORD || "James2468";

    if (!password || String(password) !== String(actualPassword)) {
      return res.status(401).json({
        error: "Invalid admin password."
      });
    }

    // If it matches, let them in!
    return res.status(200).json({
      success: true,
      message: "Login successful"
    });
    
  } catch (error) {
    return res.status(500).json({
      error: "An error occurred during login."
    });
  }
}
