"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { useEffect, useState } from "react";
import StatusBadge from "@/components/status-badge";
import { LockIcon } from "@/components/icons";
import { FadeIn, Stagger } from "@/components/fade";
import { clearSession, getToken, getName } from "@/lib/session";
import { useRouter } from "next/navigation";

const ROUND_NAMES: Record<number, string> = {
  1: "The Scene",
  2: "The Statements",
  3: "The Evidence Tapes",
  4: "The Code",
  5: "The Accusation",
};

const LINKS: Record<number, string> = {
  3: "/round-3",
  4: "/round-4",
  5: "/round-5",
};

export default function StoryPage() {
  const token = getToken();
  const data = useQuery(api.rounds.list, token ? { token } : "skip");
  const myR4 = useQuery(api.round4.myStatus, token ? { token } : "skip");
  const summary = useQuery(api.teams.summary, token ? { token } : "skip");
  const meSub = useQuery(api.submissions.mine, token ? { token } : "skip");
  const logout = useMutation(api.auth.logout);
  const router = useRouter();
  const [joined, setJoined] = useState("");

  useEffect(() => {
    if (summary) setJoined(`${summary.teamCode} - ${summary.teamName}`);
    else setJoined(getName());
  }, [summary]);

  if (!data) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="font-mono text-xs tracking-[0.25em] text-mut blink">OPENING CASE FILE...</p>
      </main>
    );
  }

  async function doLogout() {
    try {
      if (token) await logout({ token });
    } catch {
      /* session may already be gone */
    }
    clearSession();
    router.replace("/login");
  }

  const milestone = data.rounds.find((r) => r.status === "live");

  return (
    <main className="min-h-screen">
      <header className="border-b border-linesoft sticky top-0 bg-black/85 backdrop-blur z-40">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="font-mono text-[11px] tracking-[0.2em] text-mut hover:text-ink transition-colors"
          >
            OPERATION ZERO HOUR
          </Link>
          <div className="flex items-center gap-6 font-mono text-[11px] tracking-[0.15em]">
            <span className="text-ink">{joined}</span>
            <button onClick={doLogout} className="text-mut hover:text-ink transition-colors">
              SIGN OUT
            </button>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-20 pb-10">
        <p className="font-mono text-[11px] tracking-[0.25em] text-mut mb-4">THE BRIEFING</p>
        <h1 className="font-display text-5xl md:text-7xl tracking-[-0.02em] leading-[1.02] max-w-3xl">
          One body in the wrong room.
          <br />
          <span className="text-blood">Five rounds to prove it.</span>
        </h1>
        <p className="font-mono text-sm text-mut mt-8 max-w-2xl leading-relaxed">
          A team of investigators. A house full of suspects. Between you and the
          accusation stand five rounds - each opens only when the control room
          says so. Solve what is placed before you. Advance together.
        </p>
      </section>

      <div className="max-w-6xl mx-auto px-6"><div className="hairline" /></div>

      <section className="max-w-6xl mx-auto px-6 py-16">
        <p className="font-mono text-[11px] tracking-[0.25em] text-mut mb-10">
          ROUND PROTOCOL {milestone ? `- ROUND ${milestone.roundNumber} ACTIVE` : ""}
        </p>
        <Stagger className="space-y-0">
          {data.rounds.map((r) => {
            const cleared = myR4?.cleared ?? false;
            const r5AutoOpen =
              r.roundNumber === 5 && cleared && r.status !== "closed";
            const noEntry = r.status !== "closed" && r5AutoOpen;
            const locked = r.status === "not_started" && !noEntry;
            const hasPage = LINKS[r.roundNumber];
            const body = (
              <div
                className={`group border border-linesoft hover:border-line transition-colors px-6 md:px-10 py-8 flex flex-col md:flex-row md:items-center gap-6 ${
                  locked ? "opacity-45" : ""
                }`}
              >
                <span className="font-display text-6xl md:text-7xl text-[#242424] leading-none select-none w-24 shrink-0">
                  {String(r.roundNumber).padStart(2, "0")}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-4 mb-2">
                    <h2 className="font-display text-2xl md:text-3xl tracking-tight">
                      {ROUND_NAMES[r.roundNumber]}
                    </h2>
                    <StatusBadge status={noEntry ? "live" : r.status} roundNumber={r.roundNumber} pulse />
                    {r.roundNumber === 3 && r.videosRevealed && r.status === "live" && (
                      <span className="font-mono text-[10px] tracking-[0.2em] text-sage border border-sage/40 px-2.5 py-1">
                        TAPES REVEALED
                      </span>
                    )}
                    {r.roundNumber === 5 && r5AutoOpen && (
                      <span className="font-mono text-[10px] tracking-[0.2em] text-sage border border-sage/40 px-2.5 py-1">
                        BOLT PASSED - OPENED
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-xs text-mut leading-relaxed max-w-xl">
                    {locked ? "LOCKED - THE CONTROL ROOM HAS NOT OPENED THIS DOOR." : r.roundNumber <= 2 ? "UNFOLDS IN THE HALL." : ""}
                  </p>
                </div>
                <div className="shrink-0 self-start md:self-center">
                  {locked ? (
                    <span className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-mut border border-line px-3 py-2">
                      <LockIcon size={13} /> RESTRICTED
                    </span>
                  ) : hasPage ? (
                    <span className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-ink border border-line px-3 py-2 group-hover:bg-ink group-hover:text-bg transition-colors">
                      OPEN {String(r.roundNumber).padStart(2, "0")} &gt;
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-mut border border-line px-3 py-2">
                      IN THE HALL
                    </span>
                  )}
                </div>
              </div>
            );
            return hasPage && !locked ? (
              <Link key={r.roundNumber} href={hasPage} className="block">
                {body}
              </Link>
            ) : (
              <div key={r.roundNumber}>{body}</div>
            );
          })}
        </Stagger>
      </section>

      <footer className="border-t border-linesoft">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between font-mono text-[10px] tracking-[0.2em] text-mut">
          <span>ROUND 1 &amp; 2 UNFOLD IN THE HALL. NOTHING TO FILE HERE.</span>
        </div>
      </footer>
    </main>
  );
}
