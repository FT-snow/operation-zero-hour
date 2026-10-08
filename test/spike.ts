import { ConvexHttpClient } from "convex/browser";

async function main() {
  const c = new ConvexHttpClient("https://beaming-mallard-142.convex.cloud");
  const token = process.env.TEAM_TOKEN!;
  const t0 = Date.now();
  let ok = 0, fail = 0, firstErr = "";
  // 6 waves of 80 concurrent double-queries = 960 ops
  for (let w = 0; w < 6; w++) {
    const res = await Promise.allSettled(
      Array.from({ length: 80 }, () =>
        Promise.all([
          c.query("rounds:list" as unknown as string, { token }),
          c.query("submissions:access" as unknown as string, { token }),
        ]).then(() => true)
      )
    );
    ok += res.filter((r) => r.status === "fulfilled").length;
    const f = res.filter((r) => r.status === "rejected");
    fail += f.length;
    if (f.length && !firstErr) firstErr = String((f[0] as any)?.reason?.message ?? "").slice(0, 80);
  }
  console.log(`WAVES 6x80 = ${ok} ok, ${fail} fail, ${Date.now() - t0}ms; ${firstErr}`);
}
main();
