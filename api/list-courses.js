import { getRows, TAB_NAMES } from "../lib/googleSheets.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "Method not allowed."
    });
  }

  try {
    const rows = await getRows(TAB_NAMES.COURSES);

    const courses = rows
      .map((row) => {
        const courseName = String(row["Hole #"] || "").trim();

        const holes = [];

        for (let i = 1; i <= 18; i += 1) {
          const par = String(row[String(i)] || "").trim();

          holes.push({
            holeNumber: i,
            par
          });
        }

        return {
          courseName,
          holes
        };
      })
      .filter((course) => course.courseName)
      .sort((a, b) => a.courseName.localeCompare(b.courseName));

    return res.status(200).json({
      courses
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Unable to load courses."
    });
  }
}
