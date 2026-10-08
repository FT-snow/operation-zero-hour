"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import Typewriter from "@/components/typewriter";
import GsapScroller from "@/components/gsap-scroller";

const ROUNDS = [
  {
    n: "01",
    name: "The Scene",
    tag: "PHYSICAL / IN-HALL",
    body: "The scene is walked. Every footprint photographed, every mismatch catalogued. Investigate what the killer left behind.",
  },
  {
    n: "02",
    name: "The Statements",
    tag: "PHYSICAL / IN-HALL",
    body: "Statements taken. Truths bent. A story unfurls in the hall in real time - catch every contradiction.",
  },
  {
    n: "03",
    name: "The Evidence Tapes",
    tag: "DIGITAL / 5 TAPES",
    body: "Five pieces of surveillance footage, dropped into your file. One of them lies. Watch with intent.",
  },
  {
    n: "04",
    name: "The Code",
    tag: "DIGITAL / DEAD BOLT",
    body: "Four characters stand between you and the truth. Speak the code and the bolt releases your clues - and the final round.",
  },
  {
    n: "05",
    name: "The Accusation",
    tag: "DIGITAL / ONE SHOT",
    body: "Name the killer. State the method. Explain the motive. One report, filed once, server-timestamped. There are no retractions.",
  },
];

const RULES = [
  ["ENTRY", "One login per team, issued by the control room. No public registration."],
  ["PACING", "Rounds open only on the control room's signal. Locked means locked - for everyone."],
  ["THE CODE", "Round 4 grants passage to any team holding the right four characters."],
  ["THE REPORT", "Round 5 files exactly once per team. Late is never, a tie breaks by server timestamp."],
  ["CONDUCT", "Tampering with evidence - or the case file - ends the investigation. Yours."],
];

