"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import Papa from "papaparse";
import { useState } from "react";
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

  const [rnameInput, setRnameInput] = useState("");
  const [vpaInput, setVpaInput] = useState("");
  const [linkInput, setLinkInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [itemDraft, setItemDraft] = useState<Record<number, { name: string; price: string; veg: boolean }>>({});
  const [msg, setMsg] = useState("");

  if (!cfg || !menu || !orders) {
    return <p className="font-mono text-xs text-mut blink tracking-[0.25em]">LOADING FOOD DESK...</p>;
  }

  const rows = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

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
          <button
            onClick={async () => {
              setMsg("");
              const res = await setConfig({
                token,
                restaurantName: rnameInput,
                upiVpa: vpaInput,
                payLink: linkInput,
                foodNote: noteInput,
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
              };
              return (
                <div key={order} className="grid grid-cols-[24px_1fr_110px_auto_auto] gap-2 items-center">
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
                      const res = await setItem({ token, order, name: d.name, price: parseInt(d.price || "0", 10), veg: d.veg });
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
                  const rowsOut: (string | number)[][] = [["Team ID", "Team Name", "Items", "Total (Rs)", "Placed At"]];
                  for (const o of orders.orders) {
                    rowsOut.push([
                      o.teamCode,
                      o.teamName,
                      o.items.map((i: { qty: number; name: string }) => `${i.qty}x ${i.name}`).join(" | "),
                      o.total,
                      new Date(o.placedAt).toISOString(),
                    ]);
                  }
                  rowsOut.push(["", "", "", orders.revenue, "--- GRAND TOTAL ---"]);
                  downloadCsv("operation-zero-hour-food-orders.csv", rowsOut);
                }}
                className="border border-line text-mut hover:text-ink px-4 py-2.5 transition-colors"
              >
                EXPORT ORDERS CSV
              </button>
            </div>
          </div>
          {orders.orders.length === 0 ? (
            <p className="font-mono text-xs text-mut">No orders yet.</p>
          ) : (
            <div className="overflow-x-auto border border-linesoft max-h-[480px] overflow-y-auto">
              <table className="w-full font-mono text-xs">
                <thead className="sticky top-0 bg-[#0d0d0d] text-left text-mut">
                  <tr>
                    <th className="px-4 py-2.5 font-normal">TEAM</th>
                    <th className="px-4 py-2.5 font-normal">ORDER</th>
                    <th className="px-4 py-2.5 font-normal">TOTAL</th>
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
                      <td className="px-4 py-3 text-mut max-w-md">
                        {o.items.map((i: { qty: number; name: string; price: number }) => `${i.qty}x ${i.name} (Rs.${i.price})`).join(", ")}
                      </td>
                      <td className="px-4 py-3">Rs. {o.total}</td>
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
                    <td className="px-4 py-3 font-mono text-xs" colSpan={2}>GRAND TOTAL</td>
                    <td className="px-4 py-3 font-mono text-xs">Rs. {orders.revenue}</td>
                    <td colSpan={2} />
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
