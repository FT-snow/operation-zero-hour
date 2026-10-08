"use client";

import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Typewriter from "@/components/typewriter";
import { saveSession } from "@/lib/session";

export default function TeamLoginPage() {
  const teamCodeRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const login = useMutation(api.auth.teamLogin);
  const router = useRouter();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await login({
        teamCode: teamCodeRef.current?.value.trim() ?? "",
        password: passwordRef.current?.value ?? "",
      });
      if (res.ok) {
        saveSession(res.token, "team", `${res.teamCode} - ${res.teamName}`);
        router.replace("/story");
      } else {
        setError(res.error);
        setBusy(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <p className="font-mono text-[11px] tracking-[0.25em] text-mut mb-3">
          CASE FILE // NO. 001
        </p>
        <h1 className="font-display text-5xl tracking-[-0.02em] mb-1">Operation Zero Hour</h1>
        <Typewriter
          text="Identify yourself, detective."
          className="font-mono text-sm text-mut mb-10"
          speed={42}
          startDelay={500}
        />
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="font-mono text-[10px] tracking-[0.2em] text-mut block mb-2" htmlFor="teamCode">
              TEAM ID
            </label>
            <input
              id="teamCode"
              ref={teamCodeRef}
              autoFocus
              autoComplete="off"
              className="field font-mono w-full px-4 py-3.5 text-sm tracking-wider placeholder:text-[#3d3d3d]"
              placeholder="TM-001"
              spellCheck={false}
            />
          </div>
          <div>
            <label className="font-mono text-[10px] tracking-[0.2em] text-mut block mb-2" htmlFor="password">
              ACCESS KEY
            </label>
            <input
              id="password"
              ref={passwordRef}
              type="password"
              autoComplete="current-password"
              className="field font-mono w-full px-4 py-3.5 text-sm tracking-wider placeholder:text-[#3d3d3d]"
              placeholder="XXXXXXXX"
              spellCheck={false}
            />
          </div>
          {error && (
            <p className="font-mono text-xs text-blood">{error}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-ink text-bg font-mono text-xs tracking-[0.2em] py-4 hover:bg-white transition-colors active:scale-[0.99] disabled:opacity-40"
          >
            {busy ? "VERIFYING..." : "ENTER THE FILE"}
          </button>
        </form>
        <p className="font-mono text-[10px] tracking-[0.15em] text-mut mt-10 text-center">
          LOST CREDENTIALS? CONTACT THE CONTROL ROOM.
        </p>
      </div>
    </main>
  );
}
