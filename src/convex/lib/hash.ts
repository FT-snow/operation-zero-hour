import { sha256 } from "./sha256";

export function sha256Hex(input: string): string {
  return sha256(input);
}

export function makeSalt(): string {
  let s = "";
  const alpha = "abcdefghijklmnopqrstuvwxyz0123456789";
  const rnd = new Uint8Array(16);
  crypto.getRandomValues(rnd);
  for (let i = 0; i < 16; i++) s += alpha[rnd[i] % alpha.length];
  return s;
}

export function hashPassword(password: string, salt: string): string {
  return sha256Hex(salt + ":" + password);
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

export function randomPassword(): string {
  const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rnd = new Uint8Array(8);
  crypto.getRandomValues(rnd);
  let out = "";
  for (let i = 0; i < 8; i++) out += alpha[rnd[i] % alpha.length];
  return out;
}
