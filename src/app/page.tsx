"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import Typewriter from "@/components/typewriter";
import GsapScroller from "@/components/gsap-scroller";
import { FadeIn } from "@/components/fade";

const CAST = [
  {
    name: "Adarsh",
    role: "THE BOYFRIEND",
    body: "Handsome, charismatic, fiercely entitled. The campus power couple in public - a battleground of control behind closed doors, affection with a possessive edge.",
  },
  {
    name: "Aayan",
    role: "THE DEVOTED BEST FRIEND",
    body: "The quiet constant in her storm. Carried her bags, heard her midnight tears, offered an unconditional shoulder whenever the weight became too heavy.",
  },
  {
    name: "Kratika",
    role: "THE CURRENT BEST FRIEND",
    body: "Polished, glamorous, effortlessly stylish. Inseparable fixtures across campus for the past year - coordinated appearances, projected loyalty.",
  },
  {
    name: "Abhilasha",
    role: "THE ROOMMATE",
    body: "Soft-spoken, emotionally fragile. Carrying the fresh grief of a four-year relationship, invited here by Neha to steady herself among friends.",
  },
  {
    name: "Snehil",
    role: "THE SCHOOL FRIEND",
    body: "From her childhood classrooms to the same university. Entire evening: restless, wired, barely touching his drink, checking his phone at every chime.",
  },
  {
    name: "Shailey",
    role: "THE ESTRANGED FRIEND",
    body: "Once her closest companion in high school. Arrives on Snehil's arm after years of silence - a quiet reminder of bonds severed the day college began.",
  },
];

const TIMELINE = [
  ["11:00 AM", "The iron gates swing open. The weekend belongs to them."],
  ["MIDNIGHT", "The music softens. The party fractures into whispers and shadows."],
  ["3:00 - 4:00 AM", "The house falls completely still."],
  ["3:45 AM", "A scream from the upper landing."],
  ["AFTER", "Resuscitation futile. Perimeter secured. Gates locked. No outsider crossed the grounds."],
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

      {/* =================================== PROLOGUE */}
      <section className="border-b border-linesoft">
        <div className="max-w-6xl mx-auto px-6 py-24 md:py-32">
          <p className="font-mono text-[11px] tracking-[0.25em] text-mut mb-10" data-reveal>
            PROLOGUE
          </p>
          <h2
            className="font-display tracking-[-0.02em] mb-14"
            style={{ fontSize: "clamp(2.6rem, 6vw, 5rem)" }}
            data-reveal
          >
            The Haven
          </h2>

          <div className="max-w-3xl space-y-8">
            <p className="font-mono text-xs md:text-sm text-mut leading-[2]" data-reveal>
              When the third-year examinations finally ended, the city was left behind for an
              isolated luxury villa nestled beyond the quiet outskirts. The heavy iron gates swung
              open at 11:00 AM, and with the turn of a brass key, the weekend belonged entirely to
              them. It was meant to be a sanctuary of relief - a private retreat to wash away
              exhaustion with loud music, clinking glasses, and the easy laughter of shared youth.
            </p>
            <p className="font-mono text-xs md:text-sm text-mut leading-[2]" data-reveal>
              At the center of gravity was <span className="text-ink">Neha</span>. Radiant, sharp,
              and undeniably magnetic, she moved through the villa like someone who owned every room
              she stepped into. To any stranger watching through the glass, it looked like an
              enviable portrait of modern friendship. Yet beneath the curated playlists and polite
              toasts, the air inside the villa carried a quiet, electric tension - a delicate web of
              histories waiting for a single misstep.
            </p>
          </div>

          <div className="hairline my-14 [transform-origin:left]" data-line-draw />

          <p className="font-mono text-[11px] tracking-[0.25em] text-blood mb-10" data-reveal>
            THE CIRCLE
          </p>
          <div className="grid sm:grid-cols-2 gap-px bg-linesoft border border-linesoft">
            {CAST.map((p) => (
              <div key={p.name} className="bg-black p-8" data-reveal>
                <p className="font-mono text-[10px] tracking-[0.3em] text-blood mb-3">{p.role}</p>
                <h3 className="font-display text-3xl tracking-tight mb-3">{p.name}</h3>
                <p className="font-mono text-xs text-mut leading-[1.9]">{p.body}</p>
              </div>
            ))}
          </div>

          <div className="hairline my-14 [transform-origin:left]" data-line-draw />

          <p className="font-mono text-[11px] tracking-[0.25em] text-mut mb-10" data-reveal>
            THE QUIET HOURS
          </p>
          <div className="max-w-3xl space-y-0">
            {TIMELINE.map(([t, v]) => (
              <div key={t} className="border-t border-linesoft last:border-b" data-reveal>
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-10 px-1 py-5">
                  <span className="font-mono text-[10px] tracking-[0.25em] text-ink w-28 shrink-0 pt-1">{t}</span>
                  <span className="font-mono text-xs text-mut leading-[1.9]">{v}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="max-w-3xl mt-14 space-y-8">
            <p className="font-mono text-xs md:text-sm text-mut leading-[2]" data-reveal>
              When the guests reached the master suite, they found Neha inside the bathroom,
              lifeless and unresponsive. Resuscitation was futile. The perimeter was secured, the
              driveway gates remained locked, and no outsider had crossed the grounds.
            </p>
            <p className="font-mono text-xs md:text-sm leading-[2]" data-reveal>
              <span className="text-ink">The answers do not lie outside these walls; they belong
              to the people standing in this room.</span>
            </p>
            <p className="font-mono text-xs md:text-sm leading-[2]" data-reveal>
              <span className="text-blood">Welcome to Zero Hour.</span>
            </p>
          </div>
        </div>
      </section>

      {/* =================================== HOUSE RULES */}
      <section className="border-b border-linesoft">
        <div className="max-w-6xl mx-auto px-6 py-24 md:py-32">
          <p className="font-mono text-[11px] tracking-[0.25em] text-mut mb-10" data-reveal>
            HOUSE RULES
          </p>
          <div className="space-y-0 max-w-3xl">
            {[
              ["ENTRY", "One login per team, issued by the control room. No public registration."],
              ["PACING", "Doors open only on the control room's signal. Locked means locked - for everyone."],
              ["THE REPORT", "The accusation files exactly once per team. A tie breaks by server timestamp."],
              ["CONDUCT", "Tampering with evidence - or the case file - ends the investigation. Yours."],
            ].map(([k, v]) => (
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
            <FadeIn delay={0.1}>
              <span className="inline-flex items-center font-mono text-[10px] tracking-[0.25em] text-mut px-4 py-4">
                TEAM CREDENTIALS ARE ISSUED BY THE CONTROL ROOM ONLY
              </span>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* =================================== FOOTER */}
      <footer className="border-t border-linesoft">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-mono text-[10px] tracking-[0.25em] text-mut">
            OPERATION ZERO HOUR - A MURDER MYSTERY COMPETITION
          </span>
          <span className="font-mono text-[10px] tracking-[0.25em] text-mut">
            A WEBSITE BY <span className="text-ink">SNOW</span>
          </span>
        </div>
      </footer>
    </main>
  );
}
