import * as XLSX from "xlsx";
import * as dotenv from "dotenv";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../src/convex/_generated/api";

dotenv.config({ path: ".env.local" });

const ADMIN_EMAIL = process.argv[2];
const ADMIN_PASSWORD = process.argv[3];

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("usage: bunx tsx scripts/export-submissions.ts <admin-email> <admin-password>");
  process.exit(1);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL missing");
  const client = new ConvexHttpClient(url);

  const login = await client.mutation(api.auth.adminLogin, {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (!login.ok) throw new Error("Admin login failed");
  const token = login.token;

  const data = await client.query(api.submissions.listAdmin, { token });

  const rows = [["#", "Team ID", "Team Name", "Accused (Killer)", "Verdict", "How Did They Kill The Victim (Method)", "What Was The Motive", "How Do You Observe The Murder", "Filed At (UTC)"]];
  data.submissions.forEach((s, i) => {
    rows.push([
      String(i + 1),
      s.teamCode,
      s.teamName,
      s.killer,
      s.correct ? "CORRECT" : "WRONG",
      s.method ?? "",
      s.motive ?? "",
      s.observation ?? "",
      new Date(s.submittedAt).toISOString(),
    ]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 5 }, { wch: 10 }, { wch: 24 }, { wch: 18 }, { wch: 10 },
    { wch: 80 }, { wch: 80 }, { wch: 80 }, { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Round 5 Submissions");

  const out = "operation-zero-hour-round5-submissions.xlsx";
  XLSX.writeFile(wb, out);
  console.log(`WROTE ${out}: ${data.submissions.length} submission(s) include observation: ${data.submissions.filter((s) => (s.observation ?? "").length > 0).length}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
