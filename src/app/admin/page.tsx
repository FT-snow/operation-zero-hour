"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { clearSession, getToken } from "@/lib/session";
import { FadeIn } from "@/components/fade";
import * as XLSX from "xlsx";
import Papa from "papaparse";

type PreviewGroup = {
  teamName: string;
  members: { name: string; email?: string }[];
};

type Cred = { teamName: string; teamCode: string; password: string; members: string[] };

type Tab = "teams" | "rounds" | "results" | "logs";

const TAB_NAMES: Record<Tab, string> = {
  teams: "TEAMS",
  rounds: "ROUNDS",
  results: "RESULTS",
  logs: "LOGS",
};

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminPage() {
  const token = getToken();
  if (!token) return null;
  return <AdminInner token={token} />;
}

function AdminInner({ token }: { token: string }) {
  const [tab, setTab] = useState<Tab>("teams");
  const logout = useMutation(api.auth.logout);
  const router = useRouter();
  const who = useQuery(api.auth.whoamiInternal, token ? { token } : "skip");

  async function doLogout() {
    try {
      await logout({ token });
    } catch {
      /* ignore */
    }
    clearSession();
    router.replace("/admin/login");
  }

  const tabs: Tab[] = ["teams", "rounds", "results", "logs"];

  return (
    <main className="min-h-screen">
      <header className="border-b border-linesoft sticky top-0 bg-black/90 backdrop-blur z-40">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="#" className="font-mono text-[11px] tracking-[0.25em] text-ink">
            OPERATION ZERO HOUR <span className="text-blood">// CONTROL ROOM</span>
          </Link>
          <div className="flex items-center gap-6 font-mono text-[11px]">
            <span className="text-mut">{who?.email ?? ""}</span>
            <button onClick={doLogout} className="text-mut hover:text-ink transition-colors tracking-[0.15em]">
              SIGN OUT
            </button>
          </div>
        </div>
        <nav className="max-w-7xl mx-auto px-6 flex gap-8 border-t border-linesoft">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-3 font-mono text-[10px] tracking-[0.25em] border-b-2 -mb-px transition-colors ${
                tab === t
                  ? "text-ink border-ink"
                  : "text-mut border-transparent hover:text-ink"
              }`}
            >
              {TAB_NAMES[t]}
            </button>
          ))}
        </nav>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-10">
        {tab === "teams" && <TeamsTab token={token} />}
        {tab === "rounds" && <RoundsTab token={token} />}
        {tab === "results" && <ResultsTab token={token} />}
        {tab === "logs" && <LogsTab token={token} />}
      </div>
    </main>
  );
}

/* ============================ TEAMS TAB ============================ */

function TeamsTab({ token }: { token: string }) {
  const teamsData = useQuery(api.teams.listAdmin, { token });
  const generate = useMutation(api.teams.generateCredentials);
  const resetPw = useMutation(api.auth.resetPassword);
  const deleteTeam = useMutation(api.auth.teamDelete);

  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<PreviewGroup[] | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [creds, setCreds] = useState<Cred[] | null>(null);
  const [opsError, setOpsError] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newMember, setNewMember] = useState("");
  const addMember = useMutation(api.auth.teamExtend);
  const removeMember = useMutation(api.auth.teamRemoveMember);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setPreviewError("");
    setPreview(null);
    setCreds(null);
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) throw new Error("Empty workbook");
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "", raw: false });

      // Columns (case-insensitive, fuzzy): team name?, participant name, email
      const cols = Object.keys(rows[0] ?? {});
      const findCol = (...needles: string[]) =>
        cols.find((c) => needles.some((n) => c.toLowerCase().replace(/[^a-z]/g, "").includes(n))) ?? null;
      const teamCol = findCol("teamname", "team", "groupname");
      const partCol = findCol("participantname", "participant", "membername", "name", "fullname");
      const emailCol = findCol("email", "mail");

      if (!partCol) {
        // Fallback: first non-shifted column is participant name
      }

      const groups = new Map<string, PreviewGroup>();
      for (const row of rows) {
        const participant = String(row[partCol ?? cols[0]] ?? "").trim();
        if (!participant) continue; // skip fully blank rows
        const teamRaw = String(row[teamCol ?? ""] ?? "").trim();
        const email = emailCol ? String(row[emailCol] ?? "").trim() || undefined : undefined;
        const key = teamRaw || `solo:${participant}`;
        if (!groups.has(key)) {
          groups.set(key, { teamName: teamRaw, members: [] });
        }
        groups.get(key)!.members.push({ name: participant, email });
      }
      const arr = Array.from(groups.values());
      if (arr.length === 0) {
        setPreviewError("No valid rows found. Need a participant-name column.");
        return;
      }
      setPreview(arr);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : "Could not parse file");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function doGenerate() {
    if (!preview) return;
    setGenerating(true);
    setOpsError("");
    try {
      const res = await generate({
        token,
        groups: preview.map((g) => ({
          teamName: g.teamName.trim(),
          members: g.members.map((m) => ({ name: m.name, email: m.email || undefined })),
        })),
      });
      if (res.ok) {
        setCreds(res.credentials);
        setPreview(null);
      } else {
        setOpsError(res.error);
      }
    } catch (err) {
      setOpsError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function doReset(teamCode: string) {
    if (!confirm(`Reset password for ${teamCode}? Old sessions will be killed.`)) return;
    const res = await resetPw({ token, teamCode });
    if (res.ok) {
      alert(`New password for ${teamCode}: ${res.password}\n\nShown once - copy it now.`);
    } else {
      alert(res.error);
    }
  }

  async function doDelete(teamCode: string) {
    if (!confirm(`Delete ${teamCode} entirely? This cannot be undone.`)) return;
    const res = await deleteTeam({ token, teamCode });
    if (!res.ok) alert(res.error);
  }

  async function doAddMember(teamCode: string) {
    const name = newMember.trim();
    if (!name) return;
    const res = await addMember({ token, teamCode, memberName: name });
    if (res.ok) setNewMember("");
    else setOpsError(res.error);
  }

  async function doRemoveMember(teamCode: string, participantId: string) {
    const res = await removeMember({ token, teamCode: teamCode, participantId: participantId as never });
    if (!res.ok) setOpsError(res.error);
  }

  if (!teamsData) {
    return <p className="font-mono text-xs text-mut blink tracking-[0.25em]">LOADING TEAMS...</p>;
  }

  const teams = teamsData.teams;

  return (
    <div className="space-y-10">
      <FadeIn>
        <div className="border border-linesoft p-8">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="font-display text-3xl tracking-tight">Team Import</h2>
              <p className="font-mono text-[10px] tracking-[0.15em] text-mut mt-1">
                EXCEL OR CSV: TEAM NAME (OPTIONAL), PARTICIPANT NAME, EMAIL (OPTIONAL). EACH ROW = ONE PERSON.
              </p>
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              className="border border-line text-ink font-mono text-[11px] tracking-[0.2em] px-6 py-3 hover:bg-ink hover:text-bg transition-colors active:scale-[0.98]"
            >
              {preview ? "REPLACE FILE" : "UPLOAD FILE"}
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onFile} className="hidden" />
          </div>

          {previewError && <p className="font-mono text-xs text-blood mb-4">{previewError}</p>}
          {opsError && <p className="font-mono text-xs text-blood mb-4">{opsError}</p>}

          {preview && (
            <div className="border-t border-linesoft pt-6">
              <div className="flex items-center justify-between mb-4">
                <p className="font-mono text-[10px] tracking-[0.2em] text-mut">
                  PREVIEW - {preview.length} TEAM(S), {preview.reduce((a, g) => a + g.members.length, 0)} MEMBER(S)
                  {" - "}
                  <span className={preview.every((g) => g.teamName.trim()) ? "text-sage" : "text-amber"}>
                    NAMED {preview.filter((g) => g.teamName.trim()).length}/{preview.length}
                  </span>
                </p>
                <button
                  onClick={doGenerate}
                  disabled={generating || !preview.every((g) => g.teamName.trim())}
                  className="bg-ink text-bg font-mono text-[11px] tracking-[0.2em] px-6 py-3 hover:bg-white transition-colors disabled:opacity-40"
                >
                  {generating ? "GENERATING..." : "GENERATE CREDENTIALS"}
                </button>
              </div>
              <div className="max-h-96 overflow-y-auto border border-linesoft">
                <table className="w-full font-mono text-xs">
                  <thead className="sticky top-0 bg-[#0d0d0d]">
                    <tr className="text-left text-mut">
                      <th className="px-4 py-2.5 font-normal w-52">TEAM NAME (NAME EACH)</th>
                      <th className="px-4 py-2.5 font-normal">MEMBERS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((g, i) => (
                      <tr key={i} className="border-t border-linesoft">
                        <td className="px-4 py-2">
                          <input
                            value={g.teamName}
                            onChange={(e) =>
                              setPreview((p) => {
                                if (!p) return p;
                                const next = [...p];
                                next[i] = { ...next[i], teamName: e.target.value };
                                return next;
                              })
                            }
                            placeholder={`UNNAMED TEAM ${i + 1}`}
                            className={`field font-mono text-[11px] px-3 py-2 w-full ${
                              g.teamName.trim() ? "text-ink" : "text-mut"
                            }`}
                          />
                        </td>
                        <td className="px-4 py-2 text-mut">{g.members.map((m) => m.name).join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {creds && (
            <div className="border-t border-linesoft pt-6">
              <div className="flex items-center justify-between mb-4">
                <p className="font-mono text-[11px] tracking-[0.15em] text-sage">
                  {creds.length} TEAM(S) CREATED. PASSWORDS SHOWN ONCE.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() =>
                      downloadCsv("operation-zero-hour-credentials.csv", [
                        ["Team Name", "Team ID", "Password", "Members"],
                        ...creds.map((c) => [c.teamName, c.teamCode, c.password, c.members.join(" | ")]),
                      ])
                    }
                    className="bg-ink text-bg font-mono text-[11px] tracking-[0.2em] px-5 py-3 hover:bg-white transition-colors"
                  >
                    DOWNLOAD CSV
                  </button>
                  <button
                    onClick={() => navigator.clipboard.writeText(
                      creds.map((c) => `${c.teamName},${c.teamCode},${c.password}`).join("\n")
                    )}
                    className="border border-line text-mut hover:text-ink font-mono text-[11px] tracking-[0.2em] px-5 py-3 transition-colors"
                  >
                    COPY ALL
                  </button>
                </div>
              </div>
              <div className="max-h-72 overflow-y-auto border border-linesoft">
                <table className="w-full font-mono text-xs">
                  <thead className="sticky top-0 bg-[#0d0d0d]">
                    <tr className="text-left text-mut">
                      <th className="px-4 py-2.5 font-normal">TEAM NAME</th>
                      <th className="px-4 py-2.5 font-normal">TEAM ID</th>
                      <th className="px-4 py-2.5 font-normal">PASSWORD</th>
                      <th className="px-4 py-2.5 font-normal">MEMBERS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {creds.map((c) => (
                      <tr key={c.teamCode} className="border-t border-linesoft">
                        <td className="px-4 py-2.5">{c.teamName}</td>
                        <td className="px-4 py-2.5 text-amber">{c.teamCode}</td>
                        <td className="px-4 py-2.5 text-ink">{c.password}</td>
                        <td className="px-4 py-2.5 text-mut">{c.members.join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </FadeIn>

      <FadeIn>
        <div className="border border-linesoft p-8">
          <p className="font-mono text-[10px] tracking-[0.2em] text-mut mb-5">
            ROSTER - {teams.length} TEAM(S)
          </p>
          {teams.length === 0 ? (
            <p className="font-mono text-xs text-mut">No teams yet. Upload the Excel above.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full font-mono text-xs">
                <thead>
                  <tr className="text-left text-mut border-b border-linesoft">
                    <th className="px-4 py-2.5 font-normal">TEAM ID</th>
                    <th className="px-4 py-2.5 font-normal">NAME</th>
                    <th className="px-4 py-2.5 font-normal">MEMBERS</th>
                    <th className="px-4 py-2.5 font-normal text-right">ADMIN</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((t) => (
                    <tr key={t.teamCode} className="border-b border-linesoft align-top">
                      <td className="px-4 py-3 text-amber">{t.teamCode}</td>
                      <td className="px-4 py-3">{t.teamName || <span className="text-mut">(SOLO)</span>}</td>
                      <td className="px-4 py-3 text-mut">
                        {expanded === t.teamCode ? (
                          <div className="space-y-1">
                            {t.members.map((m) => (
                              <div key={m._id} className="flex items-center gap-3">
                                <span>- {m.name}</span>
                                <button
                                  onClick={() => doRemoveMember(t.teamCode, m._id)}
                                  className="text-blood hover:underline text-[10px]"
                                >
                                  REMOVE
                                </button>
                              </div>
                            ))}
                            <div className="flex items-center gap-2 pt-2">
                              <input
                                value={newMember}
                                onChange={(e) => setNewMember(e.target.value)}
                                placeholder="ADD MEMBER..."
                                className="field font-mono text-[11px] px-3 py-1.5 w-44"
                              />
                              <button
                                onClick={() => doAddMember(t.teamCode)}
                                className="border border-line px-3 py-1.5 hover:text-ink"
                              >
                                ADD
                              </button>
                              <button
                                onClick={() => setExpanded(null)}
                                className="text-mut hover:text-ink border border-line px-3 py-1.5"
                              >
                                CLOSE
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setExpanded(t.teamCode)} className="hover:text-ink text-left">
                            {t.members.map((m) => m.name).join(", ") || "(empty)"}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => doReset(t.teamCode)} className="text-mut hover:text-ink mr-4 text-[10px] tracking-[0.15em]">
                          RESET PW
                        </button>
                        <button onClick={() => doDelete(t.teamCode)} className="text-blood/70 hover:text-blood text-[10px] tracking-[0.15em]">
                          DELETE
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </FadeIn>
    </div>
  );
}

/* ============================ ROUNDS TAB ============================ */

function RoundsTab({ token }: { token: string }) {
  const roundsData = useQuery(api.rounds.listAdmin, { token });
  const config = useQuery(api.rounds.configGet, { token });
  const videos = useQuery(api.rounds.videosAdmin, { token });
  const clues = useQuery(api.rounds.cluesAdmin, { token });
  const setStatus = useMutation(api.rounds.setStatus);
  const revealVids = useMutation(api.rounds.revealVideos);
  const hideVids = useMutation(api.rounds.hideVideos);
  const setCode = useMutation(api.rounds.setRound4Code);
  const setKiller = useMutation(api.rounds.setRealKiller);
  const setVideo = useMutation(api.rounds.setVideo);
  const setClue = useMutation(api.rounds.setClue);

  const [codeInput, setCodeInput] = useState("");
  const [killerInput, setKillerInput] = useState("");
  const [suspectsInput, setSuspectsInput] = useState("");
  const [msg, setMsg] = useState("");
  const [videoDraft, setVideoDraft] = useState<Record<number, { title: string; caption: string; embedUrl: string }>>({});
  const [clueDraft, setClueDraft] = useState<Record<number, { title: string; body: string }>>({});

  if (!roundsData || !config) {
    return <p className="font-mono text-xs text-mut blink tracking-[0.25em]">LOADING ROUNDS...</p>;
  }

  const roundNames: Record<number, string> = {
    1: "The Scene",
    2: "The Statements",
    3: "The Evidence Tapes",
    4: "The Code",
    5: "The Accusation",
  };

  async function doStatus(round: number, status: string) {
    setMsg("");
    const res = await setStatus({ token, roundNumber: round, status });
    if (res.ok) setMsg(`Round ${round} -> ${status}`);
    else setMsg(res.error);
  }

  async function doSetCode() {
    setMsg("");
    if (!codeInput.trim()) return;
    const res = await setCode({ token, code: codeInput });
    if (res.ok) {
      setCodeInput("");
      setMsg("Round 4 code updated (hashed). Teams that already cleared stay cleared.");
    } else setMsg(res.error);
  }

  async function doSetKiller() {
    setMsg("");
    const suspects = suspectsInput.split(",").map((s) => s.trim()).filter(Boolean);
    const res = await setKiller({ token, killer: killerInput, suspects });
    if (res.ok) setMsg("Killer + suspects saved.");
    else setMsg(res.error);
  }

  async function doSaveVideo(order: number) {
    const d = videoDraft[order];
    if (!d) return;
    const res = await setVideo({ token, order, title: d.title, caption: d.caption, embedUrl: parseEmbed(d.embedUrl) });
    if (res.ok) setMsg(`Video ${order} saved.`);
    else setMsg(res.error);
  }

  async function doSaveClue(order: number) {
    const d = clueDraft[order];
    if (!d) return;
    await setClue({ token, order, title: d.title, body: d.body });
    setMsg(`Clue ${order} saved.`);
  }

  async function doReveal(reveal: boolean) {
    if (reveal) await revealVids({ token });
  }
  void doReveal;

  return (
    <div className="space-y-6">
      {msg && <p className="font-mono text-xs text-sage">{msg}</p>}
      {roundsData.rounds.map((r) => (
        <FadeIn key={r.roundNumber}>
          <div className="border border-linesoft p-7">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div className="flex items-baseline gap-4">
                <span className="font-display text-5xl text-[#242424] leading-none">
                  {String(r.roundNumber).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="font-display text-2xl">{roundNames[r.roundNumber]}</h3>
                  <p className="font-mono text-[10px] tracking-[0.2em] text-mut mt-1">
                    STATUS: {r.status.toUpperCase()}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {r.roundNumber !== 5 && (
                  <button
                    onClick={() => doStatus(r.roundNumber, "live")}
                    disabled={r.status === "live"}
                    className="border border-line font-mono text-[10px] tracking-[0.2em] px-4 py-2.5 hover:bg-ink hover:text-bg transition-colors disabled:opacity-25 disabled:hover:bg-transparent"
                  >
                    SET LIVE
                  </button>
                )}
                {r.roundNumber === 3 && (
                  <button
                    onClick={async () => { await revealVids({ token }); setMsg("Tapes revealed."); }}
                    className="border border-amber/40 text-amber font-mono text-[10px] tracking-[0.2em] px-4 py-2.5 hover:bg-amber/10 transition-colors"
                  >
                    {r.videosRevealed ? "RE-REVEAL TAPES" : "REVEAL TAPES"}
                  </button>
                )}
                <button
                  onClick={() => doStatus(r.roundNumber, "closed")}
                  disabled={r.status === "closed" || r.status === "not_started"}
                  className="border border-blood/50 text-blood font-mono text-[10px] tracking-[0.2em] px-4 py-2.5 hover:bg-blood/10 transition-colors disabled:opacity-25 disabled:hover:bg-transparent"
                >
                  CLOSE ROUND
                </button>
                {r.roundNumber === 5 && r.status === "closed" && (
                  <button
                    onClick={() => doStatus(r.roundNumber, "not_started")}
                    className="border border-line font-mono text-[10px] tracking-[0.2em] px-4 py-2.5 hover:bg-ink hover:text-bg transition-colors"
                  >
                    REOPEN DOOR
                  </button>
                )}
              </div>
            </div>

            {/* Round 3: video editor */}
            {r.roundNumber === 3 && (
              <div className="border-t border-linesoft pt-5 mt-4">
                <p className="font-mono text-[10px] tracking-[0.2em] text-mut mb-4">
                  EVIDENCE TAPES {r.videosRevealed ? "- CURRENTLY REVEALED TO TEAMS" : "- HIDDEN UNTIL REVEAL PRESSED"}
                </p>
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((order) => {
                    const existing = videos?.videos.find((v) => v.order === order);
                    const d = videoDraft[order] ?? {
                      title: existing?.title ?? "",
                      caption: existing?.caption ?? "",
                      embedUrl: existing?.embedUrl ?? "",
                    };
                    return (
                      <div key={order} className="grid md:grid-cols-[24px_1fr_1.4fr_1.2fr_auto] gap-2 items-center">
                        <span className="font-mono text-xs text-mut">{String(order).padStart(2, "0")}</span>
                        <input
                          value={d.title}
                          onChange={(e) => setVideoDraft((p) => ({ ...p, [order]: { ...d, title: e.target.value } }))}
                          placeholder="TITLE"
                          className="field font-mono text-[11px] px-3 py-2"
                        />
                        <input
                          value={d.caption}
                          onChange={(e) => setVideoDraft((p) => ({ ...p, [order]: { ...d, caption: e.target.value } }))}
                          placeholder="CAPTION"
                          className="field font-mono text-[11px] px-3 py-2"
                        />
                        <input
                          value={d.embedUrl}
                          onChange={(e) => setVideoDraft((p) => ({ ...p, [order]: { ...d, embedUrl: e.target.value } }))}
                          placeholder="EMBED URL"
                          className="field font-mono text-[11px] px-3 py-2"
                        />
                        <button
                          onClick={() => doSaveVideo(order)}
                          className="border border-line font-mono text-[10px] tracking-[0.15em] px-3 py-2 hover:bg-ink hover:text-bg transition-colors"
                        >
                          SAVE
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Round 4: code + clue editor */}
            {r.roundNumber === 4 && (
              <div className="border-t border-linesoft pt-5 mt-4">
                <p className="font-mono text-[10px] tracking-[0.2em] text-mut mb-4">
                  ACCESS CODE {config.round4CodeSet ? "- CONFIGURED (HASHED, NEVER SHOWN)" : "- NOT SET"}
                </p>
                <div className="flex gap-3 mb-6">
                  <input
                    value={codeInput}
                    onChange={(e) => setCodeInput(e.target.value.toUpperCase().slice(0, 8))}
                    placeholder="NEW ACCESS CODE"
                    className="field font-mono text-sm tracking-[0.3em] px-4 py-2.5 max-w-xs"
                    spellCheck={false}
                  />
                  <button
                    onClick={doSetCode}
                    disabled={!codeInput.trim()}
                    className="border border-line font-mono text-[10px] tracking-[0.2em] px-5 py-2.5 hover:bg-ink hover:text-bg transition-colors disabled:opacity-30"
                  >
                    SET / CHANGE CODE
                  </button>
                </div>
                <p className="font-mono text-[10px] tracking-[0.2em] text-mut mb-4">
                  CLUES (SHOWN ONLY TO TEAMS THAT SOLVE THE CODE)
                </p>
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((order) => {
                    const existing = clues?.clues.find((c) => c.order === order);
                    const d = clueDraft[order] ?? { title: existing?.title ?? "", body: existing?.body ?? "" };
                    return (
                      <div key={order} className="grid md:grid-cols-[24px_1fr_2fr_auto] gap-2 items-start">
                        <span className="font-mono text-xs text-mut pt-2">{String(order).padStart(2, "0")}</span>
                        <input
                          value={d.title}
                          onChange={(e) => setClueDraft((p) => ({ ...p, [order]: { ...d, title: e.target.value } }))}
                          placeholder="CLUE TITLE"
                          className="field font-mono text-[11px] px-3 py-2"
                        />
                        <textarea
                          value={d.body}
                          onChange={(e) => setClueDraft((p) => ({ ...p, [order]: { ...d, body: e.target.value } }))}
                          placeholder="Clue text..."
                          rows={2}
                          className="field font-mono text-[11px] px-3 py-2 resize-y"
                        />
                        <button
                          onClick={() => doSaveClue(order)}
                          className="border border-line font-mono text-[10px] tracking-[0.15em] px-3 py-2 hover:bg-ink hover:text-bg transition-colors"
                        >
                          SAVE
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Round 5: killer config */}
            {r.roundNumber === 5 && (
              <div className="border-t border-linesoft pt-5 mt-4">
                <p className="font-mono text-[10px] tracking-[0.2em] text-amber mb-2">
                  AUTO-OPEN - ROUND 5 UNLOCKS FOR EACH TEAM THE MOMENT IT CLEARS ROUND 04.
                </p>
                <p className="font-mono text-[10px] tracking-[0.2em] text-mut mb-4">
                  YOU ONLY CONTROL THE DOOR: "CLOSE ROUND" SHUTS IT FOR EVERYONE.
                </p>
                <p className="font-mono text-[10px] tracking-[0.2em] text-mut mb-4">
                  VERDICT {config.hasKiller ? `- KILLER: ${config.realKiller?.toUpperCase()}` : "- NOT SET"}
                </p>
                <div className="space-y-3">
                  <input
                    value={suspectsInput}
                    onChange={(e) => setSuspectsInput(e.target.value)}
                    placeholder="SUSPECTS COMMA-SEPARATED (E.G. COLONEL MUSTARD, MRS WHITE, THE GHOST)"
                    className="field font-mono text-[11px] px-4 py-2.5 w-full"
                  />
                  <div className="flex gap-3">
                    <input
                      value={killerInput}
                      onChange={(e) => setKillerInput(e.target.value)}
                      placeholder="THE REAL KILLER (EXACT SUSPECT NAME)"
                      className="field font-mono text-[11px] px-4 py-2.5 flex-1"
                    />
                    <button
                      onClick={doSetKiller}
                      className="border border-line font-mono text-[10px] tracking-[0.2em] px-5 py-2.5 hover:bg-ink hover:text-bg transition-colors shrink-0"
                    >
                      SAVE VERDICT
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </FadeIn>
      ))}
    </div>
  );
}

function parseEmbed(url: string): string {
  // Convert YouTube watch URLs to embed form; passes through everything else.
  const yt = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/.exec(url);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  return url.trim();
}

/* ============================ RESULTS TAB ============================ */

function ResultsTab({ token }: { token: string }) {
  const solves = useQuery(api.round4.solveListAdmin, { token });
  const subs = useQuery(api.submissions.listAdmin, { token });
  const finals = useQuery(api.submissions.finalCorrectAdmin, { token });
  const config = useQuery(api.rounds.configGet, { token });
  const [onlyCorrect, setOnlyCorrect] = useState(false);

  if (!solves || !subs || !finals) {
    return <p className="font-mono text-xs text-mut blink tracking-[0.25em]">TALLYING RESULTS...</p>;
  }

  const shown = onlyCorrect ? subs.submissions.filter((s) => s.correct) : subs.submissions;

  return (
    <div className="space-y-10">
      {/* Round 4 solves */}
      <FadeIn>
        <section className="border border-linesoft p-7">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-3xl tracking-tight">Round 04 - Solve Ledger</h2>
            <span className="font-mono text-[10px] tracking-[0.2em] text-mut">
              {solves.solves.length} SOLVED (TIMESTAMPS ONLY - NO RANKING)
            </span>
          </div>
          {solves.solves.length === 0 ? (
            <p className="font-mono text-xs text-mut">No teams have cleared Round 04 yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full font-mono text-xs">
                <thead className="text-left text-mut border-b border-linesoft">
                  <tr>
                    <th className="px-4 py-2.5 font-normal">SOLVED AT (SERVER)</th>
                    <th className="px-4 py-2.5 font-normal">TEAM ID</th>
                    <th className="px-4 py-2.5 font-normal">TEAM NAME</th>
                  </tr>
                </thead>
                <tbody>
                  {solves.solves.map((s) => (
                    <tr key={s._id} className="border-b border-linesoft">
                      <td className="px-4 py-2.5 text-mut">{new Date(s.solvedAt).toISOString().replace("T", " ").slice(0, 19)}</td>
                      <td className="px-4 py-2.5 text-amber">{s.teamCode}</td>
                      <td className="px-4 py-2.5">{s.teamName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </FadeIn>

      {/* Round 5 - ranked submissions: 1st / 2nd / 3rd */}
      <FadeIn>
        <section className="border border-linesoft p-7">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <h2 className="font-display text-3xl tracking-tight">Round 05 - Submissions</h2>
            <span className="font-mono text-[10px] tracking-[0.2em] text-mut">
              {subs.total} FILED - {subs.correctCount} CORRECT
            </span>
          </div>
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            {[0, 1, 2].map((i) => {
              const s = finals.ranked[i];
              const rank = ["1ST", "2ND", "3RD"][i];
              return (
                <div
                  key={i}
                  className={`border px-6 py-6 ${
                    s
                      ? i === 0
                        ? "border-amber/60 text-amber"
                        : i === 1
                        ? "border-[#8a8a85]"
                        : "border-[#a9705a]"
                      : "border-linesoft"
                  }`}
                >
                  <p className="font-mono text-[10px] tracking-[0.3em] mb-3">{rank}</p>
                  {s ? (
                    <>
                      <p className="font-display text-2xl mb-1">{s.teamName}</p>
                      <p className="font-mono text-[10px] text-mut">
                        {s.teamCode} - {new Date(s.submittedAt).toISOString().replace("T", " ").slice(11, 19)}
                      </p>
                    </>
                  ) : (
                    <p className="font-mono text-[10px] text-mut">AWAITING SUBMISSION</p>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between mb-4">
            <p className="font-mono text-[10px] tracking-[0.2em] text-mut">
              ALL SUBMISSIONS {config?.hasKiller ? `(VERDICT: ${config.realKiller?.toUpperCase()})` : ""}
            </p>
            <label className="flex items-center gap-3 font-mono text-[10px] tracking-[0.15em] text-mut cursor-pointer select-none">
              <span className={onlyCorrect ? "text-sage" : ""}>CORRECT KILLER ONLY</span>
              <button
                onClick={() => setOnlyCorrect((v) => !v)}
                className={`w-9 h-5 border border-line relative transition-colors ${onlyCorrect ? "bg-sage/20" : ""}`}
              >
                <span
                  className={`absolute top-[3px] h-3 w-3 transition-all ${onlyCorrect ? "left-[19px] bg-sage" : "left-[3px] bg-mut"}`}
                />
              </button>
            </label>
          </div>
          {shown.length === 0 ? (
            <p className="font-mono text-xs text-mut">No submissions yet.</p>
          ) : (
            <div className="overflow-x-auto border border-linesoft max-h-96 overflow-y-auto">
              <table className="w-full font-mono text-xs">
                <thead className="sticky top-0 bg-[#0d0d0d] text-left text-mut">
                  <tr>
                    <th className="px-4 py-2.5 font-normal">#</th>
                    <th className="px-4 py-2.5 font-normal">TEAM</th>
                    <th className="px-4 py-2.5 font-normal">ACCUSED</th>
                    <th className="px-4 py-2.5 font-normal">VERDICT</th>
                    <th className="px-4 py-2.5 font-normal">FILED AT</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((s, i) => (
                    <tr key={s._id} className="border-t border-linesoft">
                      <td className="px-4 py-2.5 text-mut">{String(i + 1).padStart(3, "0")}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-amber mr-2">{s.teamCode}</span>
                        {s.teamName}
                      </td>
                      <td className="px-4 py-2.5">{s.killer}</td>
                      <td className={`px-4 py-2.5 ${s.correct ? "text-sage" : "text-blood"}`}>
                        {s.correct ? "CORRECT" : "WRONG"}
                      </td>
                      <td className="px-4 py-2.5 text-mut">{new Date(s.submittedAt).toISOString().replace("T", " ").slice(11, 19)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </FadeIn>

      {/* Final correct list + export */}
      <FadeIn>
        <section className="border border-linesoft p-7">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-3xl tracking-tight">Verdict Ledger</h2>
            <div className="flex gap-3">
              <button
                onClick={() =>
                  downloadCsv("zero-hour-round4-solves.csv", [
                    ["Solved At (server)", "Team ID", "Team Name"],
                    ...solves.solves.map((s) => [
                      new Date(s.solvedAt).toISOString(),
                      s.teamCode,
                      s.teamName,
                    ]),
                  ])
                }
                className="border border-line text-mut hover:text-ink font-mono text-[10px] tracking-[0.2em] px-4 py-2.5 transition-colors"
              >
                EXPORT SOLVES CSV
              </button>
              <button
                onClick={() =>
                  downloadCsv("zero-hour-round5-submissions.csv", [
                    ["Team ID", "Team Name", "Accused", "Verdict", "Filed At (server)"],
                    ...subs.submissions.map((s) => [
                      s.teamCode,
                      s.teamName,
                      s.killer,
                      s.correct ? "CORRECT" : "WRONG",
                      new Date(s.submittedAt).toISOString(),
                    ]),
                  ])
                }
                className="border border-line text-mut hover:text-ink font-mono text-[10px] tracking-[0.2em] px-4 py-2.5 transition-colors"
              >
                EXPORT SUBMISSIONS CSV
              </button>
            </div>
          </div>
          {finals.ranked.length === 0 ? (
            <p className="font-mono text-xs text-mut">
              No correct-killer submissions yet{finals.realKiller ? "" : " - verdict not configured"}. Sleuths keep working.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full font-mono text-xs">
                <thead className="text-left text-mut border-b border-linesoft">
                  <tr>
                    <th className="px-4 py-2.5 font-normal">RANK</th>
                    <th className="px-4 py-2.5 font-normal">TEAM</th>
                    <th className="px-4 py-2.5 font-normal">FILED AT</th>
                  </tr>
                </thead>
                <tbody>
                  {finals.ranked.map((s, i) => (
                    <tr key={s.teamCode} className="border-b border-linesoft">
                      <td className={`px-4 py-2.5 ${i < 3 ? "text-amber" : "text-mut"}`}>
                        {i === 0 ? "1ST" : i === 1 ? "2ND" : i === 2 ? "3RD" : `${i + 1}TH`}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-amber mr-2">{s.teamCode}</span>
                        {s.teamName}
                      </td>
                      <td className="px-4 py-2.5 border-b border-linesoft text-mut">
                        {new Date(s.submittedAt).toISOString().replace("T", " ").slice(0, 19)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </FadeIn>
    </div>
  );
}

/* ============================ LOGS TAB ============================ */

function LogsTab({ token }: { token: string }) {
  const logs = useQuery(api.logs.listAdmin, { token, limit: 200 });
  const attempts = useQuery(api.round4.attemptsAdmin, { token, limit: 100 });

  if (!logs) {
    return <p className="font-mono text-xs text-mut blink tracking-[0.25em]">READING THE LEDGER...</p>;
  }

  return (
    <div className="space-y-10">
      <FadeIn>
        <section className="border border-linesoft p-7">
          <h2 className="font-display text-3xl tracking-tight mb-5">Audit Trail</h2>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full font-mono text-xs">
              <thead className="sticky top-0 bg-[#0d0d0d] text-left text-mut">
                <tr>
                  <th className="px-4 py-2.5 font-normal">TIME (UTC)</th>
                  <th className="px-4 py-2.5 font-normal">BY</th>
                  <th className="px-4 py-2.5 font-normal">ACTION</th>
                  <th className="px-4 py-2.5 font-normal">DETAILS</th>
                </tr>
              </thead>
              <tbody>
                {logs.entries.map((l) => (
                  <tr key={l._id} className="border-t border-linesoft">
                    <td className="px-4 py-2.5 text-mut whitespace-nowrap">
                      {new Date(l.at).toISOString().replace("T", " ").slice(0, 19)}
                    </td>
                    <td className="px-4 py-2.5 text-mut">{l.adminLabel}</td>
                    <td className="px-4 py-2.5 text-amber whitespace-nowrap">{l.action}</td>
                    <td className="px-4 py-2.5">{l.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </FadeIn>

      {attempts && (
        <FadeIn>
          <section className="border border-linesoft p-7">
            <h2 className="font-display text-3xl tracking-tight mb-5">Round 04 - Attempt Feed</h2>
            {attempts.attempts.length === 0 ? (
              <p className="font-mono text-xs text-mut">No attempts logged yet.</p>
            ) : (
              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full font-mono text-xs">
                  <thead className="sticky top-0 bg-[#0d0d0d] text-left text-mut">
                    <tr>
                      <th className="px-4 py-2.5 font-normal">TIME (UTC)</th>
                      <th className="px-4 py-2.5 font-normal">TEAM</th>
                      <th className="px-4 py-2.5 font-normal">RESULT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attempts.attempts.map((a, i) => (
                      <tr key={i} className="border-t border-linesoft">
                        <td className="px-4 py-2.5 text-mut whitespace-nowrap">
                          {new Date(a.at).toISOString().replace("T", " ").slice(0, 19)}
                        </td>
                        <td className="px-4 py-2.5 text-amber">{a.teamCode}</td>
                        <td className={`px-4 py-2.5 ${a.isCorrect ? "text-sage" : "text-mut"}`}>
                          {a.isCorrect ? "CORRECT (BOLT RELEASED)" : "WRONG"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </FadeIn>
      )}
    </div>
  );
}
