// supabase/functions/admin-users/index.ts
// Gestion de usuarios admin (Sprint 1). Solo OWNERS pueden operar.
//
// Body: { action: 'list' | 'create' | 'set_role' | 'remove', ... }
//   list:     {}                                -> [{ user_id, email, role, created_at, last_sign_in_at }]
//   create:   { email, password, role }        -> crea auth user (o reusa existente por email) + lo agrega a admin_users
//   set_role: { user_id, role }                -> cambia owner/staff (protege al ultimo owner)
//   remove:   { user_id }                      -> saca de admin_users (NO borra el auth user; protege al ultimo owner)
//
// AUTH: JWT del caller debe estar en admin_users con role='owner'.
// verify_jwt=false en el gateway (keys sb_publishable no son JWT) — la auth es interna.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
};
function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

    // ── Auth: caller debe ser owner ──
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "No autorizado" }, 401);
    const { data: userData } = await supabase.auth.getUser(token);
    const callerId = userData?.user?.id;
    if (!callerId) return json({ error: "Sesion invalida" }, 401);
    const { data: callerRow } = await supabase.from("admin_users").select("role").eq("user_id", callerId).maybeSingle();
    if (callerRow?.role !== "owner") return json({ error: "Solo los owners pueden gestionar usuarios" }, 403);

    const body = await req.json();
    const action = body.action;

    if (action === "list") {
      const { data: rows, error } = await supabase.from("admin_users").select("user_id, role, created_at").order("created_at");
      if (error) throw error;
      const result = [];
      for (const r of rows || []) {
        const { data: u } = await supabase.auth.admin.getUserById(r.user_id);
        result.push({
          user_id: r.user_id,
          role: r.role,
          created_at: r.created_at,
          email: u?.user?.email || "(sin email)",
          last_sign_in_at: u?.user?.last_sign_in_at || null,
        });
      }
      return json({ ok: true, users: result });
    }

    if (action === "create") {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const role = body.role === "owner" ? "owner" : "staff";
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "Email invalido" }, 400);
      if (password.length < 8) return json({ error: "Password minimo 8 caracteres" }, 400);

      // Reusar auth user si ya existe con ese email (ej: era cliente del catalogo)
      let userId: string | null = null;
      const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
      const existing = list?.users?.find((u) => (u.email || "").toLowerCase() === email);
      if (existing) {
        userId = existing.id;
        // actualizar password para que pueda entrar al admin
        await supabase.auth.admin.updateUserById(userId, { password });
      } else {
        const { data: created, error: createErr } = await supabase.auth.admin.createUser({
          email, password, email_confirm: true,
        });
        if (createErr || !created?.user) return json({ error: createErr?.message || "No se pudo crear el usuario" }, 500);
        userId = created.user.id;
      }

      const { error: upsertErr } = await supabase.from("admin_users").upsert(
        { user_id: userId, role, added_by: callerId },
        { onConflict: "user_id" },
      );
      if (upsertErr) throw upsertErr;
      return json({ ok: true, user_id: userId, email, role, reused: !!existing });
    }

    if (action === "set_role" || action === "remove") {
      const targetId = String(body.user_id || "");
      if (!targetId) return json({ error: "Falta user_id" }, 400);

      // Proteccion: nunca dejar el tenant sin owners
      const { data: owners } = await supabase.from("admin_users").select("user_id").eq("role", "owner");
      const ownerIds = (owners || []).map((o) => o.user_id);
      const demotingLastOwner = ownerIds.length === 1 && ownerIds[0] === targetId
        && (action === "remove" || body.role !== "owner");
      if (demotingLastOwner) return json({ error: "No podes sacar al ultimo owner" }, 400);

      if (action === "set_role") {
        const role = body.role === "owner" ? "owner" : "staff";
        const { error } = await supabase.from("admin_users").update({ role }).eq("user_id", targetId);
        if (error) throw error;
        return json({ ok: true, user_id: targetId, role });
      } else {
        const { error } = await supabase.from("admin_users").delete().eq("user_id", targetId);
        if (error) throw error;
        return json({ ok: true, removed: targetId });
      }
    }

    return json({ error: "Accion desconocida" }, 400);
  } catch (err: any) {
    console.error("admin-users error:", err);
    return json({ error: err?.message || "Internal error" }, 500);
  }
});
