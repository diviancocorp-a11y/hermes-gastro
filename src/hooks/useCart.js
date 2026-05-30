import { useState, useCallback, useMemo, useEffect } from "react";
import { captureException } from "../lib/observability.js";

/**
 * useCart — manages cart state, quantities, totals, and session persistence.
 * @param {Function} getPrice - function that returns the final price for a product
 * @param {Array} products - full product list (for upselling lookups)
 * @param {Object|null} coupon - applied coupon { id, discount_pct }
 * @param {number} deliveryCost - calculated delivery cost
 * @param {string} deliveryType - "retiro" | "envio"
 */
export default function useCart(getPrice, products, coupon, deliveryCost, deliveryType) {
  const [cart, setCart] = useState([]);
  const [upsell, setUpsell] = useState(null);

  // Restore cart from sessionStorage on mount (returning from login/register)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("lnp_cart");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCart(parsed);
        }
        sessionStorage.removeItem("lnp_cart");
        return; // signal caller to reopen checkout
      }
    } catch (err) {
      // sessionStorage corrupto o JSON.parse falló — limpiamos y reportamos
      try { sessionStorage.removeItem("lnp_cart"); } catch {}
      captureException(err, { tags: { source: 'useCart.restore' } });
    }
  }, []);

  // Quick O(1) quantity lookup map
  const cartQtyMap = useMemo(() => {
    const m = {};
    cart.forEach(i => { m[i.id] = i.qty; });
    return m;
  }, [cart]);

  const getQty = useCallback((id) => cartQtyMap[id] || 0, [cartQtyMap]);

  // Totals
  const { cc, ctBase, discount, ct, ctWithDelivery } = useMemo(() => {
    const cc = cart.reduce((s, i) => s + i.qty, 0);
    const ctBase = cart.reduce((s, i) => s + i.qty * i.price, 0);
    const discount = coupon ? Math.round(ctBase * coupon.discount_pct / 100) : 0;
    const ct = ctBase - discount;
    const ctWithDelivery = ct + (deliveryType === "envio" ? deliveryCost : 0);
    return { cc, ctBase, discount, ct, ctWithDelivery };
  }, [cart, coupon, deliveryCost, deliveryType]);

  // Add to cart with upselling
  const addToCart = useCallback((p, e) => {
    if (e) e.stopPropagation();
    const finalPrice = getPrice(p);
    setCart(prev => {
      const isNew = !prev.find(i => i.id === p.id);
      const newCart = isNew
        ? [...prev, { id: p.id, name: p.name, price: finalPrice, qty: 1, img: p.image_url }]
        : prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      if (isNew && p.related_ids?.length > 0) {
        const suggestions = products.filter(x => p.related_ids.includes(x.id));
        if (suggestions.length > 0) setUpsell({ product: p, suggestions: suggestions.slice(0, 3) });
      }
      return newCart;
    });
  }, [products, getPrice]);

  // Add from upsell popup
  const addFromUpsell = useCallback((p) => {
    const finalPrice = getPrice(p);
    setCart(prev => {
      const ex = prev.find(i => i.id === p.id);
      if (ex) return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { id: p.id, name: p.name, price: finalPrice, qty: 1, img: p.image_url }];
    });
    setUpsell(null);
  }, [getPrice]);

  // Update quantity (0 = remove)
  const updateQty = useCallback((id, nq) => {
    if (nq <= 0) setCart(p => p.filter(i => i.id !== id));
    else setCart(p => p.map(i => i.id === id ? { ...i, qty: nq } : i));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  // Save cart to sessionStorage (for login redirect)
  const persistCart = useCallback(() => {
    if (cart.length > 0) sessionStorage.setItem("lnp_cart", JSON.stringify(cart));
  }, [cart]);

  return {
    cart, setCart, upsell, setUpsell,
    getQty, addToCart, addFromUpsell, updateQty, clearCart, persistCart,
    cc, ctBase, discount, ct, ctWithDelivery
  };
}
