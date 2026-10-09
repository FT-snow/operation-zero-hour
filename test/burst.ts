import { ConvexHttpClient } from "convex/browser";
import { readFileSync } from "fs";

async function main() {
  const c = new ConvexHttpClient("https://beaming-mallard-142.convex.cloud");
  const teams: { code: string; pw: string }[] = [];
  for (const line of readFileSync(".credentials.local", "utf8").split("\n")) {
    const m = /^(Team \d+) \| (TM-\d{3}) \| ([A-Z0-9]{8}) \|/.exec(line.trim());
    if (m) teams.push({ code: m[2], pw: m[3] });
  }
  // one session per team
  const logins = await Promise.allSettled(teams.map((t) => c.mutation("auth:teamLogin" as never, { teamCode: t.code, password: t.pw })));
  const tokens: string[] = [];
  logins.forEach((r) => { if (r.status === "fulfilled") { const v = r.value as { ok: boolean; token?: string }; if (v.ok) tokens.push(v.token!); } });
  console.log("sessions:", tokens.length, "/", teams.length);

  // WRONG-code single attempt per team (all distinct wrong codes)
  const t0 = Date.now();
  const res = await Promise.allSettled(
    tokens.map((tk, i) => c.mutation("round4:submitCode" as never, { token: tk, code: "ZZZ" + (i % 10) }))
  );
  const rejected = res.filter((r) => r.status === "fulfilled" && (r.value as { ok: boolean }).ok === false).length;
  const rateLimited = res.filter((r) => r.status === "fulfilled" && (r.value as { rateLimited?: boolean }).rateLimited).length;
  console.log(`wrong-code burst: ${rejected}/${tokens.length} rejected (${rateLimited} rate-limited) in ${Date.now() - t0}ms`);
}
main();
