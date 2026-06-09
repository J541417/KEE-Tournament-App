export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  try {
    const { password } = req.body || {};

    if (!process.env.ADMIN_PASSWORD) {
      return res.status(500).json({
        error: "ADMIN_PASSWORD is not configured."
      });
    }

    if (!password || String(password) !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({
        error: "Invalid admin password."
      });
    }

    return res.status(200).json({
      success: true
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Unable to verify admin password."
    });
  }
}
