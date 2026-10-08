"use client";

// Session store: token in localStorage + non-HttpOnly cookie (middleware redirect UX only).
// The real security boundary is Convex-side token validation per query/mutation.

const KEY = "ozh.token";
const KEY_ROLE = "ozh.role";
const KEY_NAME = "ozh.name";

export type Role = "admin" | "team";

function hasWindow(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

export function saveSession(token: string, role: Role, name: string) {
  if (!hasWindow()) return;
  localStorage.setItem(KEY, token);
  localStorage.setItem(KEY_ROLE, role);
  localStorage.setItem(KEY_NAME, name);
  document.cookie = `ozh_token=${token}; path=/; max-age=${14 * 24 * 60 * 60}; SameSite=Lax`;
  document.cookie = `ozh_role=${role}; path=/; max-age=${14 * 24 * 60 * 60}; SameSite=Lax`;
}

export function clearSession() {
  if (!hasWindow()) return;
  localStorage.removeItem(KEY);
  localStorage.removeItem(KEY_ROLE);
  localStorage.removeItem(KEY_NAME);
  document.cookie = "ozh_token=; path=/; max-age=0";
  document.cookie = "ozh_role=; path=/; max-age=0";
}

export function getToken(): string {
  if (!hasWindow()) return "";
  return localStorage.getItem(KEY) ?? "";
}

export function getRole(): Role | null {
  if (!hasWindow()) return null;
  const r = localStorage.getItem(KEY_ROLE);
  return r === "admin" || r === "team" ? r : null;
}

export function getName(): string {
  if (!hasWindow()) return "";
  return localStorage.getItem(KEY_NAME) ?? "";
}
