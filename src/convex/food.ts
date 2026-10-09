import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireTeamByToken, requireAdminByToken, audit } from "./lib/auth";

const MAX_QTY_PER_ITEM = 10;
const MAX_ITEMS = 40;

// ================ ADMIN ================

export const configFoodGet = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireAdminByToken(ctx, args.token);
    const cfg = await ctx.db.query("config").first();
    return {
      restaurantName: cfg?.restaurantName ?? "",
      upiVpa: cfg?.upiVpa ?? "",
      payLink: cfg?.payLink ?? "",
      foodNote: cfg?.foodNote ?? "",
    };
  },
});

export const setFoodConfig = mutation({
  args: {
    token: v.string(),
    restaurantName: v.string(),
    upiVpa: v.string(),
    payLink: v.string(),
    foodNote: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminByToken(ctx, args.token);
    const name = args.restaurantName.trim();
    if (!name) return { ok: false as const, error: "Restaurant name required" };
    const vpa = args.upiVpa.trim();
    const link = args.payLink.trim();
    if (link && !/^https:\/\//.test(link)) {
      return { ok: false as const, error: "Pay link must start with https://" };
    }
    if (vpa && !/^[a-zA-Z0-9.\-_]{2,64}@[a-zA-Z]{2,32}$/.test(vpa)) {
      return { ok: false as const, error: "UPI ID looks invalid (e.g. store@upi)" };
    }
    let cfg = await ctx.db.query("config").first();
    if (cfg) {
      await ctx.db.patch(cfg._id, {
        restaurantName: name,
        upiVpa: vpa,
        payLink: link,
        foodNote: args.foodNote.trim(),
      });
    } else {
      await ctx.db.insert("config", {
        restaurantName: name,
        upiVpa: vpa,
        payLink: link,
        foodNote: args.foodNote.trim(),
      });
    }
    await audit(ctx, {
      action: "food.setConfig",
      adminId: admin._id,
      adminLabel: admin.email,
      details: `Food config saved: ${name}`,
    });
    return { ok: true as const };
  },
});

export const menuAdmin = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireAdminByToken(ctx, args.token);
    const rows = await ctx.db.query("menu_items").withIndex("by_order").collect();
    return { items: rows.sort((a, b) => a.order - b.order) };
  },
});

export const setMenuItem = mutation({
  args: { token: v.string(), order: v.number(), name: v.string(), price: v.number(), veg: v.boolean() },
  handler: async (ctx, args) => {
    const admin = await requireAdminByToken(ctx, args.token);
    if (args.order < 1 || args.order > MAX_ITEMS) {
      return { ok: false as const, error: `Row must be 1-${MAX_ITEMS}` };
    }
    const name = args.name.trim();
    if (!name) return { ok: false as const, error: "Item name required" };
    if (!Number.isInteger(args.price) || args.price < 0 || args.price > 100000) {
      return { ok: false as const, error: "Price must be an integer in rupees" };
    }
    const existing = await ctx.db
      .query("menu_items")
      .withIndex("by_order", (q) => q.eq("order", args.order))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { name, price: args.price, veg: args.veg });
    } else {
      await ctx.db.insert("menu_items", { order: args.order, name, price: args.price, veg: args.veg });
    }
    await audit(ctx, {
      action: "food.setMenuItem",
      adminId: admin._id,
      adminLabel: admin.email,
      details: `Menu row ${args.order}: ${name} @ Rs.${args.price}`,
    });
    return { ok: true as const };
  },
});

export const ordersAdmin = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireAdminByToken(ctx, args.token);
    const all = await ctx.db.query("orders").collect();
    const out = [];
    for (const o of all) {
      const team = await ctx.db.get(o.teamId);
      if (!team) continue;
      out.push({
        _id: o._id,
        teamCode: team.teamCode,
        teamName: team.teamName,
        items: o.items,
        total: o.total,
        placedAt: o.placedAt,
      });
    }
    out.sort((a, b) => a.placedAt - b.placedAt);
    return { orders: out, revenue: all.reduce((a, o) => a + o.total, 0) };
  },
});

