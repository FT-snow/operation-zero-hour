import { ConvexHttpClient } from "convex/browser";
import { readFileSync } from "fs";

async function main() {
  const c = new ConvexHttpClient("https://beaming-mallard-142.convex.cloud");
  const lines = readFileSync(".credentials.local", "utf8").split("\n");
  const teams: { code: string; pw: string }[] = [];
  for (const line of lines) {
    const m = /^"?(.+)"?,(TM-\d{3}),([A-Z0-9]{8}),/.exec(line.trim());
    if (m && !line.includes("ADMIN")) teams.push({ code: m[2], pw: m[3] });
  }
  const slice = teams.slice(0, 6);

  // SEQUENTIAL
  let okSeq = 0;
  const t0 = Date.now();
  for (const t of slice) {
    const r = (await c.mutation("auth:teamLogin" as never, { teamCode: t.code, password: t.pw })) as { ok: boolean; error?: string };
    if (r.ok) okSeq++;
    else console.log("SEQ FAIL", t.code, r.error);
  }
  console.log(`sequential: ${okSeq}/6 ok, ${Date.now() - t0}ms`);

  // PARALLEL with full value dump on failures
  const t1 = Date.now();
  const res = await Promise.allSettled(
    teams.slice(6, 12).map((t) => c.mutation("auth:teamLogin" as never, { teamCode: t.code, password: t.pw }))
  );
  let okPar = 0;
  res.forEach((r, i) => {
    if (r.status === "fulfilled") {
      const v = r.value as { ok: boolean; error?: string; token?: string };
      if (v.ok) okPar++;
      else console.log("PAR FAIL-VALUE", teams[6 + i].code, JSON.stringify(v).slice(0, 120));
    } else {
      console.log("PAR REJECT", teams[6 + i].code, String((r.reason as Error).message).slice(0, 160));
    }
  });
  console.log(`parallel: ${okPar}/6 ok, ${Date.now() - t1}ms`);
}
main();
