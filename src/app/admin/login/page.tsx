"use client";

import { useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveSession } from "@/lib/session";

export default function AdminLoginPage() {
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const login = useMutation(api.auth.adminLogin);
  const router = useRouter();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await login({
        email: emailRef.current?.value.trim() ?? "",
        password: passwordRef.current?.value ?? "",
      });
      if (res.ok) {
        saveSession(res.token, "admin", res.email);
        router.replace("/admin");
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
          RESTRICTED // LEVEL 5 CLEARANCE
        </p>
        <h1 className="font-display text-5xl tracking-[-0.02em] mb-10">
          Control Room
        </h1>
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="font-mono text-[10px] tracking-[0.2em] text-mut block mb-2" htmlFor="email">
              OPERATOR ID
            </label>
            <input
              id="email"
              ref={emailRef}
              autoFocus
              autoComplete="off"
              className="field font-mono w-full px-4 py-3.5 text-sm tracking-wider placeholder:text-[#3d3d3d]"
              placeholder="admin1@ozh.event"
              spellCheck={false}
            />
          </div>
          <div>
            <label className="font-mono text-[10px] tracking-[0.2em] text-mut block mb-2" htmlFor="password">
              PASSPHRASE
            </label>
            <input
              id="password"
              ref={passwordRef}
              type="password"
              autoComplete="current-password"
              className="field font-mono w-full px-4 py-3.5 text-sm tracking-wider placeholder:text-[#3d3d3d]"
              placeholder="----------------"
              spellCheck={false}
            />
          </div>
          {error && <p className="font-mono text-xs text-blood">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-ink text-bg font-mono text-xs tracking-[0.2em] py-4 hover:bg-white transition-colors active:scale-[0.99] disabled:opacity-40"
          >
            {busy ? "AUTHENTICATING..." : "ENTER CONTROL ROOM"}
          </button>
        </form>
      </div>
    </main>
  );
}
