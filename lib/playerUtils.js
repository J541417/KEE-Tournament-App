export function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

export function getLastName(fullName) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "";
  }

  return parts[parts.length - 1].toLowerCase();
}

export function namesLastNameMatches(fullName, searchedLastName) {
  const storedLastName = getLastName(fullName);
  const search = String(searchedLastName || "").trim().toLowerCase();

  return storedLastName === search;
}

export function makeToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