export default function Home() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.85], [1, 0]);

  return (
    <main className="relative min-h-screen flex flex-col overflow-x-clip">
      <GsapScroller />

      {/* =================================== HERO */}
      <section ref={heroRef} className="relative border-b border-linesoft">
        <header className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between font-mono text-[11px] tracking-[0.2em] text-mut">
          <span>CASE FILE // NO. 001</span>
          <span className="hidden sm:inline">RESTRICTED ACCESS</span>
        </header>
        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          className="max-w-6xl mx-auto px-6 pt-16 pb-20 md:pt-24 md:pb-28"
        >
          <p className="font-mono text-[11px] tracking-[0.25em] text-mut mb-6" data-reveal>
            A MURDER MYSTERY IN FIVE ROUNDS
          </p>
          <h1
            className="font-display leading-[0.92] tracking-[-0.03em]"
            style={{ fontSize: "clamp(3.4rem, 11vw, 9rem)" }}
            data-reveal
          >
            OPERATION
            <br />
            <span className="text-blood">ZERO HOUR</span>
          </h1>
          <Typewriter
            text="One body. Five rounds. A killer who will not wait."
            className="font-mono text-sm md:text-base text-mut mt-8 max-w-xl"
            speed={34}
            startDelay={500}
          />
          <div className="hairline my-10 [transform-origin:left]" data-line-draw />
          <div className="flex flex-col sm:flex-row gap-4" data-reveal>
            <Link
              href="/login"
              className="inline-flex items-center justify-center bg-ink text-bg font-mono text-xs tracking-[0.2em] px-8 py-4 hover:bg-white transition-colors active:scale-[0.98]"
            >
              TEAM LOGIN
            </Link>
            <Link
              href="/admin/login"
              className="inline-flex items-center justify-center border border-line text-mut hover:text-ink font-mono text-xs tracking-[0.2em] px-8 py-4 transition-colors active:scale-[0.98]"
            >
              CONTROL ROOM
            </Link>
          </div>
        </motion.div>
        <div className="max-w-6xl mx-auto px-6 pb-6 font-mono text-[10px] tracking-[0.3em] text-mut flex items-center gap-3" data-reveal>
          <span>SCROLL FOR THE CASE</span>
          <span className="block h-px flex-1 bg-line" />
        </div>
      </section>

      {/* =================================== THE COMPETITION COSMOS */}
      <section className="border-b border-linesoft">
        <div className="max-w-6xl mx-auto px-6 py-24 md:py-32">
          <p className="font-mono text-[11px] tracking-[0.25em] text-mut mb-10" data-reveal>
            THE COMPETITION
          </p>
          <h2
            className="font-display tracking-[-0.02em] leading-[1.02] max-w-4xl"
            style={{ fontSize: "clamp(2.4rem, 5.4vw, 4.4rem)" }}
            data-reveal
          >
            One competition. One dead body.
            <br />
            <span className="text-mut">Forty teams on the same trail.</span>
          </h2>
          <div className="hairline my-12 [transform-origin:left]" data-line-draw />
          <div className="grid md:grid-cols-3 gap-x-12 gap-y-10 max-w-5xl">
            {[
              {
                k: "THE WORLD",
                v: "A noir evening staged as a real investigation: evidence scenes, live statements, sealed tapes, and a case that opens only on the control room's word.",
              },
              {
                k: "THE FIELD",
                v: "Every team fights the same timeline on the same case file. Solve what is placed before you - advance together, or stall together.",
              },
              {
                k: "THE PROOF",
                v: "Round 5 is a signed confession: suspect, method, motive. The record is permanent, the timestamp absolute, the verdict known only to the control room.",
              },
            ].map((c) => (
              <div key={c.k} data-reveal>
                <p className="font-mono text-[10px] tracking-[0.3em] text-blood mb-4">{c.k}</p>
                <p className="font-mono text-xs text-mut leading-[1.9]">{c.v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =================================== FIVE ROUNDS */}
      <section className="border-b border-linesoft">
        <div className="max-w-6xl mx-auto px-6 py-24 md:py-32">
          <p className="font-mono text-[11px] tracking-[0.25em] text-mut mb-10" data-reveal>
            THE PROTOCOL
          </p>
          <h2
            className="font-display tracking-[-0.02em] mb-4"
            style={{ fontSize: "clamp(2.4rem, 5.4vw, 4.4rem)" }}
            data-reveal
          >
            Five doors.{" "}
            <span className="text-mut">One truth.</span>
          </h2>
        </div>
        <div className="max-w-6xl mx-auto px-6 pb-24 md:pb-32">
          {ROUNDS.map((r) => (
            <div
              key={r.n}
              className="relative border-t border-linesoft last:border-b group px-1 py-10 md:py-14"
            >
              <div
                className="font-display absolute -top-6 right-2 md:right-8 text-[8rem] md:text-[11rem] text-[#101010] pointer-events-none select-none"
                data-drift
                style={{ willChange: "transform" }}
              >
                {r.n}
              </div>
              <div className="relative">
                <p className="font-mono text-[10px] tracking-[0.3em] text-mut mb-3" data-reveal>
                  ROUND {r.n} - {r.tag}
                </p>
                <h3
                  className="font-display text-4xl md:text-6xl tracking-[-0.02em] mb-4 group-hover:text-ink"
                  data-reveal
                >
                  {r.name}
                </h3>
                <p className="font-mono text-xs text-mut leading-[1.9] max-w-2xl" data-reveal>
                  {r.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* =================================== RULES */}
      <section className="border-b border-linesoft">
        <div className="max-w-6xl mx-auto px-6 py-24 md:py-32">
          <p className="font-mono text-[11px] tracking-[0.25em] text-mut mb-10" data-reveal>
            HOUSE RULES
          </p>
          <div className="space-y-0 max-w-3xl">
            {RULES.map(([k, v]) => (
              <div key={k} className="border-t border-linesoft last:border-b" data-reveal>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-10 px-1 py-6">
                  <span className="font-mono text-[10px] tracking-[0.3em] text-ink w-32 shrink-0 pt-1">{k}</span>
                  <span className="font-mono text-xs text-mut leading-[1.9]">{v}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =================================== FINAL CTA */}
      <section className="flex-1 flex items-center">
        <div className="max-w-6xl mx-auto px-6 py-24 md:py-32 w-full">
          <h2
            className="font-display tracking-[-0.02em] leading-[1.05] max-w-3xl"
            style={{ fontSize: "clamp(2.6rem, 6vw, 5rem)" }}
            data-reveal
          >
            Zero hour is coming.
            <br />
            <span className="text-blood">Will you be the one to say the name?</span>
          </h2>
          <div className="hairline my-10 [transform-origin:left]" data-line-draw />
          <div className="flex flex-col sm:flex-row gap-4" data-reveal>
            <Link
              href="/login"
              className="inline-flex items-center justify-center bg-ink text-bg font-mono text-xs tracking-[0.2em] px-8 py-4 hover:bg-white transition-colors active:scale-[0.98]"
            >
              ENTER THE CASE FILE
            </Link>
            <span className="inline-flex items-center font-mono text-[10px] tracking-[0.25em] text-mut px-4">
              TEAM CREDENTIALS ARE ISSUED BY THE CONTROL ROOM ONLY
            </span>
          </div>
        </div>
      </section>

      {/* =================================== FOOTER - credit at the exact bottom */}
      <footer className="border-t border-linesoft">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-mono text-[10px] tracking-[0.25em] text-mut">
            OPERATION ZERO HOUR - A MURDER MYSTERY COMPETITION
          </span>
          <span className="font-mono text-[10px] tracking-[0.25em] text-mut">
            A WEBSITE BY{" "}
            <span className="text-ink">SNOW</span>
          </span>
        </div>
      </footer>
    </main>
  );
}
