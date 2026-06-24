export default async function handler(req, res) {
  // 1. Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  try {
    const { password } = req.body || {};

    // 2. Direct password check (Bypassing Vercel Environment Variables)
    if (password === "James2468") {
      return res.status(200).json({
        success: true
      });
    } else {
      return res.status(401).json({
        error: "Invalid admin password."
      });
    }
    
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Internal server error during login."
    });
  }
}
