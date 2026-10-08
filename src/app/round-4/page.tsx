"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { getToken } from "@/lib/session";
import Typewriter from "@/components/typewriter";
import { FadeIn } from "@/components/fade";
import { LockIcon, CheckIcon } from "@/components/icons";

const BOTTLENECK = "Doors stay shut until someone speaks the right four characters.";

export default function Round4Page() {
  const token = getToken();
  if (!token) return null;
  return <Round4Inner token={token} />;
}

function Round4Inner({ token }: { token: string }) {
  const status = useQuery(api.rounds.list, { token });
  const clues = useQuery(api.round4.cluesGet, { token });
  const submitCode = useMutation(api.round4.submitCode);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const round4 = status?.rounds.find((r) => r.roundNumber === 4);
  const roundStatus = round4?.status ?? "not_started";
  const cleared = clues?.cleared ?? false;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy || cleared) return;
    setBusy(true);
    setError("");
    try {
      const res = await submitCode({ token, code });
      if (res.ok) {
        setCode("");
        // clues subscription flips automatically
      } else {
        setError(res.error);
        setShake(true);
        setTimeout(() => setShake(false), 400);
        setCode("");
        inputRef.current?.focus();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setBusy(false);
    }
  }

  const locked = roundStatus === "not_started";
  const closed = roundStatus === "closed";

  useEffect(() => {
    if (!locked && !closed) inputRef.current?.focus();
  }, [locked, closed]);

  return (
    <main className="min-h-screen">
      <header className="border-b border-linesoft">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between font-mono text-[11px] tracking-[0.2em] text-mut">
          <Link href="/story" className="hover:text-ink transition-colors">&lt; CASE FILE</Link>
          <span>ROUND 04 // THE CODE</span>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-6 py-20">
        <p className="font-mono text-[11px] tracking-[0.25em] text-mut mb-3">ROUND 4</p>
        <h1 className="font-display text-5xl md:text-7xl tracking-[-0.02em] mb-6">Dead Bolt</h1>
        <Typewriter text={BOTTLENECK} className="font-mono text-sm text-mut" speed={38} startDelay={400} />
        <div className="hairline my-12" />

        <FadeIn>
          {cleared ? (
            <div className="space-y-10">
              <div className="border border-sage/40 px-8 py-7">
                <div className="flex items-center gap-4 mb-4">
                  <CheckIcon size={20} className="text-sage" />
                  <p className="font-mono text-[11px] tracking-[0.25em] text-sage">BOLT RELEASED</p>
                </div>
                <p className="font-mono text-xs text-mut leading-relaxed max-w-lg">
                  The lock accepted your code. Round 5 is now open to your team, and the case
                  clues below have been unsealed. Handle them carefully.
                </p>
              </div>
              {clues && !clues.locked && clues.clues.length > 0 && (
                <div className="space-y-5">
                  <p className="font-mono text-[11px] tracking-[0.25em] text-mut">UNSEALED CLUES</p>
                  {clues.clues.map((c) => (
                    <div key={c.order} className="border border-linesoft px-7 py-6">
                      <div className="flex items-baseline gap-4 mb-3">
                        <span className="font-mono text-xs text-blood">{String(c.order).padStart(2, "0")}</span>
                        <h3 className="font-display text-2xl tracking-tight">{c.title}</h3>
                      </div>
                      <p className="text-sm text-mut leading-relaxed whitespace-pre-wrap">{c.body}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between mt-12">
                <span className="font-mono text-[10px] tracking-[0.2em] text-mut">ACCESS TO ROUND 05 GRANTED</span>
                <Link
                  href="/round-5"
                  className="bg-ink text-bg font-mono text-xs tracking-[0.2em] px-8 py-4 hover:bg-white transition-colors"
                >
                  FILE THE ACCUSATION &gt;
                </Link>
              </div>
            </div>
          ) : locked ? (
            <LockedPane text="The control room has not opened this round. Watch the case file for the signal." />
          ) : (
            <div className="space-y-8">
              <div className={`border border-linesoft px-8 py-12 ${shake ? "animate-[shake_0.4s]" : ""}`}>
                <div className="flex items-center gap-3 mb-6">
                  <LockIcon size={17} className="text-mut" />
                  <p className="font-mono text-[10px] tracking-[0.25em] text-mut">4-CHARACTER ACCESS CODE</p>
                </div>
                <form onSubmit={onSubmit}>
                  <input
                    ref={inputRef}
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value.toUpperCase().slice(0, 8));
                      setError("");
                    }}
                    autoComplete="off"
                    spellCheck={false}
                    disabled={closed}
                    className={`font-mono text-4xl md:text-6xl text-center tracking-[0.5em] field w-full py-8 ${
                      shake ? "border-blood" : ""
                    }`}
                    placeholder="----"
                    style={{ letterSpacing: "0.4em" }}
                  />
                  <div className="flex items-center justify-between mt-6">
                    {error ? (
                      <p className="font-mono text-xs text-blood">{error}</p>
                    ) : (
                      <p className="font-mono text-[10px] tracking-[0.15em] text-mut">
                        {closed ? "ROUND IS CLOSED" : "5 ATTEMPTS PER MINUTE. CHOOSE WISELY."}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={busy || closed || code.length === 0}
                      className="bg-ink text-bg font-mono text-xs tracking-[0.2em] px-8 py-3.5 hover:bg-white transition-colors active:scale-[0.98] disabled:opacity-30"
                    >
                      {busy ? "TESTING..." : "TURN THE KEY"}
                    </button>
                  </div>
                </form>
              </div>
              {closed && (
                <p className="font-mono text-xs text-mut">
                  This round has been closed by the control room. If your team has not solved
                  the code, the bolt stays shut.
                </p>
              )}
            </div>
          )}
        </FadeIn>
      </section>

      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
      `}</style>
    </main>
  );
}

function LockedPane({ text }: { text: string }) {
  return (
    <div className="border border-linesoft px-8 py-16 flex flex-col items-center gap-5 text-center">
      <LockIcon size={34} className="text-mut" />
      <p className="font-display text-3xl md:text-4xl max-w-xl leading-snug">The bolt is drawn.</p>
      <p className="font-mono text-xs text-mut max-w-md leading-relaxed">{text}</p>
      <Link
        href="/story"
        className="font-mono text-[10px] tracking-[0.2em] text-mut border border-line px-4 py-2.5 hover:text-ink transition-colors"
      >
        BACK TO THE FILE
      </Link>
    </div>
  );
}
