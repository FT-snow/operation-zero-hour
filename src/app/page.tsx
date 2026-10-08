"use client";

import Link from "next/link";
import { useEffect } from "react";
import Typewriter from "@/components/typewriter";
import { FadeIn } from "@/components/fade";

export default function Home() {
  // Land direct hits on a locked zone onto login.
  useEffect(() => {
    // not needed; static page
  }, []);

  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-linesoft">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between font-mono text-[11px] tracking-[0.2em] text-mut">
          <span>CASE FILE // NO. 001</span>
          <span className="text-mut">RESTRICTED ACCESS</span>
        </div>
      </header>

      <section className="flex-1 flex flex-col justify-center max-w-6xl w-full mx-auto px-6 py-24">
        <p className="font-mono text-[11px] tracking-[0.25em] text-mut mb-6">
          A MURDER MYSTERY IN FIVE ROUNDS
        </p>
        <h1 className="font-display text-[13vw] md:text-[8.5rem] leading-[0.95] tracking-[-0.03em] mb-4">
          OPERATION
          <br />
          <span className="text-blood">ZERO HOUR</span>
        </h1>
        <Typewriter
          text={"One body. Five rounds. A killer who will not wait."}
          className="font-mono text-mut text-sm md:text-base mt-8 max-w-xl"
          speed={38}
          startDelay={600}
        />
        <div className="hairline my-12" />
        <FadeIn delay={0.2}>
          <div className="flex flex-col sm:flex-row gap-4">
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
        </FadeIn>
      </section>

      <footer className="border-t border-linesoft">
        <div className="max-w-6xl mx-auto px-6 h-12 flex items-center justify-between font-mono text-[10px] tracking-[0.2em] text-mut">
          <span>DO NOT ATTEMPT TO TAMPER WITH EVIDENCE</span>
          <span>TM-XXX</span>
        </div>
      </footer>
    </main>
  );
}
