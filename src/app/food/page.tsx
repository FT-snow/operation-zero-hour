"use client";

import { useMutation, useQuery } from "convex/react";
import QRCode from "qrcode";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { FadeIn } from "@/components/fade";
import { getToken } from "@/lib/session";

type Item = {
  order: number;
  name: string;
  price: number;
  veg: boolean;
  cat: string;
};

export default function FoodPage() {
  const token = getToken();
  if (!token) return null;
  return <FoodPageInner token={token} />;
}

function FoodPageInner({ token }: { token: string }) {
  const data = useQuery(api.food.listFood, { token });
  const placeOrder = useMutation(api.food.placeOrder);
  const generateUploadUrl = useMutation(api.food.generatePaymentUploadUrl);
  const confirmPayment = useMutation(api.food.confirmPayment);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [confirming, setConfirming] = useState(false);
  const [transactionId, setTransactionId] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const items = (data?.items ?? []) as Item[];
  const order = data?.myOrder;
  const cart = useMemo(() => {
    const lines = items
      .filter((item) => (quantities[item.order] ?? 0) > 0)
      .map((item) => {
        const qty = quantities[item.order] ?? 0;
        return { ...item, qty, lineTotal: item.price * qty };
      });
    const subtotal = lines.reduce((sum, item) => sum + item.lineTotal, 0);
    const deliveryCharge = data?.deliveryCharge ?? 10;
    return { lines, subtotal, deliveryCharge, total: subtotal + deliveryCharge };
  }, [data?.deliveryCharge, items, quantities]);

  const sections = useMemo(() => {
    const grouped = new Map<string, Item[]>();
    for (const item of items) {
      const section = item.cat || "MENU";
      grouped.set(section, [...(grouped.get(section) ?? []), item]);
    }
    return [...grouped.entries()];
  }, [items]);

  useEffect(() => {
    const amount = order?.total ?? cart.total;
    if (!data?.enabled || order?.status === "confirmed" || amount <= 0) {
      setQr(null);
      return;
    }
    const target = data.payLink
      ? data.payLink
      : data.upiVpa
        ? `upi://pay?${new URLSearchParams({
            pa: data.upiVpa,
            pn: data.restaurantName,
            am: String(amount),
            cu: "INR",
          }).toString()}`
        : "";
    if (!target) {
      setQr(null);
      return;
    }
    QRCode.toDataURL(target, {
      width: 420,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#f5f4f0" },
    }).then(setQr).catch(() => setQr(null));
  }, [cart.total, data, order]);

  async function submitOrder() {
    setBusy(true);
    setError("");
    try {
      const result = await placeOrder({
        token,
        items: cart.lines.map((item) => ({ order: item.order, qty: item.qty })),
      });
      if (!result.ok) setError(result.error);
      else setConfirming(false);
    } catch {
      setError("We could not place the order. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submitPaymentProof() {
    if (!screenshot) {
      setError("Upload the payment screenshot first.");
      return;
    }
    if (!transactionId.trim()) {
      setError("Enter the transaction ID first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const upload = await generateUploadUrl({ token });
      if (!upload.ok) {
        setError(upload.error);
        return;
      }
      const response = await fetch(upload.uploadUrl, {
        method: "POST",
        headers: { "Content-Type": screenshot.type || "image/*" },
        body: screenshot,
      });
      if (!response.ok) {
        setError("Screenshot upload failed. Please try again.");
        return;
      }
      const { storageId } = (await response.json()) as { storageId: string };
      const result = await confirmPayment({
        token,
        transactionId,
        paymentScreenshotId: storageId as Id<"_storage">,
      });
      if (!result.ok) setError(result.error);
      else {
        setScreenshot(null);
        setTransactionId("");
      }
    } catch {
      setError("Payment proof could not be submitted. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <LoadingState />;

  if (!data.enabled) {
    return (
      <main className="min-h-screen">
        <TopBar />
        <section className="mx-auto flex min-h-[70vh] max-w-3xl items-center px-6 py-20">
          <div className="w-full border border-linesoft px-8 py-14 text-center">
            <p className="font-mono text-[10px] tracking-[0.3em] text-mut">FOOD ORDERING</p>
            <h1 className="mt-4 font-display text-4xl">The menu is not open yet.</h1>
            <p className="mx-auto mt-5 max-w-md font-mono text-xs leading-relaxed text-mut">
              The control room will unlock food ordering when the restaurant is ready.
            </p>
          </div>
        </section>
      </main>
    );
  }

  if (order?.status === "confirmed") {
    return (
      <main className="min-h-screen">
        <TopBar />
        <section className="mx-auto max-w-3xl px-6 py-24">
          <FadeIn>
            <div className="border border-sage/40 px-8 py-10">
              <p className="font-mono text-[10px] tracking-[0.3em] text-sage">ORDER CONFIRMED</p>
              <h1 className="mt-4 font-display text-4xl md:text-5xl">Payment proof received.</h1>
              <p className="mt-5 max-w-xl font-mono text-xs leading-relaxed text-mut">
                Your order has been recorded. The respective organizers will contact you.
              </p>
            </div>
            <OrderSummary
              items={order.items}
              subtotal={order.subtotal}
              deliveryCharge={order.deliveryCharge}
              total={order.total}
            />
          </FadeIn>
        </section>
      </main>
    );
  }

  if (order?.status === "awaiting_payment") {
    return (
      <main className="min-h-screen">
        <TopBar />
        <section className="mx-auto max-w-3xl px-6 py-20">
          <p className="font-mono text-[10px] tracking-[0.3em] text-mut">FINAL ORDER</p>
          <h1 className="mt-4 font-display text-5xl">Pay and confirm.</h1>
          <OrderSummary
            items={order.items}
            subtotal={order.subtotal}
            deliveryCharge={order.deliveryCharge}
            total={order.total}
          />
          <div className="mt-8 grid gap-8 md:grid-cols-[220px_1fr] border border-linesoft p-7">
            <div>
              {qr ? (
                <img src={qr} alt="Payment QR code" className="h-[200px] w-[200px] bg-white" />
              ) : (
                <div className="flex h-[200px] w-[200px] items-center justify-center border border-line font-mono text-center text-[10px] text-mut">
                  PAYMENT QR NOT CONFIGURED
                </div>
              )}
            </div>
            <div>
              <p className="font-mono text-[10px] tracking-[0.25em] text-mut">PAYMENT</p>
              <p className="mt-3 font-display text-3xl">Rs. {order.total}</p>
              <p className="mt-3 font-mono text-xs leading-relaxed text-mut">
                Pay using the QR code, then upload the screenshot and enter the transaction ID.
              </p>
              <div className="mt-6 space-y-3">
                <input
                  value={transactionId}
                  onChange={(event) => setTransactionId(event.target.value)}
                  placeholder="TRANSACTION ID"
                  className="field w-full px-4 py-3 font-mono text-xs"
                />
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => setScreenshot(event.target.files?.[0] ?? null)}
                  className="block w-full font-mono text-xs text-mut file:mr-3 file:border file:border-line file:bg-transparent file:px-3 file:py-2 file:font-mono file:text-xs file:text-ink"
                />
                {error && <p className="font-mono text-xs text-blood">{error}</p>}
                <button
                  onClick={submitPaymentProof}
                  disabled={busy}
                  className="w-full bg-ink px-5 py-3 font-mono text-xs tracking-[0.2em] text-bg transition-colors hover:bg-white disabled:opacity-40"
                >
                  {busy ? "UPLOADING..." : "CONFIRM PAYMENT"}
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <TopBar />
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-20">
        <p className="font-mono text-[10px] tracking-[0.3em] text-mut">COSMOS MENU / OPERATION ZERO HOUR</p>
        <h1 className="mt-4 font-display text-6xl tracking-[-0.03em] md:text-8xl">Choose your order.</h1>
        <p className="mt-5 max-w-xl font-mono text-xs leading-relaxed text-mut">
          Add items to your team cart. A Rs. 10 delivery charge is added server-side. Review the
          final order before it is created.
        </p>
      </section>
      <div className="mx-auto max-w-6xl px-6"><div className="hairline" /></div>

      <section className="mx-auto grid max-w-6xl gap-12 px-6 py-16 lg:grid-cols-[1.4fr_0.8fr]">
        <div>
          {sections.map(([section, sectionItems]) => (
            <div key={section} className="mb-10">
              <p className="mb-3 font-mono text-[10px] tracking-[0.3em] text-blood">{section}</p>
              <div className="border-t border-linesoft">
                {sectionItems.map((item) => (
                  <div key={item.order} className="flex items-center justify-between gap-4 border-b border-linesoft py-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={`h-3 w-3 shrink-0 border ${item.veg ? "border-sage" : "border-blood"}`} />
                      <span className="font-mono text-xs text-ink">{item.name}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      <span className="font-mono text-xs text-mut">Rs. {item.price}</span>
                      <div className="flex items-center border border-line">
                        <button onClick={() => changeQuantity(item.order, -1)} className="px-3 py-2 text-mut hover:text-ink">-</button>
                        <span className="w-8 text-center font-mono text-xs">{quantities[item.order] ?? 0}</span>
                        <button onClick={() => changeQuantity(item.order, 1)} className="px-3 py-2 text-mut hover:text-ink">+</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <aside className="self-start lg:sticky lg:top-20">
          <div className="border border-linesoft p-7">
            <p className="font-mono text-[10px] tracking-[0.3em] text-mut">YOUR CART</p>
            {cart.lines.length === 0 ? (
              <p className="mt-6 font-mono text-xs text-mut">Your cart is empty.</p>
            ) : (
              <div className="mt-6 space-y-3">
                {cart.lines.map((item) => (
                  <div key={item.order} className="flex justify-between gap-4 font-mono text-xs">
                    <span className="text-mut">{item.qty} x {item.name}</span>
                    <span>Rs. {item.lineTotal}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="hairline my-6" />
            <div className="space-y-2 font-mono text-xs">
              <div className="flex justify-between text-mut"><span>SUBTOTAL</span><span>Rs. {cart.subtotal}</span></div>
              <div className="flex justify-between text-mut"><span>DELIVERY</span><span>Rs. {cart.deliveryCharge}</span></div>
              <div className="flex justify-between pt-2 text-sm"><span>TOTAL</span><span>Rs. {cart.total}</span></div>
            </div>
            {error && <p className="mt-5 font-mono text-xs text-blood">{error}</p>}
            <button
              onClick={() => { setError(""); setConfirming(true); }}
              disabled={cart.lines.length === 0}
              className="mt-7 w-full bg-ink px-5 py-4 font-mono text-xs tracking-[0.2em] text-bg transition-colors hover:bg-white disabled:opacity-30"
            >
              REVIEW FINAL ORDER
            </button>
          </div>
        </aside>
      </section>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-6" role="dialog" aria-modal="true">
          <div className="w-full max-w-xl border border-line bg-black p-8">
            <p className="font-mono text-[10px] tracking-[0.3em] text-blood">FINAL CHECK</p>
            <h2 className="mt-3 font-display text-4xl">Is this the final order?</h2>
            <OrderSummary items={cart.lines.map((item) => ({ name: item.name, qty: item.qty, price: item.lineTotal }))} subtotal={cart.subtotal} deliveryCharge={cart.deliveryCharge} total={cart.total} />
            <p className="mt-5 font-mono text-xs leading-relaxed text-mut">After confirmation, you will receive a payment QR. The order cannot be edited.</p>
            {error && <p className="mt-4 font-mono text-xs text-blood">{error}</p>}
            <div className="mt-7 flex gap-3">
              <button onClick={() => setConfirming(false)} className="flex-1 border border-line px-4 py-3 font-mono text-xs tracking-[0.15em] text-mut hover:text-ink">EDIT CART</button>
              <button onClick={submitOrder} disabled={busy} className="flex-1 bg-ink px-4 py-3 font-mono text-xs tracking-[0.15em] text-bg hover:bg-white disabled:opacity-40">{busy ? "CREATING..." : "YES, CONFIRM"}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );

  function changeQuantity(order: number, delta: number) {
    setQuantities((current) => ({
      ...current,
      [order]: Math.max(0, Math.min(10, (current[order] ?? 0) + delta)),
    }));
  }
}

function OrderSummary({ items, subtotal, deliveryCharge, total }: { items: Array<{ name: string; qty: number; price: number }>; subtotal: number; deliveryCharge: number; total: number }) {
  return (
    <div className="mt-8 space-y-3 border border-linesoft p-5 font-mono text-xs">
      {items.map((item) => <div key={item.name} className="flex justify-between gap-4 text-mut"><span>{item.qty} x {item.name}</span><span>Rs. {item.price}</span></div>)}
      <div className="hairline my-4" />
      <div className="flex justify-between text-mut"><span>SUBTOTAL</span><span>Rs. {subtotal}</span></div>
      <div className="flex justify-between text-mut"><span>DELIVERY</span><span>Rs. {deliveryCharge}</span></div>
      <div className="flex justify-between pt-2 text-ink"><span>TOTAL</span><span>Rs. {total}</span></div>
    </div>
  );
}

function LoadingState() {
  return <main className="flex min-h-screen items-center justify-center"><p className="blink font-mono text-xs tracking-[0.3em] text-mut">OPENING MENU...</p></main>;
}

function TopBar() {
  return (
    <header className="border-b border-linesoft">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-6 font-mono text-[11px] tracking-[0.2em] text-mut">
        <Link href="/" className="whitespace-nowrap text-ink hover:text-white">OPERATION ZERO HOUR</Link>
        <span className="hidden whitespace-nowrap sm:inline">COSMOS MENU</span>
        <Link href="/story" className="whitespace-nowrap hover:text-ink">&lt; CASE FILE</Link>
      </div>
    </header>
  );
}
