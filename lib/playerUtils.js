export function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

export function getNameParts(fullName) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return {
    firstName: parts[0] || "",
    lastName: parts.length > 1 ? parts[parts.length - 1] : parts[0] || ""
  };
}

export function getLastName(fullName) {
  return getNameParts(fullName).lastName.toLowerCase();
}

export function getFirstName(fullName) {
  return getNameParts(fullName).firstName.toLowerCase();
}

export function nameMatchesSearch(fullName, searchValue) {
  const search = String(searchValue || "").trim().toLowerCase();

  if (!search) {
    return false;
  }

  const firstName = getFirstName(fullName);
  const lastName = getLastName(fullName);

  return firstName === search || lastName === search;
}

export function isAdminValue(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

export function makeToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
