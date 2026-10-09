"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { getToken } from "@/lib/session";
import { FadeIn } from "@/components/fade";

// Evidence tapes - gated server side. videos are returned empty when locked.
export default function Round3Page() {
  const token = getToken();
  const data = useQuery(api.videos.listVideos, token ? { token } : "skip");
  if (!data) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="font-mono text-xs tracking-[0.25em] text-mut blink">LOADING TAPES...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-linesoft">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4 font-mono text-[11px] tracking-[0.2em] text-mut">
          <Link href="/" className="text-ink hover:text-white transition-colors whitespace-nowrap">OPERATION ZERO HOUR</Link>
          <span className="hidden sm:inline text-mut whitespace-nowrap">ROUND 03 // THE EVIDENCE TAPES</span>
          <Link href="/story" className="hover:text-ink transition-colors whitespace-nowrap">&lt; CASE FILE</Link>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-20">
        <p className="font-mono text-[11px] tracking-[0.25em] text-mut mb-3">ROUND 3</p>
        <h1 className="font-display text-5xl md:text-7xl tracking-[-0.02em] mb-6">The Evidence Tapes</h1>

        <div className="hairline my-12" />

        {data.locked ? (
          <FadeIn>
            <div className="border border-linesoft px-8 py-16 flex flex-col items-center text-center gap-5">
              <p className="font-display text-3xl md:text-4xl max-w-xl leading-snug">
                The tapes remain sealed.
              </p>
              <p className="font-mono text-xs text-mut max-w-md leading-relaxed">
                {data.status === "closed"
                  ? "This door has been closed by the control room."
                  : "The control room has not opened this door. Wait for the signal."}
              </p>
              <Link
                href="/story"
                className="font-mono text-[10px] tracking-[0.2em] text-mut border border-line px-4 py-2.5 hover:text-ink transition-colors"
              >
                BACK TO THE FILE
              </Link>
            </div>
          </FadeIn>
        ) : (
          <div className="space-y-12">
            <FadeIn>
              <p className="font-mono text-sm md:text-base leading-relaxed text-ink max-w-3xl">
                We call in the suspect. For interrogation.
                Their testimonies uncover such sides of that dark night
                that were about to turn the story
                in directions we couldn&apos;t have seen coming.
              </p>
            </FadeIn>
            {data.driveUrl ? (
              <FadeIn>
                <a
                  href={data.driveUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="block border border-linesoft hover:border-line transition-colors px-8 py-10 group"
                >
                  <p className="font-mono text-[10px] tracking-[0.3em] text-mut mb-3">EVIDENCE UNSEALED</p>
                  <p className="font-display text-3xl md:text-4xl mb-3 group-hover:text-white transition-colors">
                    Open the Evidence Drive
                  </p>
                  <p className="font-mono text-xs text-mut">
                    THE INTERROGATION TAPES ARE WAITING IN THIS ARCHIVE &gt;
                  </p>
                </a>
              </FadeIn>
            ) : (
              <FadeIn>
                <p className="font-mono text-xs text-mut border border-linesoft px-8 py-10 text-center">
                  THE TAPES ARE BEING PREPARED - THE CONTROL ROOM WILL OPEN THE ARCHIVE SHORTLY.
                </p>
              </FadeIn>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
