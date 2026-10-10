"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import Papa from "papaparse";
import { useEffect, useState } from "react";
import { FadeIn } from "@/components/fade";

// Full server timestamp with millisecond precision
function stamp(ms: number): string {
  const iso = new Date(ms).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 23)} UTC`;
}

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

export default function FoodTab({ token }: { token: string }) {
  const cfg = useQuery(api.food.configFoodGet, { token });
  const menu = useQuery(api.food.menuAdmin, { token });
  const orders = useQuery(api.food.ordersAdmin, { token });
  const setConfig = useMutation(api.food.setFoodConfig);
  const setItem = useMutation(api.food.setMenuItem);
  const resetOrderMut = useMutation(api.food.resetOrder);
  const generateQrUploadUrl = useMutation(api.food.generatePaymentQrUploadUrl);
  const setPaymentQr = useMutation(api.food.setPaymentQr);

  const [rnameInput, setRnameInput] = useState("");
  const [vpaInput, setVpaInput] = useState("");
  const [linkInput, setLinkInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [evidenceDriveInput, setEvidenceDriveInput] = useState("");
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrBusy, setQrBusy] = useState(false);
  const [foodEnabledInput, setFoodEnabledInput] = useState(cfg?.foodEnabled ?? false);
  const [itemDraft, setItemDraft] = useState<Record<number, { name: string; price: string; veg: boolean; cat: string }>>({});
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!cfg) return;
    setRnameInput((value) => value || cfg.restaurantName);
    setVpaInput((value) => value || cfg.upiVpa);
    setLinkInput((value) => value || cfg.payLink);
    setNoteInput((value) => value || cfg.foodNote);
    setEvidenceDriveInput((value) => value || cfg.paymentEvidenceDriveUrl);
    setFoodEnabledInput(cfg.foodEnabled);
  }, [cfg]);

  if (!cfg || !menu || !orders) {
    return <p className="font-mono text-xs text-mut blink tracking-[0.25em]">LOADING FOOD DESK...</p>;
  }

  // master kitchen tally: summed quantities per item across every order
  const kitchenTally = (() => {
    const tally = new Map<string, number>();
    for (const o of orders.orders) {
      for (const i of o.items as { qty: number; name: string }[]) {
        tally.set(i.name, (tally.get(i.name) ?? 0) + i.qty);
      }
    }
    return Array.from(tally.entries()).sort((a, b) => b[1] - a[1]);
  })();

  const rows = Array.from({ length: 40 }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      {msg && <p className={`font-mono text-xs ${msg.includes("saved") ? "text-sage" : "text-blood"}`}>{msg}</p>}

      {/* restaurant config */}
      <FadeIn>
        <section className="border border-linesoft p-7">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display text-3xl tracking-tight">Restaurant</h2>
            <span className="font-mono text-[10px] tracking-[0.2em] text-mut">
              {cfg.restaurantName ? `- ${cfg.restaurantName.toUpperCase()}` : "- NOT SET"}
            </span>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <input
              value={rnameInput}
              onChange={(e) => setRnameInput(e.target.value)}
              placeholder="RESTAURANT NAME"
              className="field font-mono text-[11px] px-4 py-2.5"
            />
            <input
              value={vpaInput}
              onChange={(e) => setVpaInput(e.target.value)}
              placeholder="UPI ID (E.G. STORE@OKHDFC)"
              className="field font-mono text-[11px] px-4 py-2.5"
              spellCheck={false}
            />
            <input
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              placeholder="OR PAYMENT LINK (HTTPS://...)"
              className="field font-mono text-[11px] px-4 py-2.5"
              spellCheck={false}
            />
            <input
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="NOTE FOR TEAMS (E.G. PAY ON DELIVERY AVAILABLE)"
              className="field font-mono text-[11px] px-4 py-2.5"
            />
          </div>
          <label className="mt-4 flex items-center gap-3 font-mono text-[10px] tracking-[0.2em] text-mut">
            <input
              type="checkbox"
              checked={foodEnabledInput}
              onChange={(event) => setFoodEnabledInput(event.target.checked)}
              className="accent-[#f5f4f0]"
            />
            UNLOCK FOOD ORDERING FOR TEAMS
          </label>
          <button
            onClick={async () => {
              setMsg("");
              const res = await setConfig({
                token,
                restaurantName: rnameInput,
                upiVpa: vpaInput,
                payLink: linkInput,
                foodNote: noteInput,
                foodEnabled: foodEnabledInput,
                paymentEvidenceDriveUrl: evidenceDriveInput,
              });
              if (res.ok) {
                setRnameInput(""); setVpaInput(""); setLinkInput(""); setNoteInput("");
                setMsg("Restaurant config saved.");
              } else setMsg(res.error);
            }}
            className="mt-4 border border-line font-mono text-[10px] tracking-[0.2em] px-6 py-2.5 hover:bg-ink hover:text-bg transition-colors"
          >
            SAVE RESTAURANT
          </button>
          <div className="mt-6 border-t border-linesoft pt-5">
            <p className="font-mono text-[10px] tracking-[0.25em] text-mut">PAYMENT QR IMAGE</p>
            <p className="mt-2 font-mono text-xs leading-relaxed text-mut">
              Upload the QR image here. It will appear on the team payment screen after ordering is unlocked.
            </p>
            {cfg.paymentQrUrl && <img src={cfg.paymentQrUrl} alt="Current payment QR" className="mt-4 h-32 w-32 bg-white p-1" />}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => setQrFile(event.target.files?.[0] ?? null)}
                className="font-mono text-xs text-mut file:mr-3 file:border file:border-line file:bg-transparent file:px-3 file:py-2 file:font-mono file:text-xs file:text-ink"
              />
              <button
                disabled={!qrFile || qrBusy}
                onClick={async () => {
                  if (!qrFile) return;
                  setQrBusy(true);
                  setMsg("");
                  try {
                    const upload = await generateQrUploadUrl({ token });
                    const response = await fetch(upload.uploadUrl, {
                      method: "POST",
                      headers: { "Content-Type": qrFile.type || "image/png" },
                      body: qrFile,
                    });
                    if (!response.ok) { setMsg("QR upload failed."); return; }
                    const { storageId } = await response.json() as { storageId: string };
                    await setPaymentQr({ token, paymentQrId: storageId as never });
                    setMsg("Payment QR saved.");
                    setQrFile(null);
                  } catch { setMsg("QR upload failed. Try again."); }
                  finally { setQrBusy(false); }
                }}
                className="border border-line px-4 py-2.5 font-mono text-[10px] tracking-[0.15em] text-mut hover:bg-ink hover:text-bg disabled:opacity-30"
              >
                {qrBusy ? "UPLOADING..." : "UPLOAD QR"}
              </button>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <input
                value={evidenceDriveInput}
                onChange={(event) => setEvidenceDriveInput(event.target.value)}
                placeholder="DRIVE FOLDER FOR SCREENSHOTS / QR BACKUP"
                className="field min-w-[280px] flex-1 px-3 py-2.5 font-mono text-[11px]"
              />
              {evidenceDriveInput && <a href={evidenceDriveInput} target="_blank" rel="noreferrer" className="border border-line px-3 py-2.5 font-mono text-[10px] text-mut hover:text-ink">OPEN DRIVE</a>}
            </div>
          </div>
        </section>
      </FadeIn>

      {/* menu editor */}
      <FadeIn>
        <section className="border border-linesoft p-7">
          <h2 className="font-display text-3xl tracking-tight mb-5">Menu</h2>
          <div className="space-y-2">
            {rows.map((order) => {
              const existing = menu.items.find((m) => m.order === order);
              const d = itemDraft[order] ?? {
                name: existing?.name ?? "",
                price: existing ? String(existing.price) : "",
                veg: existing?.veg ?? true,
                cat: existing?.cat ?? "",
              };
              return (
                <div key={order} className="grid grid-cols-[24px_1fr_110px_110px_auto_auto] gap-2 items-center">
                  <span className="font-mono text-xs text-mut">{String(order).padStart(2, "0")}</span>
                  <input
                    value={d.name}
                    onChange={(e) => setItemDraft((p) => ({ ...p, [order]: { ...d, name: e.target.value } }))}
                    placeholder="ITEM NAME"
                    className="field font-mono text-[11px] px-3 py-2"
                  />
                  <input
                    value={d.price}
                    onChange={(e) => setItemDraft((p) => ({ ...p, [order]: { ...d, price: e.target.value.replace(/[^0-9]/g, "") } }))}
                    placeholder="RS"
                    className="field font-mono text-[11px] px-3 py-2"
                    spellCheck={false}
                  />
                  <input
                    value={d.cat}
                    onChange={(e) => setItemDraft((p) => ({ ...p, [order]: { ...d, cat: e.target.value } }))}
                    placeholder="SECTION"
                    className="field font-mono text-[10px] px-3 py-2 uppercase"
                  />
                  <button
                    onClick={() => setItemDraft((p) => ({ ...p, [order]: { ...d, veg: !d.veg } }))}
                    className={`border px-3 py-2 font-mono text-[10px] tracking-[0.15em] transition-colors ${
                      d.veg ? "border-sage/50 text-sage" : "border-blood/50 text-blood"
                    }`}
                  >
                    {d.veg ? "VEG" : "NON-VEG"}
                  </button>
                  <button
                    onClick={async () => {
                      setMsg("");
                      const res = await setItem({ token, order, name: d.name, price: parseInt(d.price || "0", 10), veg: d.veg, cat: d.cat || "MENU" });
                      if (res.ok) { setItemDraft((p) => { const n = { ...p }; delete n[order]; return n; }); setMsg("Menu saved."); }
                      else setMsg(res.error);
                    }}
                    className="border border-line font-mono text-[10px] tracking-[0.15em] px-4 py-2 hover:bg-ink hover:text-bg transition-colors"
                  >
                    SAVE
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </FadeIn>

      {/* order summary = restaurant handoff sheet */}
      <FadeIn>
        <section className="border border-linesoft p-7">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <h2 className="font-display text-3xl tracking-tight">Order Summary</h2>
            <div className="flex items-center gap-4 font-mono text-[10px] tracking-[0.2em] text-mut">
              <span>{orders.orders.length} ORDER(S)</span>
              <span className="text-amber">REVENUE: Rs. {orders.revenue}</span>
              <button
                onClick={() => {
                  const rowsOut: (string | number)[][] = [["Team ID", "Team Name", "Room", "Items", "Subtotal (Rs)", "Delivery (Rs)", "Total (Rs)", "Status", "Transaction ID", "Screenshot URL", "Placed At"]];
                  for (const o of orders.orders) {
                    rowsOut.push([
                      o.teamCode,
                      o.teamName,
                      o.roomNumber ?? "",
                      o.items.map((i: { qty: number; name: string }) => `${i.qty}x ${i.name}`).join(" | "),
                      o.subtotal,
                      o.deliveryCharge,
                      o.total,
                      o.status,
                      o.transactionId,
                      o.paymentScreenshotUrl ?? "",
                      new Date(o.placedAt).toISOString(),
                    ]);
                  }
                  rowsOut.push(["", "", "", "", "", "--- GRAND TOTAL ---", orders.revenue]);
                  rowsOut.push([]);
                  rowsOut.push(["KITCHEN TALLY (restaurant handoff)"]);
                  rowsOut.push(["Item", "Total Qty"]);
                  for (const [name, qty] of kitchenTally) rowsOut.push([`${qty}x`, name]);

                  downloadCsv("operation-zero-hour-food-orders.csv", rowsOut);
                }}
                className="border border-line text-mut hover:text-ink px-4 py-2.5 transition-colors"
              >
                EXPORT ORDERS CSV
              </button>
            </div>
          </div>
          {kitchenTally.length > 0 && (
            <div className="border border-amber/40 bg-amber/5 px-5 py-4 mb-5">
              <p className="font-mono text-[10px] tracking-[0.2em] text-amber mb-2">
                KITCHEN TALLY - TOTALS ACROSS ALL {orders.orders.length} ORDER(S)
              </p>
              <div className="flex flex-wrap gap-3 font-mono text-[11px]">
                {kitchenTally.map(([name, qty]) => (
                  <span key={name} className="text-ink">
                    <span className="text-amber font-bold">{qty}x</span> {name}
                  </span>
                ))}
              </div>
            </div>
          )}
          {orders.orders.length === 0 ? (
            <p className="font-mono text-xs text-mut">No orders yet.</p>
          ) : (
            <div className="overflow-x-auto border border-linesoft max-h-[480px] overflow-y-auto">
              <table className="w-full font-mono text-xs">
                <thead className="sticky top-0 bg-[#0d0d0d] text-left text-mut">
                  <tr>
                    <th className="px-4 py-2.5 font-normal">TEAM</th>
                    <th className="px-4 py-2.5 font-normal">ROOM</th>
                    <th className="px-4 py-2.5 font-normal">ORDER</th>
                    <th className="px-4 py-2.5 font-normal">SUBTOTAL</th>
                    <th className="px-4 py-2.5 font-normal">DELIVERY</th>
                    <th className="px-4 py-2.5 font-normal">TOTAL</th>
                    <th className="px-4 py-2.5 font-normal">STATUS</th>
                    <th className="px-4 py-2.5 font-normal">TRANSACTION</th>
                    <th className="px-4 py-2.5 font-normal">PROOF</th>
                    <th className="px-4 py-2.5 font-normal">PLACED AT (UTC)</th>
                    <th className="px-4 py-2.5 font-normal text-right">REOPEN</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.orders.map((o) => (
                    <tr key={o._id} className="border-t border-linesoft align-top">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-amber mr-2">{o.teamCode}</span>
                        {o.teamName}
                      </td>
                      <td className="px-4 py-3 font-bold text-ink">{o.roomNumber || <span className="text-mut font-normal">-</span>}</td>
                      <td className="px-4 py-3 text-mut max-w-md">
                        {o.items.map((i: { qty: number; name: string; price: number }) => `${i.qty}x ${i.name} (Rs.${i.price})`).join(", ")}
                      </td>
                      <td className="px-4 py-3">Rs. {o.subtotal}</td>
                      <td className="px-4 py-3">Rs. {o.deliveryCharge}</td>
                      <td className="px-4 py-3">Rs. {o.total}</td>
                      <td className={`px-4 py-3 ${o.status === "confirmed" ? "text-sage" : "text-amber"}`}>{o.status.toUpperCase()}</td>
                      <td className="px-4 py-3 text-mut">{o.transactionId || "-"}</td>
                      <td className="px-4 py-3">{o.paymentScreenshotUrl ? <a href={o.paymentScreenshotUrl} target="_blank" rel="noreferrer" className="text-amber hover:text-ink">OPEN</a> : "-"}</td>
                      <td className="px-4 py-3 text-mut whitespace-nowrap">{stamp(o.placedAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={async () => {
                            if (!confirm(`Reopen order window for ${o.teamCode}?`)) return;
                            const r = await resetOrderMut({ token, teamCode: o.teamCode });
                            if (r.ok) setMsg(`Order window reopened for ${o.teamCode}.`);
                            else setMsg(r.error);
                          }}
                          className="text-blood/70 hover:text-blood text-[10px] tracking-[0.15em]"
                        >
                          REOPEN
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="sticky bottom-0 bg-[#0d0d0d]">
                  <tr className="text-ink">
                    <td className="px-4 py-3 font-mono text-xs" colSpan={5}>GRAND TOTAL</td>
                    <td className="px-4 py-3 font-mono text-xs">Rs. {orders.revenue}</td>
                    <td colSpan={5} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      </FadeIn>
    </div>
  );
}
