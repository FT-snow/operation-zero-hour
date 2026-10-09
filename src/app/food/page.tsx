"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { getToken } from "@/lib/session";
import { FadeIn } from "@/components/fade";
import type { Doc } from "@/convex/_generated/dataModel";

type MenuItem = Pick<Doc<"menu_items">, "order" | "name" | "price" | "veg">;

export default function FoodPage() {
  const token = getToken();
  if (!token) return null;
  return <FoodInner token={token} />;
}

function FoodInner({ token }: { token: string }) {
  const data = useQuery(api.food.listFood, { token });
  const place = useMutation(api.food.placeOrder);
  const [qty, setQty] = useState<Record<number, number>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [placedAt, setPlacedAt] = useState<number | null>(null);

  const restaurant = data?.restaurantName ?? "";
  const items: MenuItem[] = data?.items ?? [];
  const myOrder = data?.myOrder ?? null;

  // totals
  const cart = useMemo(() => {
    const lines = items
      .filter((i) => (qty[i.order] ?? 0) > 0)
      .map((i) => ({ ...i, n: qty[i.order]!, line: i.price * (qty[i.order] ?? 0) }));
    const total = lines.reduce((a, l) => a + l.line, 0);
    return { lines, total };
  }, [items, qty]);

  // UPI payment QR: encodes amount snapshot of the cart; payLink override if set
  useEffect(() => {
    if (!data || myOrder) { setQr(null); return; }
    const { upiVpa, payLink, restaurantName: rname } = data;
    let target = "";
    if (payLink) target = payLink;
    else if (upiVpa) {
      const params = new URLSearchParams({ pa: upiVpa, cu: "INR" });
      if (rname) params.set("pn", rname.slice(0, 40));
      if (cart.total > 0) params.set("am", String(cart.total));
      target = `upi://pay?${params.toString()}`;
    }
    if (!target) { setQr(null); return; }
    QRCode.toDataURL(target, {
      width: 480,
      margin: 1,
      color: { dark: "#000000", light: "#f5f4f0" },
      errorCorrectionLevel: "M",
    })
      .then(setQr)
      .catch(() => setQr(null));
  }, [data, myOrder, cart.total]);

  async function doPlace() {
    if (busy || cart.lines.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const res = await place({
        token,
        items: cart.lines.map((l) => ({ order: l.order, qty: l.n })),
      });
      if (res.ok) {
        setPlacedAt(res.placedAt);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setError(res.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Order failed");
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="font-mono text-xs tracking-[0.25em] text-mut blink">LOADING MENU...</p>
      </main>
    );
  }

  // ============ confirmation ============
  if (myOrder || placedAt) {
    return (
      <main className="min-h-screen">
        <TopBar />
        <section className="max-w-3xl mx-auto px-6 py-24">
          <FadeIn>
            <div className="border border-sage/40 px-8 py-10">
              <p className="font-mono text-[11px] tracking-[0.25em] text-sage mb-3">ORDER PLACED</p>
              <h1 className="font-display text-4xl md:text-5xl tracking-[-0.02em] mb-4">
                {restaurant.toUpperCase()} <span className="text-mut">has your order.</span>
              </h1>
              <p className="font-mono text-xs text-mut leading-relaxed max-w-lg">
                Filed at server time{" "}
                {new Date(myOrder?.placedAt ?? placedAt ?? 0).toISOString().replace("T", " ").slice(0, 19)}
                . Total: <span className="text-ink">Rs. {myOrder?.total}</span>. Pay on delivery or
                via the QR shown at the counter.
              </p>
            </div>
            <div className="mt-10 space-y-4">
              {(myOrder?.items ?? []).map((it) => (
                <div key={it.name} className="border border-linesoft px-6 py-4 flex items-center justify-between font-mono text-xs">
                  <span className="text-mut">{it.qty} x {it.name}</span>
                  <span>Rs. {it.price}</span>
                </div>
              ))}
              <div className="border border-linesoft px-6 py-4 flex items-center justify-between font-mono text-sm">
                <span>TOTAL</span>
                <span className="text-ink">Rs. {myOrder?.total}</span>
              </div>
            </div>
            <Link href="/story" className="inline-block mt-12 font-mono text-[10px] tracking-[0.2em] text-mut border border-line px-4 py-2.5 hover:text-ink transition-colors">
              BACK TO THE FILE
            </Link>
          </FadeIn>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <TopBar />

      <section className="max-w-6xl mx-auto px-6 pt-20 pb-10">
        <p className="font-mono text-[11px] tracking-[0.25em] text-mut mb-3">FOOD ORDER</p>
        <h1 className="font-display text-5xl md:text-7xl tracking-[-0.02em]">{restaurant || "Menu"}</h1>
        {data.foodNote && (
          <p className="font-mono text-xs text-mut mt-4 max-w-xl leading-relaxed">{data.foodNote}</p>
        )}
      </section>
      <div className="max-w-6xl mx-auto px-6"><div className="hairline" /></div>

      <section className="max-w-6xl mx-auto px-6 py-16">
        {items.length === 0 ? (
          <p className="font-mono text-xs text-mut">The menu is being set. Check back soon.</p>
        ) : (
          <div className="grid lg:grid-cols-[1.5fr_1fr] gap-12">
            {/* menu */}
            <div>
              {items.map((i) => (
                <div key={i.order} className="border-t border-linesoft last:border-b flex items-center justify-between px-1 py-4">
                  <div className="flex items-center gap-4">
                    <span
                      className={`block h-3 w-3 shrink-0 border ${i.veg ? "border-sage" : "border-blood"}`}
                      style={{ borderRadius: "2px" }}
                    >
                      <span className={`block mx-auto mt-[3px] h-[4px] w-[4px] rounded-full ${i.veg ? "bg-sage" : "bg-blood"}`} />
                    </span>
                    <span className="font-mono text-xs text-ink">{i.name}</span>
                  </div>
                  <div className="flex items-center gap-5">
                    <span className="font-mono text-xs text-mut">Rs. {i.price}</span>
                    <div className="flex items-center border border-line">
                      <button
                        onClick={() => setQty((p) => ({ ...p, [i.order]: Math.max(0, (p[i.order] ?? 0) - 1) }))}
                        className="px-3 py-1.5 text-mut hover:text-ink transition-colors"
                      >
                        -
                      </button>
                      <span className="font-mono text-xs w-8 text-center">{qty[i.order] ?? 0}</span>
                      <button
                        onClick={() => setQty((p) => ({ ...p, [i.order]: Math.min(10, (p[i.order] ?? 0) + 1) }))}
                        className="px-3 py-1.5 text-mut hover:text-ink transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* cart + pay */}
            <div className="lg:sticky lg:top-20 self-start">
              <FadeIn>
                <div className="border border-linesoft p-7">
                  <p className="font-mono text-[10px] tracking-[0.3em] text-mut mb-5">YOUR ORDER</p>
                  {cart.lines.length === 0 ? (
                    <p className="font-mono text-xs text-mut mb-6">Cart is empty. Add from the menu.</p>
                  ) : (
                    <div className="space-y-3 mb-5">
                      {cart.lines.map((l) => (
                        <div key={l.order} className="flex items-center justify-between font-mono text-xs">
                          <span className="text-mut">{l.n} x {l.name}</span>
                          <span>Rs. {l.line}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="hairline mb-5" />
                  <div className="flex items-center justify-between font-mono text-sm mb-7">
                    <span>TOTAL</span>
                    <span className="text-ink">Rs. {cart.total}</span>
                  </div>

                  {qr && (
                    <div className="mb-6 text-center">
                      <img src={qr} alt="Payment QR" className="mx-auto" style={{ width: 200, height: 200, imageRendering: "pixelated" }} />
                      <p className="font-mono text-[10px] tracking-[0.2em] text-mut mt-3">
                        SCAN TO PAY {payTargetLabel(data.payLink, data.upiVpa)}
                      </p>
                    </div>
                  )}
                  <a
                    href={orderLink(data.payLink, data.upiVpa, cart.total, restaurant)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={`block text-center font-mono text-xs tracking-[0.2em] py-4 transition-colors mb-4 ${
                      data.payLink || data.upiVpa
                        ? "bg-ink text-bg hover:bg-white active:scale-[0.98]"
                        : "pointer-events-none border border-line text-mut opacity-30"
                    }`}
                  >
                    PAY NOW
                  </a>

                  {error && <p className="font-mono text-xs text-blood mb-4">{error}</p>}
                  <button
                    onClick={doPlace}
                    disabled={busy || cart.lines.length === 0}
                    className="w-full border border-sage/50 text-sage font-mono text-xs tracking-[0.2em] py-4 hover:bg-sage/10 transition-colors active:scale-[0.98] disabled:opacity-30"
                  >
                    {busy ? "PLACING..." : "PLACE ORDER"}
                  </button>
                  <p className="font-mono text-[9px] tracking-[0.15em] text-mut mt-4 text-center leading-relaxed">
                    ONE ORDER PER TEAM. NO EDITS AFTER PLACING.
                  </p>
                </div>
              </FadeIn>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function payTargetLabel(payLink: string, upiVpa: string): string {
  if (payLink) return "(PAYMENT LINK)";
  if (upiVpa) return `(UPI: ${upiVpa.toUpperCase()})`;
  return "(PAYMENT NOT CONFIGURED)";
}

function orderLink(payLink: string, upiVpa: string, total: number, rname: string): string {
  if (payLink) return payLink;
  if (upiVpa) {
    const params = new URLSearchParams({ pa: upiVpa, cu: "INR" });
    if (rname) params.set("pn", rname.slice(0, 40));
    if (total > 0) params.set("am", String(total));
    return `upi://pay?${params.toString()}`;
  }
  return "#";
}

function TopBar() {
  return (
    <header className="border-b border-linesoft">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between gap-4 font-mono text-[11px] tracking-[0.2em] text-mut">
        <Link href="/" className="text-ink hover:text-white transition-colors whitespace-nowrap">OPERATION ZERO HOUR</Link>
        <span className="hidden sm:inline text-mut whitespace-nowrap">FOOD ORDER // ONE PER TEAM</span>
        <Link href="/story" className="hover:text-ink transition-colors whitespace-nowrap">&lt; CASE FILE</Link>
      </div>
    </header>
  );
}
