import { readFileSync } from "fs";
function loadTeams(): { code: string; pw: string }[] {
  const lines = readFileSync(".credentials.local", "utf8").split("\n");
  const teams: { code: string; pw: string }[] = [];
  for (const line of lines) {
    const m = /^"?(.+)"?,(TM-\d{3}),([A-Z0-9]{8}),/.exec(line.trim());
    if (m && !line.includes("ADMIN")) teams.push({ code: m[2], pw: m[3] });
  }
  return teams;
}
const t = loadTeams();
console.log("parsed teams:", t.length, t.slice(0, 3));
