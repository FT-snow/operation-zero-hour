import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdminByToken, requireTeamByToken, audit } from "./lib/auth";

const DELIVERY_CHARGE = 10;
const MAX_QTY_PER_ITEM = 10;
const MAX_MENU_ITEMS = 40;

// Admin configuration
export const configFoodGet = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireAdminByToken(ctx, args.token);
    const cfg = await ctx.db.query("config").first();
    return {
      restaurantName: cfg?.restaurantName ?? "COSMOS MENU",
      upiVpa: cfg?.upiVpa ?? "",
      payLink: cfg?.payLink ?? "",
      foodNote: cfg?.foodNote ?? "",
      foodEnabled: cfg?.foodEnabled ?? false,
      deliveryCharge: DELIVERY_CHARGE,
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
    foodEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminByToken(ctx, args.token);
    const restaurantName = args.restaurantName.trim();
    const upiVpa = args.upiVpa.trim();
    const payLink = args.payLink.trim();

    if (!restaurantName) return { ok: false as const, error: "Menu name is required" };
    if (payLink && !/^https:\/\//.test(payLink)) {
      return { ok: false as const, error: "Payment link must start with https://" };
    }
    if (upiVpa && !/^[a-zA-Z0-9._-]{2,64}@[a-zA-Z]{2,32}$/.test(upiVpa)) {
      return { ok: false as const, error: "UPI ID looks invalid" };
    }

    const cfg = await ctx.db.query("config").first();
    const patch = {
      restaurantName,
      upiVpa,
      payLink,
      foodNote: args.foodNote.trim(),
      foodEnabled: args.foodEnabled,
    };
    if (cfg) await ctx.db.patch(cfg._id, patch);
    else await ctx.db.insert("config", patch);

    await audit(ctx, {
      action: "food.setConfig",
      adminId: admin._id,
      adminLabel: admin.email,
      details: `Food ordering ${args.foodEnabled ? "enabled" : "disabled"}: ${restaurantName}`,
    });
    return { ok: true as const };
  },
});

// Admin menu management
export const menuAdmin = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireAdminByToken(ctx, args.token);
    const items = await ctx.db.query("menu_items").withIndex("by_order").collect();
    return { items: items.sort((a, b) => a.order - b.order) };
  },
});

export const setMenuItem = mutation({
  args: {
    token: v.string(),
    order: v.number(),
    name: v.string(),
    price: v.number(),
    veg: v.boolean(),
    cat: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminByToken(ctx, args.token);
    const name = args.name.trim();
    const cat = args.cat.trim().toUpperCase();
    if (args.order < 1 || args.order > MAX_MENU_ITEMS) {
      return { ok: false as const, error: `Menu row must be 1-${MAX_MENU_ITEMS}` };
    }
    if (!name) return { ok: false as const, error: "Item name is required" };
    if (!cat) return { ok: false as const, error: "Category is required" };
    if (!Number.isInteger(args.price) || args.price < 0) {
      return { ok: false as const, error: "Price must be a whole number" };
    }

    const existing = await ctx.db
      .query("menu_items")
      .withIndex("by_order", (q) => q.eq("order", args.order))
      .unique();
    const item = { name, price: args.price, veg: args.veg, cat };
    if (existing) await ctx.db.patch(existing._id, item);
    else await ctx.db.insert("menu_items", { order: args.order, ...item });

    await audit(ctx, {
      action: "food.setMenuItem",
      adminId: admin._id,
      adminLabel: admin.email,
      details: `${cat}: ${name} @ Rs.${args.price}`,
    });
    return { ok: true as const };
  },
});

export const ordersAdmin = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireAdminByToken(ctx, args.token);
    const orders = await ctx.db.query("orders").collect();
    const visible = [];
    for (const order of orders) {
      const team = await ctx.db.get(order.teamId);
      if (!team) continue;
      visible.push({
        _id: order._id,
        teamCode: team.teamCode,
        teamName: team.teamName,
        items: order.items,
        subtotal: order.subtotal,
        deliveryCharge: order.deliveryCharge,
        total: order.total,
        status: order.status,
        transactionId: order.transactionId ?? "",
        paymentScreenshotUrl: order.paymentScreenshotId
          ? await ctx.storage.getUrl(order.paymentScreenshotId)
          : null,
        placedAt: order.placedAt,
      });
    }
    visible.sort((a, b) => a.placedAt - b.placedAt);
    return {
      orders: visible,
      revenue: visible.reduce((sum, order) => sum + order.total, 0),
    };
  },
});

export const resetOrder = mutation({
  args: { token: v.string(), teamCode: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdminByToken(ctx, args.token);
    const code = args.teamCode.trim().toUpperCase();
    const team = await ctx.db
      .query("teams")
      .withIndex("by_teamCode", (q) => q.eq("teamCode", code))
      .unique();
    if (!team) return { ok: false as const, error: "Team not found" };
    const order = await ctx.db
      .query("orders")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .unique();
    if (order) await ctx.db.delete(order._id);
    await audit(ctx, {
      action: "food.resetOrder",
      adminId: admin._id,
      adminLabel: admin.email,
      details: `Food order reset for ${code}`,
    });
    return { ok: true as const };
  },
});

