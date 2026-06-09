// supabase/functions/send-push/index.ts
// Web Push via VAPID. Reescrito en #121. Auth interna agregada en Sprint 1.
//
// Body: { title, body, url?, icon?, target?: { role?, user_id?, phone? } }
//   Default target: { role: 'customer' } => broadcast a todos los customers.
//
// AUTH: solo acepta (a) service role (invocaciones internas, ej submit-order)
// o (b) JWT de un usuario presente en admin_users. Antes cualquiera con la
// anon key (publica en el bundle) podia mandar push broadcast a toda la base.
//
// Env (Supabase secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

    // ── Auth interna: service role o admin real ──
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    let authorized = false;
    if (token && token === serviceKey) {
      authorized = true; // invocacion interna (submit-order, crons)
    } else if (token) {
      const { data: userData } = await supabase.auth.getUser(token);
      const uid = userData?.user?.id;
      if (uid) {
        const { data: adminRow } = await supabase.from("admin_users").select("user_id").eq("user_id", uid).maybeSingle();
        if (adminRow) authorized = true;
      }
    }
    if (!authorized) return json({ error: "No autorizado" }, 401);

    const { title, body, url, icon, target } = await req.json();
    if (!title || !body) return json({ error: "title and body are required" }, 400);

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "";
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "";
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@hermes.local";
    if (!vapidPublicKey || !vapidPrivateKey) return json({ error: "VAPID keys not configured" }, 500);
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    let q = supabase.from("push_subscriptions").select("*");
    const t = target || { role: "customer" };
    if (t.user_id) q = q.eq("user_id", t.user_id);
    else if (t.phone) q = q.eq("phone", t.phone);
    else if (t.role) q = q.eq("role", t.role);

    const { data: subs, error: subErr } = await q;
    if (subErr) throw subErr;
    if (!subs?.length) return json({ ok: true, sent: 0, message: "No subscribers" });

    const payload = JSON.stringify({
      title, body,
      url: url || "/",
      icon: icon || "/icons/icon-192.png",
    });

    let sent = 0, failed = 0;
    const staleEndpoints: string[] = [];

    await Promise.all(subs.map(async (sub) => {
      try {
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
        }, payload);
        sent++;
      } catch (e: any) {
        const code = e?.statusCode;
        if (code === 404 || code === 410) staleEndpoints.push(sub.endpoint);
        failed++;
      }
    }));

    if (staleEndpoints.length > 0) {
      await supabase.from("push_subscriptions").delete().in("endpoint", staleEndpoints);
    }

    return json({ ok: true, sent, failed, cleaned: staleEndpoints.length, total: subs.length });
  } catch (err: any) {
    console.error("send-push error:", err);
    return json({ error: err?.message || "Internal error" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
