import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function jsonRes(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS, ...extra } });
}
function getClientIp(req) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || "unknown";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return jsonRes({ error: "Method not allowed" }, 405);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  try {
    const { data: cfg } = await supabase.from("settings").select("cat_groups, daily_deals, deal_pct, payment_accounts").eq("id", 1).single();
    const catGroups = (cfg?.cat_groups || []);
    const dailyDeals = (cfg?.daily_deals || {});
    const dealPct = (cfg?.deal_pct ?? 15);
    const subToParent = {};
    catGroups.forEach((g) => (g.subs || []).forEach((s) => { subToParent[s] = g.name; }));
    function hasDealToday(recipeCategory) {
      const parentCat = subToParent[recipeCategory] || recipeCategory;
      const now = new Date();
      const argentinaOffset = -3 * 60;
      const argentinaTime = new Date(now.getTime() + (argentinaOffset + now.getTimezoneOffset()) * 60000);
      const dayOfWeek = argentinaTime.getDay();
      const dealDay = dayOfWeek === 0 ? 7 : dayOfWeek;
      const todayDeals = dailyDeals[String(dealDay)] || [];
      return todayDeals.includes(parentCat);
    }
    const clientIp = getClientIp(req);
    const { data: allowed } = await supabase.rpc("check_rate_limit", { p_key: `submit-order:${clientIp}`, p_max_requests: 10, p_window_seconds: 60 });
    if (allowed === false) return jsonRes({ error: "Demasiados pedidos. Esperá un momento antes de intentar de nuevo." }, 429, { "Retry-After": "60" });
    const body = await req.json();
    const customer = (body.customer || "").trim().slice(0, 200);
    const phone = (body.phone || "").replace(/\D/g, "").slice(0, 20);
    const email = body.email ? body.email.trim().toLowerCase().slice(0, 200) : null;
    const delivery = ["retiro", "envio"].includes(body.delivery) ? body.delivery : "retiro";
    // Medio de pago + cuenta. El snapshot lo arma el server desde settings (anti-spoof).
    const paymentAccounts = Array.isArray(cfg?.payment_accounts) ? cfg.payment_accounts : [];
    let payment = "efectivo";
    let paymentAccountId = null;
    let paymentAccountSnapshot = null;
    if (body.payment_account_id) {
      const acc = paymentAccounts.find((a) => a.id === body.payment_account_id && a.active !== false);
      if (!acc) return jsonRes({ error: "Cuenta de pago no válida" }, 400);
      payment = "transferencia"; // bucket legacy; el detalle exacto va en el snapshot
      paymentAccountId = acc.id;
      paymentAccountSnapshot = { id: acc.id, label: acc.label || "", banco: acc.banco || "", titular: acc.titular || "", alias: acc.alias || "", cbu: acc.cbu || "" };
    } else if (["efectivo", "transferencia", "mercadopago", "tarjeta"].includes(body.payment)) {
      payment = body.payment; // compat clientes viejos (sin account_id)
    }
    const note = body.note ? body.note.trim().slice(0, 500) : null;
    const isGift = body.is_gift === true;
    const giftNote = body.gift_note ? body.gift_note.trim().slice(0, 300) : "";
    const deliveryDate = body.delivery_date || null;
    const userId = body.user_id || null;
    // ── Propina (catalog-pro): % sobre subtotal, validado server-side ──
    const tipPct = Math.max(0, Math.min(100, Number(body.tip_pct) || 0));
    if (!customer || !phone) return jsonRes({ error: "Faltan datos: nombre y teléfono son obligatorios" }, 400);
    const items = body.items;
    if (!Array.isArray(items) || items.length === 0 || items.length > 50) return jsonRes({ error: "El pedido debe tener entre 1 y 50 productos" }, 400);
    const recipeIds = [...new Set(items.map((item) => item.recipeId))];
    const { data: dbRecipes, error: recipesError } = await supabase.from("recipes").select("id, sale_price, category, visible, is_archived").in("id", recipeIds);
    if (recipesError || !dbRecipes) return jsonRes({ error: "Error al obtener productos" }, 500);
    const recipeMap = {};
    dbRecipes.forEach((r) => { recipeMap[r.id] = r; });
    let serverTotal = 0;
    const validatedItems = [];
    for (const item of items) {
      const recipe = recipeMap[item.recipeId];
      if (!recipe) return jsonRes({ error: `Producto no encontrado: ${item.recipeId}` }, 400);
      if (!recipe.visible || recipe.is_archived) return jsonRes({ error: "Uno de los productos no está disponible" }, 400);
      const qty = Math.max(1, Math.min(999, Math.round(item.qty || 1)));
      const basePrice = recipe.sale_price;
      let unitPrice = basePrice;
      if (hasDealToday(recipe.category)) unitPrice = Math.round(basePrice * (1 - dealPct / 100));
      const subtotal = qty * unitPrice;
      serverTotal += subtotal;
      validatedItems.push({ recipeId: item.recipeId, qty, unitPrice, subtotal });
    }
    let validDiscount = 0;
    let validCouponId = null;
    if (body.coupon_code) {
      const { data: coupon } = await supabase.from("coupons").select("id, code, discount_pct, used, expires_at, email").eq("code", body.coupon_code.toUpperCase().trim()).eq("used", false).single();
      if (coupon) {
        const isExpired = coupon.expires_at && new Date(coupon.expires_at) < new Date();
        const emailMatch = !coupon.email || !email || coupon.email.toLowerCase() === email;
        if (!isExpired && emailMatch) { validDiscount = Math.round(serverTotal * (coupon.discount_pct / 100)); validCouponId = coupon.id; }
      }
    }
    // Propina: calculada sobre el subtotal server-side (no se confía en el cliente)
    const tipAmount = Math.round(serverTotal * tipPct / 100);
    const finalTotal = Math.max(0, serverTotal - validDiscount) + tipAmount;
    if (email) await supabase.from("customers").upsert({ email, name: customer, phone, last_order_at: new Date().toISOString() }, { onConflict: "email" });
    const { data: order, error: orderError } = await supabase.from("orders").insert({ status: "new", date: new Date().toISOString().split("T")[0], customer, phone, email, delivery, payment, payment_account_id: paymentAccountId, payment_account_snapshot: paymentAccountSnapshot, note, total: finalTotal, is_gift: isGift, gift_note: giftNote, coupon_id: validCouponId, discount: validDiscount, tip_pct: tipPct, tip_amount: tipAmount, delivery_date: deliveryDate, user_id: userId }).select("id").single();
    if (orderError || !order) { console.error("Error creando pedido:", orderError); return jsonRes({ error: "Error al crear el pedido" }, 500); }
    if (validCouponId) await supabase.from("coupons").update({ used: true, used_at: new Date().toISOString() }).eq("id", validCouponId);
    const costMap = {};
    await Promise.all(recipeIds.map(async (recipeId) => {
      const { data: recipeIngredients } = await supabase.from("recipe_ingredients").select("qty, ingredients(cost)").eq("recipe_id", recipeId);
      costMap[recipeId] = (recipeIngredients || []).reduce((sum, ri) => sum + (ri.ingredients?.cost || 0) * (ri.qty || 0), 0);
    }));
    const orderItems = validatedItems.map((item) => ({ order_id: order.id, recipe_id: item.recipeId, qty: item.qty, unit_price: item.unitPrice, unit_cost: costMap[item.recipeId] || 0, subtotal: item.subtotal }));
    const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
    if (itemsError) { console.error("Error creando items:", itemsError); await supabase.from("orders").delete().eq("id", order.id); return jsonRes({ error: "Error al crear los items" }, 500); }
    // Push al admin (fire-and-forget, no bloquea el response al cliente)
    try {
      await supabase.functions.invoke("send-push", {
        body: {
          title: "Nuevo pedido",
          body: `${customer || "Cliente"} - $${finalTotal}`,
          url: "/admin/orders",
          target: { role: "admin" },
        },
      });
    } catch (e) {
      console.warn("send-push admin (non-blocking):", e?.message);
    }
    return jsonRes({ ok: true, orderId: order.id, total: finalTotal, discount: validDiscount, tip: tipAmount });
  } catch (err) {
    console.error("submit-order error:", err);
    return jsonRes({ error: err.message }, 500);
  }
});
