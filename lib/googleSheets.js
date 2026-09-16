import { google } from "googleapis";

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

const TAB_NAMES = {
  PLAYERS: "Players",
  COURSES: "Courses",
  DATA: "Data-Tour",
  ROUND: "round" // ⭐ NEW: Officially registering the tournament matrix tab
};

async function getSheetsClient() {
  if (!SHEET_ID) {
    throw new Error("Missing GOOGLE_SHEET_ID environment variable.");
  }

  if (!CLIENT_EMAIL || !PRIVATE_KEY) {
    throw new Error("Missing Google service account environment variables.");
  }

  const auth = new google.auth.JWT({
    email: CLIENT_EMAIL,
    key: PRIVATE_KEY,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });

  return google.sheets({ version: "v4", auth });
}

export async function getRows(tabName) {
  const sheets = await getSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${tabName}!A:Z`
  });

  const values = response.data.values || [];

  if (values.length < 2) {
    return [];
  }

  const headers = values[0].map((header) => String(header || "").trim());

  return values
    .slice(1)
    .filter((row) => row.some((cell) => String(cell || "").trim() !== ""))
    .map((row, index) => {
      const item = {
        _rowNumber: index + 2
      };

      headers.forEach((header, columnIndex) => {
        item[header] = row[columnIndex] ?? "";
      });

      return item;
    });
}

export async function appendRows(tabName, rows) {
  const sheets = await getSheetsClient();

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${tabName}!A:Z`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: rows
    }
  });
}

export async function clearRowsBelowHeader(tabName) {
  const sheets = await getSheetsClient();

  await sheets.spreadsheets.values.clear({
    spreadsheetId: SHEET_ID,
    range: `${tabName}!A2:Z`
  });
}

// --- DATA-TOUR HELPERS ---
export async function getDataRows() {
  return getRows(TAB_NAMES.DATA);
}

export async function appendDataRows(rows) {
  return appendRows(TAB_NAMES.DATA, rows);
}

export async function clearDataRowsBelowHeader() {
  return clearRowsBelowHeader(TAB_NAMES.DATA);
}

// ⭐ NEW: ROUND MATRIX HELPERS ---
export async function getRoundRows() {
  return getRows(TAB_NAMES.ROUND);
}

export async function appendRoundRows(rows) {
  return appendRows(TAB_NAMES.ROUND, rows);
}

export async function clearRoundRowsBelowHeader() {
  return clearRowsBelowHeader(TAB_NAMES.ROUND);
}

// Tool to update specific cells without deleting the rest of the row
export async function batchUpdateValues(data) {
  const sheets = await getSheetsClient();
  
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: data
    }
  });
}

export { TAB_NAMES };
