"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { getToken } from "@/lib/session";
import { useState } from "react";
import Typewriter from "@/components/typewriter";
import { FadeIn, Stagger } from "@/components/fade";
import { LockIcon } from "@/components/icons";

// Evidence tapes - gated server side. videos are returned empty when locked.
export default function Round3Page() {
  const token = getToken();
  const data = useQuery(api.videos.listVideos, token ? { token } : "skip");
  const [revealedIdx, setRevealedIdx] = useState<number[]>([]);

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
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between font-mono text-[11px] tracking-[0.2em] text-mut">
          <Link href="/story" className="hover:text-ink transition-colors">&lt; CASE FILE</Link>
          <span>ROUND 03 // THE EVIDENCE TAPES</span>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-20">
        <p className="font-mono text-[11px] tracking-[0.25em] text-mut mb-3">ROUND 3</p>
        <h1 className="font-display text-5xl md:text-7xl tracking-[-0.02em] mb-6">The Evidence Tapes</h1>
        <Typewriter
          text="Five pieces of footage. One of them lies."
          className="font-mono text-sm text-mut mb-4"
          speed={40}
          startDelay={400}
        />
        <div className="hairline my-12" />

        {data.locked ? (
          <FadeIn>
            <div className="border border-linesoft px-8 py-16 flex flex-col items-center text-center gap-5">
              <LockIcon size={34} className="text-mut" />
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
        ) : data.videos.length === 0 ? (
          <p className="font-mono text-xs text-mut">No tapes uploaded yet.</p>
        ) : (
          <Stagger className="grid md:grid-cols-2 gap-6">
            {data.videos.map((v, i) => {
              const revealed = revealedIdx.includes(i);
              return (
                <div key={v.order} className="border border-linesoft hover:border-line transition-colors">
                  <div className="aspect-video bg-[#070707] border-b border-linesoft flex items-center justify-center">
                    {revealed && v.embedUrl ? (
                      <iframe
                        src={v.embedUrl}
                        title={v.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="w-full h-full"
                      />
                    ) : (
                      <button
                        onClick={() => setRevealedIdx((a) => [...a, i])}
                        className="flex flex-col items-center gap-3 py-10 px-6 group"
                      >
                        <span className="font-mono text-[10px] tracking-[0.25em] text-mut group-hover:text-ink transition-colors">
                          TAPE {String(v.order).padStart(2, "0")} - LOAD
                        </span>
                        <span className="font-mono text-[9px] tracking-[0.2em] text-mut/60">
                          SANITIZED SURVEILLANCE FEED
                        </span>
                      </button>
                    )}
                  </div>
                  <div className="px-6 py-5">
                    <h2 className="font-display text-2xl tracking-tight mb-1.5">{v.title}</h2>
                    <p className="font-mono text-xs text-mut leading-relaxed">{v.caption}</p>
                  </div>
                </div>
              );
            })}
          </Stagger>
        )}
      </section>
    </main>
  );
}