export const resetOrder = mutation({
  // opens the window for a team to reorder (e.g. they made a typo)
  args: { token: v.string(), teamCode: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdminByToken(ctx, args.token);
    const code = args.teamCode.trim().toUpperCase();
    const team = await ctx.db
      .query("teams")
      .withIndex("by_teamCode", (q) => q.eq("teamCode", code))
      .unique();
    if (!team) return { ok: false as const, error: "Team not found" };
    const existing = await ctx.db
      .query("orders")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    await audit(ctx, {
      action: "food.resetOrder",
      adminId: admin._id,
      adminLabel: admin.email,
      details: `Order window reopened for ${code}`,
    });
    return { ok: true as const };
  },
});

// ================ TEAM ================

export const listFood = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const team = await requireTeamByToken(ctx, args.token);
    const cfg = await ctx.db.query("config").first();
    const items = (await ctx.db.query("menu_items").withIndex("by_order").collect())
      .sort((a, b) => a.order - b.order)
      .map((m) => ({ order: m.order, name: m.name, price: m.price, veg: m.veg }));
    const myOrder = await ctx.db
      .query("orders")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .unique();
    return {
      restaurantName: cfg?.restaurantName ?? "",
      upiVpa: cfg?.upiVpa ?? "",
      payLink: cfg?.payLink ?? "",
      foodNote: cfg?.foodNote ?? "",
      items,
      myOrder: myOrder
        ? {
            items: myOrder.items,
            total: myOrder.total,
            placedAt: myOrder.placedAt,
          }
        : null,
    };
  },
});

// cart lives client-side; PLACE is the single write
export const placeOrder = mutation({
  args: {
    token: v.string(),
    items: v.array(v.object({ order: v.number(), qty: v.number() })),
  },
  handler: async (ctx, args) => {
    const team = await requireTeamByToken(ctx, args.token);

    // One order per team - enforced inside the transaction
    const existing = await ctx.db
      .query("orders")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .unique();
    if (existing) {
      return { ok: false as const, error: "Order already placed - contact the control room to change it" };
    }
    if (args.items.length === 0) {
      return { ok: false as const, error: "Cart is empty" };
    }
    if (args.items.length > MAX_ITEMS) {
      return { ok: false as const, error: "Too many lines" };
    }

    // Price is computed SERVER-side from the live menu (no client trust)
    const menu = await ctx.db.query("menu_items").collect();
    const byOrder = new Map(menu.map((m) => [m.order, m]));
    const lineItems = [];
    let total = 0;
    const seen = new Set<number>();
    for (const it of args.items) {
      const m = byOrder.get(it.order);
      if (!m) return { ok: false as const, error: "Unknown menu item" };
      if (!Number.isInteger(it.qty) || it.qty < 1 || it.qty > MAX_QTY_PER_ITEM) {
        return { ok: false as const, error: `Invalid qty for ${m.name}` };
      }
      if (seen.has(it.order)) {
        return { ok: false as const, error: "Duplicate cart line" };
      }
      seen.add(it.order);
      lineItems.push({ name: m.name, qty: it.qty, price: m.price * it.qty });
      total += m.price * it.qty;
    }

    const now = Date.now();
    await ctx.db.insert("orders", {
      teamId: team._id,
      items: lineItems,
      total,
      status: "placed",
      placedAt: now,
    });
    return { ok: true as const, total, placedAt: now };
  },
});

export const purgeOrphanOrders = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdminByToken(ctx, args.token);
    const all = await ctx.db.query("orders").collect();
    let purged = 0;
    for (const o of all) {
      const team = await ctx.db.get(o.teamId);
      if (!team) {
        await ctx.db.delete(o._id);
        purged++;
      }
    }
    if (purged > 0) {
      await audit(ctx, {
        action: "food.purgeOrphanOrders",
        adminId: admin._id,
        adminLabel: admin.email,
        details: `Purged ${purged} orphan order row(s)`,
      });
    }
    return { ok: true as const, purged };
  },
});
