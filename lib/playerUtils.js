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

  if (!search)