export const purgeOrphanOrders = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdminByToken(ctx, args.token);
    const orders = await ctx.db.query("orders").collect();
    let purged = 0;
    for (const order of orders) {
      if (!(await ctx.db.get(order.teamId))) {
        await ctx.db.delete(order._id);
        purged += 1;
      }
    }
    await audit(ctx, {
      action: "food.purgeOrphanOrders",
      adminId: admin._id,
      adminLabel: admin.email,
      details: `Purged ${purged} orphan food order(s)`,
    });
    return { ok: true as const, purged };
  },
});

// Team menu and existing order. Menu data is never returned while disabled.
export const listFood = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const team = await requireTeamByToken(ctx, args.token);
    const cfg = await ctx.db.query("config").first();
    const enabled = cfg?.foodEnabled ?? false;
    const order = await ctx.db
      .query("orders")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .unique();

    if (!enabled) {
      return {
        enabled: false as const,
        restaurantName: cfg?.restaurantName ?? "COSMOS MENU",
        upiVpa: "",
        payLink: "",
        foodNote: cfg?.foodNote ?? "",
        deliveryCharge: DELIVERY_CHARGE,
        items: [],
        myOrder: order ? { status: order.status, subtotal: order.subtotal, deliveryCharge: order.deliveryCharge, total: order.total, items: order.items, placedAt: order.placedAt } : null,
      };
    }

    const items = (await ctx.db.query("menu_items").withIndex("by_order").collect())
      .sort((a, b) => a.order - b.order)
      .map((item) => ({ order: item.order, name: item.name, price: item.price, veg: item.veg, cat: item.cat ?? "MENU" }));

    return {
      enabled: true as const,
      restaurantName: cfg?.restaurantName ?? "COSMOS MENU",
      upiVpa: cfg?.upiVpa ?? "",
      payLink: cfg?.payLink ?? "",
      foodNote: cfg?.foodNote ?? "",
      deliveryCharge: DELIVERY_CHARGE,
      items,
      myOrder: order
        ? {
            status: order.status,
            subtotal: order.subtotal,
            deliveryCharge: order.deliveryCharge,
            total: order.total,
            items: order.items,
            placedAt: order.placedAt,
            transactionId: order.transactionId ?? "",
            hasScreenshot: Boolean(order.paymentScreenshotId),
          }
        : null,
    };
  },
});

export const placeOrder = mutation({
  args: {
    token: v.string(),
    items: v.array(v.object({ order: v.number(), qty: v.number() })),
  },
  handler: async (ctx, args) => {
    const team = await requireTeamByToken(ctx, args.token);
    const cfg = await ctx.db.query("config").first();
    if (!cfg?.foodEnabled) return { ok: false as const, error: "Food ordering is not open yet" };

    const existing = await ctx.db
      .query("orders")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .unique();
    if (existing) return { ok: false as const, error: "Order already started for this team" };
    if (!args.items.length) return { ok: false as const, error: "Cart is empty" };
    if (args.items.length > MAX_MENU_ITEMS) return { ok: false as const, error: "Too many menu lines" };

    const menu = await ctx.db.query("menu_items").collect();
    const byOrder = new Map(menu.map((item) => [item.order, item]));
    const seen = new Set<number>();
    const lineItems = [];
    let subtotal = 0;
    for (const line of args.items) {
      const item = byOrder.get(line.order);
      if (!item) return { ok: false as const, error: "Unknown menu item" };
      if (seen.has(line.order)) return { ok: false as const, error: "Duplicate menu item" };
      if (!Number.isInteger(line.qty) || line.qty < 1 || line.qty > MAX_QTY_PER_ITEM) {
        return { ok: false as const, error: `Invalid quantity for ${item.name}` };
      }
      seen.add(line.order);
      const price = item.price * line.qty;
      lineItems.push({ name: item.name, qty: line.qty, price });
      subtotal += price;
    }

    const placedAt = Date.now();
    const deliveryCharge = DELIVERY_CHARGE;
    const total = subtotal + deliveryCharge;
    await ctx.db.insert("orders", {
      teamId: team._id,
      items: lineItems,
      subtotal,
      deliveryCharge,
      total,
      status: "awaiting_payment",
      placedAt,
    });
    return { ok: true as const, subtotal, deliveryCharge, total, placedAt };
  },
});

export const generatePaymentUploadUrl = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const team = await requireTeamByToken(ctx, args.token);
    const order = await ctx.db
      .query("orders")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .unique();
    if (!order) return { ok: false as const, error: "Create the order summary first" };
    if (order.status === "confirmed") return { ok: false as const, error: "Payment already submitted" };
    return { ok: true as const, uploadUrl: await ctx.storage.generateUploadUrl() };
  },
});

export const confirmPayment = mutation({
  args: {
    token: v.string(),
    transactionId: v.string(),
    paymentScreenshotId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const team = await requireTeamByToken(ctx, args.token);
    const transactionId = args.transactionId.trim();
    if (transactionId.length < 4 || transactionId.length > 100) {
      return { ok: false as const, error: "Enter a valid transaction ID" };
    }
    const order = await ctx.db
      .query("orders")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .unique();
    if (!order) return { ok: false as const, error: "Order not found" };
    if (order.status === "confirmed") return { ok: false as const, error: "Payment already submitted" };
    await ctx.db.patch(order._id, {
      status: "confirmed",
      transactionId,
      paymentScreenshotId: args.paymentScreenshotId,
    });
    return { ok: true as const };
  },
});
