"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { getToken } from "@/lib/session";
import { FadeIn } from "@/components/fade";
import { LockIcon } from "@/components/icons";

export default function Round5Page() {
  const token = getToken();
  if (!token) return null;
  return <Round5Inner token={token} />;
}

function Round5Inner({ token }: { token: string }) {
  const access = useQuery(api.submissions.access, { token });
  const mine = useQuery(api.submissions.mine, { token });
  const suspects = useQuery(api.submissions.suspectsForTeam, { token });
  const submit = useMutation(api.submissions.submit);

  const [killer, setKiller] = useState("");
  const [method, setMethod] = useState("");
  const [motive, setMotive] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ at: number } | null>(null);

  if (!access || !mine) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="font-mono text-xs tracking-[0.25em] text-mut blink">CHECKING CLEARANCE...</p>
      </main>
    );
  }
  const suspectList =
    suspects && !suspects.locked ? suspects.suspects.map((s) => s.toUpperCase()) : [];

  async function doSubmit() {
    setBusy(true);
    setError("");
    try {
      const res = await submit({ token, killer, method, motive });
      if (res.ok) {
        setDone({ at: res.submittedAt });
        setConfirming(false);
      } else {
        setError(res.error);
        setConfirming(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  // Filed report - immutable, view-only
  if (done || mine.submitted) {
    const at = mine.submitted ? mine.submittedAt : done?.at ?? 0;
    return (
      <main className="min-h-screen">
        <TopBar />
        <section className="max-w-3xl mx-auto px-6 py-24">
          <FadeIn>
            <div className="border border-sage/40 px-8 py-10">
              <p className="font-mono text-[11px] tracking-[0.25em] text-sage mb-3">REPORT FILED</p>
              <h1 className="font-display text-4xl md:text-5xl tracking-[-0.02em] mb-4">
                The accusation is on record.
              </h1>
              <p className="font-mono text-xs text-mut leading-relaxed max-w-lg">
                Filed at server time{" "}
                {new Date(at).toISOString().replace("T", " ").slice(0, 19)} UTC. No edits are
                possible. Results follow when the control room closes the case.
              </p>
            </div>
            {mine.submitted && (
              <div className="mt-10 space-y-5">
                <FileRow label="ACCUSED" value={mine.killer} />
                <FileRow label="METHOD" value={mine.method} />
                <FileRow label="MOTIVE" value={mine.motive} />
              </div>
            )}
            <Link href="/story" className="inline-block mt-12 font-mono text-[10px] tracking-[0.2em] text-mut border border-line px-4 py-2.5 hover:text-ink transition-colors">
              BACK TO THE FILE
            </Link>
          </FadeIn>
        </section>
      </main>
    );
  }

  const topBar = <TopBar />;
  const header = (
    <>
      <p className="font-mono text-[11px] tracking-[0.25em] text-mut mb-3">ROUND 5</p>
      <h1 className="font-display text-5xl md:text-7xl tracking-[-0.02em] mb-6">The Accusation</h1>
      <div className="hairline my-12" />
    </>
  );

  // Gate: server says locked for any reason
  if (!access.open) {
    return (
      <main className="min-h-screen">
        {topBar}
        <section className="max-w-3xl mx-auto px-6 py-20">
          {header}
          <FadeIn>
            <div className="border border-linesoft px-8 py-16 flex flex-col items-center gap-5 text-center">
              <LockIcon size={34} className="text-mut" />
              <p className="font-display text-3xl md:text-4xl max-w-xl leading-snug">
                {access.status === "closed" && !access.cleared
                  ? "The case is closed and your bolt remained shut."
                  : access.status === "closed"
                  ? "The case is closed."
                  : !access.cleared
                  ? "Your team has not passed the bolt."
                  : "Round not open."}
              </p>
              <p className="font-mono text-xs text-mut max-w-md leading-relaxed">
                {access.status === "closed"
                  ? "The control room shut this door. Submissions are no longer possible."
                  : !access.cleared
                  ? "Round 04 stands between you and this page. Return to the code."
                  : ""}
              </p>
              <Link href="/story" className="font-mono text-[10px] tracking-[0.2em] text-mut border border-line px-4 py-2.5 hover:text-ink transition-colors">
                BACK TO THE FILE
              </Link>
            </div>
          </FadeIn>
        </section>
      </main>
    );
  }

  if (confirming) {
    return (
      <main className="min-h-screen">
        {topBar}
        <section className="max-w-3xl mx-auto px-6 py-20">
          {header}
          <FadeIn>
            <div className="border border-blood/50 px-8 py-10">
              <p className="font-mono text-[11px] tracking-[0.25em] text-blood mb-3">FINAL WARNING</p>
              <h2 className="font-display text-3xl md:text-4xl mb-4">File the accusation?</h2>
              <p className="font-mono text-xs text-mut leading-relaxed max-w-lg mb-8">
                This is the only copy you get. Submitting locks your report. Nothing can be
                edited afterwards - not by you, not by anyone.
              </p>
              <div className="space-y-4 mb-10">
                <FileRow label="ACCUSED" value={killer || "-"} />
                <FileRow label="METHOD" value={method || "-"} />
                <FileRow label="MOTIVE" value={motive || "-"} />
              </div>
              {error && <p className="font-mono text-xs text-blood mb-6">{error}</p>}
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={doSubmit}
                  disabled={busy}
                  className="bg-blood text-white font-mono text-xs tracking-[0.2em] px-8 py-4 hover:opacity-90 transition-opacity active:scale-[0.98] disabled:opacity-40"
                >
                  {busy ? "FILING..." : "FILE FOR GOOD"}
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  disabled={busy}
                  className="border border-line text-mut hover:text-ink font-mono text-xs tracking-[0.2em] px-8 py-4 transition-colors disabled:opacity-40"
                >
                  GO BACK
                </button>
              </div>
            </div>
          </FadeIn>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      {topBar}
      <section className="max-w-3xl mx-auto px-6 py-20">
        {header}
        <FadeIn>
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              setError("");
              if (!killer || !method.trim() || !motive.trim()) {
                setError("All fields are required.");
                return;
              }
              setConfirming(true);
            }}
            className="space-y-10"
          >
            <div>
              <label className="font-mono text-[10px] tracking-[0.2em] text-mut block mb-3">
                WHO IS THE KILLER?
              </label>
              <select
                value={killer}
                onChange={(e) => setKiller(e.target.value)}
                className="field font-mono w-full px-4 py-3.5 text-sm appearance-none cursor-pointer"
              >
                <option value="">- SELECT A SUSPECT -</option>
                {suspectList.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-mono text-[10px] tracking-[0.2em] text-mut block mb-3">
                HOW DID THEY KILL THE VICTIM?
              </label>
              <textarea
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                rows={5}
                maxLength={4000}
                className="field w-full px-4 py-3.5 text-sm leading-relaxed resize-y"
                placeholder="Walk us through it. Every step counts."
              />
              <p className="font-mono text-[9px] text-mut mt-2">{method.length} / 4000</p>
            </div>
            <div>
              <label className="font-mono text-[10px] tracking-[0.2em] text-mut block mb-3">
                WHAT WAS THE MOTIVE?
              </label>
              <textarea
                value={motive}
                onChange={(e) => setMotive(e.target.value)}
                rows={5}
                maxLength={4000}
                className="field w-full px-4 py-3.5 text-sm leading-relaxed resize-y"
                placeholder="What drove them to it?"
              />
              <p className="font-mono text-[9px] text-mut mt-2">{motive.length} / 4000</p>
            </div>
            {error && <p className="font-mono text-xs text-blood">{error}</p>}
            <button
              type="submit"
              className="bg-ink text-bg font-mono text-xs tracking-[0.2em] px-10 py-4 hover:bg-white transition-colors active:scale-[0.98]"
            >
              FILE THE ACCUSATION
            </button>
          </form>
        </FadeIn>
      </section>
    </main>
  );
}

function TopBar() {
  return (
    <header className="border-b border-linesoft">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4 font-mono text-[11px] tracking-[0.2em] text-mut">
        <Link href="/" className="text-ink hover:text-white transition-colors whitespace-nowrap">OPERATION ZERO HOUR</Link>
        <span className="hidden sm:inline text-mut whitespace-nowrap">ROUND 05 // THE ACCUSATION</span>
        <Link href="/story" className="hover:text-ink transition-colors whitespace-nowrap">&lt; CASE FILE</Link>
      </div>
    </header>
  );
}

function FileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-linesoft px-6 py-5">
      <p className="font-mono text-[9px] tracking-[0.25em] text-mut mb-2">{label}</p>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{value}</p>
    </div>
  );
}
