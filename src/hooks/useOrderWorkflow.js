import { useCallback, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import {
  updateOrderStatus, createSale, updateIngredientStock,
  deductComboStock, createCouponForOrder,
} from "../lib/adminService";
import { formatInt, todayISO, generateId, OrderStatus, playNotificationSound } from "../lib/utils";

/**
 * useOrderWorkflow — Handles order status transitions, stock deductions,
 * scheduled order promotion, and auto-cancellation of stale orders.
 */
export default function useOrderWorkflow({
  orders, setOrders, recs, ings, setIngs, sett, loaded, setSales, setOv, msg,
}) {
  // ═══ Promote scheduled orders for today ═══
  const promotedRef = useRef(new Set());
  useEffect(() => {
    if (!loaded || !orders.length) return;
    const today = todayISO();
    const storeOpen = sett.store_open !== false;
    if (!storeOpen) return;
    const toPromote = orders.filter(
      o => o.delivery_date && o.delivery_date <= today && o.status === OrderStatus.NEW && !promotedRef.current.has(o.id)
    );
    if (toPromote.length === 0) return;
    toPromote.forEach(o => promotedRef.current.add(o.id));
    (async () => {
      for (const o of toPromote) {
        await supabase.from('orders').update({ delivery_date: null }).eq('id', o.id);
      }
      setOrders(p => p.map(o => {
        if (toPromote.find(tp => tp.id === o.id)) return { ...o, delivery_date: null };
        return o;
      }));
      msg(`📅 ${toPromote.length} pedido${toPromote.length > 1 ? 's' : ''} programado${toPromote.length > 1 ? 's' : ''} activado${toPromote.length > 1 ? 's' : ''}`);
    })();
  }, [loaded, orders, sett.store_open, msg, setOrders]);

  // ═══ Auto-cancel stale orders from previous days ═══
  const cleanedRef = useRef(new Set());
  useEffect(() => {
    if (!loaded || !orders.length) return;
    const today = todayISO();
    const stale = orders.filter(o =>
      [OrderStatus.NEW, OrderStatus.PREPARING, OrderStatus.ACTIVE].includes(o.status) &&
      o.date < today &&
      (!o.delivery_date || o.delivery_date < today) &&
      !cleanedRef.current.has(o.id)
    );
    if (stale.length === 0) return;
    stale.forEach(o => cleanedRef.current.add(o.id));
    (async () => {
      for (const o of stale) {
        await supabase.from('orders').update({ status: OrderStatus.CANCELLED }).eq('id', o.id);
      }
      setOrders(p => p.map(o => {
        if (stale.find(s => s.id === o.id)) return { ...o, status: OrderStatus.CANCELLED };
        return o;
      }));
      msg(`🧹 ${stale.length} pedido${stale.length > 1 ? 's' : ''} vencido${stale.length > 1 ? 's' : ''} cancelado${stale.length > 1 ? 's' : ''} automáticamente`);
    })();
  }, [loaded, orders, msg, setOrders]);

  // ═══ Move order to next status ═══
  const moveOrder = useCallback(async (id, nextStatus, force = false) => {
    const o = orders.find(x => x.id === id);
    if (!o) return;

    // Cancel flow
    if (nextStatus === OrderStatus.CANCELLED) {
      if ([OrderStatus.PREPARING, OrderStatus.ACTIVE].includes(o.status)) {
        setOv({ type: "cancel", orderId: id, order: o });
        return;
      }
      await updateOrderStatus(id, OrderStatus.CANCELLED);
      setOrders(p => p.map(x => x.id === id ? { ...x, status: OrderStatus.CANCELLED } : x));
      msg("Cancelado");
      return;
    }

    // New → Preparing (deduct stock)
    if (nextStatus === OrderStatus.PREPARING && o.status === OrderStatus.NEW) {
      const items = o.order_items || o.items || [];
      if (!force) {
        const deficits = [];
        for (const it of items) {
          const r = recs.find(x => x.id === it.recipe_id);
          if (!r || r.is_combo) continue;
          const qty = it.quantity || it.qty || 1;
          for (const ri of (r.ingredients || [])) {
            const ing = ings.find(x => x.id === ri.ingredient_id);
            if (!ing) continue;
            const after = (ing.stock || 0) - (ri.quantity * qty);
            if (after < 0) deficits.push({ name: ing.name, current: formatInt(ing.stock || 0), needed: formatInt(ri.quantity * qty), unit: ing.unit, after: formatInt(after) });
          }
        }
        if (deficits.length > 0) {
          setOv({ type: "stockWarning", orderId: id, order: o, deficits });
          return;
        }
      }
      // Deduct stock
      const ingMap = {};
      ings.forEach(i => { ingMap[i.id] = i; });
      const riMap = {};
      recs.forEach(r => { riMap[r.id] = (r.ingredients || []); });
      for (const it of items) {
        const r = recs.find(x => x.id === it.recipe_id);
        if (!r) continue;
        const qty = it.quantity || it.qty || 1;
        if (r.is_combo) {
          await deductComboStock(r.id, qty, ingMap, riMap);
        } else {
          for (const ri of (r.ingredients || [])) {
            await updateIngredientStock(ri.ingredient_id, -(ri.quantity * qty));
          }
        }
      }
      setIngs(prev => {
        const n = [...prev];
        items.forEach(it => {
          const r = recs.find(x => x.id === it.recipe_id);
          if (!r || r.is_combo) return;
          (r.ingredients || []).forEach(ri => {
            const idx = n.findIndex(x => x.id === ri.ingredient_id);
            if (idx >= 0) n[idx] = { ...n[idx], stock: Math.max(0, (n[idx].stock || 0) - ri.quantity * (it.quantity || it.qty || 1)) };
          });
        });
        return n;
      });
      msg("En preparación · Stock actualizado");
    }

    // Done → Register sales
    if (nextStatus === OrderStatus.COMPLETED) {
      const items = o.order_items || o.items || [];
      for (const it of items) {
        await createSale({ date: todayISO(), recipe_id: it.recipe_id, qty: it.quantity || it.qty || 1, unit_price: it.unit_price || 0, unit_cost: it.unit_cost || 0, total: (it.quantity || it.qty || 1) * (it.unit_price || 0) });
      }
      setSales(prev => {
        const nw = [...prev];
        items.forEach(it => {
          nw.push({ id: generateId(), date: todayISO(), recipe_id: it.recipe_id, qty: it.quantity || it.qty || 1, unit_price: it.unit_price || 0, total: (it.quantity || it.qty || 1) * (it.unit_price || 0) });
        });
        return nw;
      });
      if (o.email) {
        // % configurable por tenant (settings.coupon_default_pct, Sprint 2)
        const couponPct = Number(sett?.coupon_default_pct) > 0 ? Number(sett.coupon_default_pct) : 10;
        const coupon = await createCouponForOrder(o.id, o.email, couponPct);
        if (coupon) msg(`✅ Completado · Cupón ${coupon.code} enviado a ${o.email}`);
        else msg("Completado · Venta registrada");
      } else {
        msg("Completado · Venta registrada");
      }
    }

    if (nextStatus === OrderStatus.ACTIVE) msg("Activo · Listo para entrega");

    await updateOrderStatus(id, nextStatus);
    setOrders(p => p.map(x => x.id === id ? { ...x, status: nextStatus, ...(nextStatus === OrderStatus.COMPLETED ? { completedAt: new Date().toISOString() } : {}) } : x));
  }, [orders, recs, ings, setOrders, setIngs, setSales, setOv, msg]);

  // ═══ Confirm cancellation (with optional stock return) ═══
  const confirmCancel = useCallback(async (id, returnStock) => {
    const o = orders.find(x => x.id === id);
    if (!o) return;
    if (returnStock) {
      const items = o.order_items || o.items || [];
      for (const it of items) {
        const r = recs.find(x => x.id === it.recipe_id);
        if (!r) continue;
        for (const ri of (r.ingredients || [])) {
          await updateIngredientStock(ri.ingredient_id, ri.quantity * (it.quantity || it.qty || 1));
        }
      }
      setIngs(prev => {
        const n = [...prev];
        (o.order_items || o.items || []).forEach(it => {
          const r = recs.find(x => x.id === it.recipe_id);
          if (!r) return;
          (r.ingredients || []).forEach(ri => {
            const idx = n.findIndex(x => x.id === ri.ingredient_id);
            if (idx >= 0) n[idx] = { ...n[idx], stock: (n[idx].stock || 0) + ri.quantity * (it.quantity || it.qty || 1) };
          });
        });
        return n;
      });
      msg("Cancelado · Stock devuelto");
    } else {
      msg("Cancelado · Desperdicio registrado");
    }
    await updateOrderStatus(id, OrderStatus.CANCELLED);
    setOrders(p => p.map(x => x.id === id ? { ...x, status: OrderStatus.CANCELLED } : x));
    setOv(null);
  }, [orders, recs, setOrders, setIngs, setOv, msg]);

  // ═══ Add order (from manual order form) ═══
  const addOrder = useCallback(async (o) => {
    setOrders(p => [o, ...p]);
    playNotificationSound();
    msg("Pedido creado");
  }, [setOrders, msg]);

  return { moveOrder, confirmCancel, addOrder };
}
