// supabase/functions/scheduled-export/index.ts
// Scheduled export: generates a CSV summary and sends it via email.
// Triggered by pg_cron or manually via HTTP POST.
//
// Environment variables required:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   RESEND_API_KEY (or SMTP config) — for sending email
//   EXPORT_EMAIL — recipient email address
//
// pg_cron setup (run once in SQL):
//   SELECT cron.schedule('weekly-export', '0 8 * * 1',
//     $$SELECT net.http_post(
//       url := current_setting('app.supabase_url') || '/functions/v1/scheduled-export',
//       headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key')),
//       body := '{"period":"week"}'::jsonb
//     )$$
//   );

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { period = "week" } = await req.json().catch(() => ({}));

    // Calculate date range
    const now = new Date();
    const from = new Date(now);
    if (period === "day") from.setDate(from.getDate() - 1);
    else if (period === "month") from.setMonth(from.getMonth() - 1);
    else from.setDate(from.getDate() - 7); // default: week

    const fromISO = from.toISOString().slice(0, 10);
    const toISO = now.toISOString().slice(0, 10);

    // Fetch sales in period
    const { data: sales, error: salesErr } = await supabase
      .from("sales")
      .select("date, total, qty, recipe_id, payment_method")
      .gte("date", fromISO)
      .lte("date", toISO)
      .order("date", { ascending: true });

    if (salesErr) throw salesErr;

    // Fetch expenses in period
    const { data: expenses, error: expErr } = await supabase
      .from("expenses")
      .select("date, description, amount, category")
      .gte("date", fromISO)
      .lte("date", toISO);

    if (expErr) throw expErr;

    // Generate summary
    const totalSales = (sales || []).reduce((s, r) => s + (r.total || 0), 0);
    const totalExpenses = (expenses || []).reduce((s, r) => s + (r.amount || 0), 0);
    const profit = totalSales - totalExpenses;

    // Generate CSV
    const csvLines = ["Fecha,Tipo,Descripción,Monto"];
    (sales || []).forEach(s => {
      csvLines.push(`${s.date},Venta,${s.recipe_id || 'N/A'},${s.total}`);
    });
    (expenses || []).forEach(e => {
      csvLines.push(`${e.date},Gasto,"${(e.description || '').replace(/"/g, '""')}",${e.amount}`);
    });
    const csv = csvLines.join("\n");

    // Prepare email body
    const subject = `Reporte ${period === 'day' ? 'diario' : period === 'month' ? 'mensual' : 'semanal'} — ${fromISO} a ${toISO}`;
    const htmlBody = `
      <h2>📊 Reporte de La Nona Pato</h2>
      <p><strong>Período:</strong> ${fromISO} a ${toISO}</p>
      <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse">
        <tr><td><strong>Ventas</strong></td><td style="text-align:right">$${totalSales.toLocaleString()}</td></tr>
        <tr><td><strong>Gastos</strong></td><td style="text-align:right">$${totalExpenses.toLocaleString()}</td></tr>
        <tr><td><strong>Ganancia</strong></td><td style="text-align:right;color:${profit >= 0 ? 'green' : 'red'}">$${profit.toLocaleString()}</td></tr>
        <tr><td><strong>Transacciones</strong></td><td style="text-align:right">${(sales?.length || 0) + (expenses?.length || 0)}</td></tr>
      </table>
      <p style="color:#888;font-size:12px;margin-top:16px">Archivo CSV adjunto con el detalle completo.</p>
    `;

    // Send email via Resend (if configured)
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const exportEmail = Deno.env.get("EXPORT_EMAIL");

    if (resendKey && exportEmail) {
      const emailResp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "La Nona Pato <noreply@resend.dev>",
          to: [exportEmail],
          subject,
          html: htmlBody,
          attachments: [{
            filename: `reporte_${fromISO}_${toISO}.csv`,
            content: btoa(unescape(encodeURIComponent("\uFEFF" + csv))),
          }],
        }),
      });

      if (!emailResp.ok) {
        const errText = await emailResp.text();
        console.error("Email send failed:", errText);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        period,
        from: fromISO,
        to: toISO,
        totalSales,
        totalExpenses,
        profit,
        salesCount: sales?.length || 0,
        expensesCount: expenses?.length || 0,
        emailSent: !!(resendKey && exportEmail),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("scheduled-export error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
