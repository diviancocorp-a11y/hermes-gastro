// supabase/functions/afip-invoice/index.ts
// AFIP Electronic Invoice Edge Function
// Handles: authorize invoice (FECAESolicitar), get last invoice (FECompUltimoAutorizado),
// and get invoice details (FECompConsultar).
//
// Environment variables:
//   AFIP_CUIT — business CUIT (without hyphens)
//   AFIP_CERT — PEM certificate (base64 encoded)
//   AFIP_KEY — PEM private key (base64 encoded)
//   AFIP_ENV — 'production' | 'testing' (default: testing)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
};

// AFIP WSFE endpoints
const AFIP_URLS = {
  testing: {
    wsaa: "https://wsaahomo.afip.gov.ar/ws/services/LoginCms",
    wsfe: "https://wswhomo.afip.gov.ar/wsfev1/service.asmx",
  },
  production: {
    wsaa: "https://wsaa.afip.gov.ar/ws/services/LoginCms",
    wsfe: "https://servicios1.afip.gov.ar/wsfev1/service.asmx",
  },
};

// Invoice types (Tipos de Comprobante)
const INVOICE_TYPES = {
  FACTURA_C: 11,    // Factura C (Monotributo)
  FACTURA_B: 6,     // Factura B (Resp. Inscripto → Consumidor Final)
  FACTURA_A: 1,     // Factura A (Resp. Inscripto → Resp. Inscripto)
  NOTA_CREDITO_C: 13,
};

// IVA conditions
const IVA_CONDITIONS = {
  CONSUMIDOR_FINAL: 5,
  RESP_INSCRIPTO: 1,
  MONOTRIBUTO: 6,
  EXENTO: 4,
};

interface InvoiceRequest {
  action: "create" | "last_number" | "consult" | "status";
  order_id?: string;
  invoice_type?: number;
  punto_venta?: number;
  doc_tipo?: number;
  doc_nro?: string;
  items?: Array<{ description: string; quantity: number; unit_price: number }>;
  total?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body: InvoiceRequest = await req.json();
    const env = (Deno.env.get("AFIP_ENV") || "testing") as "testing" | "production";
    const cuit = Deno.env.get("AFIP_CUIT") || "";
    const puntoVenta = body.punto_venta || 1;

    switch (body.action) {
      case "status": {
        // Health check — verifies AFIP credentials are configured
        return jsonResponse({
          ok: true,
          env,
          cuit_configured: !!cuit,
          cert_configured: !!Deno.env.get("AFIP_CERT"),
          key_configured: !!Deno.env.get("AFIP_KEY"),
        });
      }

      case "last_number": {
        // Get last authorized invoice number for a given type and punto de venta
        const invoiceType = body.invoice_type || INVOICE_TYPES.FACTURA_C;
        const lastNum = await getLastInvoiceNumber(env, cuit, puntoVenta, invoiceType);
        return jsonResponse({ ok: true, last_number: lastNum, invoice_type: invoiceType, punto_venta: puntoVenta });
      }

      case "create": {
        // Create and authorize a new invoice
        if (!body.order_id || !body.total) {
          return jsonResponse({ error: "order_id and total are required" }, 400);
        }

        const invoiceType = body.invoice_type || INVOICE_TYPES.FACTURA_C;
        const lastNum = await getLastInvoiceNumber(env, cuit, puntoVenta, invoiceType);
        const newNum = lastNum + 1;

        const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const docTipo = body.doc_tipo || 99; // 99 = Consumidor Final (sin documento)
        const docNro = body.doc_nro || "0";

        // Build SOAP request for FECAESolicitar
        const soapBody = buildFECAESolicitar({
          cuit,
          puntoVenta,
          invoiceType,
          invoiceNum: newNum,
          date: today,
          total: body.total,
          docTipo,
          docNro,
          concept: 1, // 1 = Productos
        });

        // Call AFIP WSFE
        const wsfeUrl = AFIP_URLS[env].wsfe;
        const token = await getAuthToken(env, cuit);

        const afipResp = await fetch(wsfeUrl, {
          method: "POST",
          headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: "http://ar.gov.afip.dif.FEV1/FECAESolicitar" },
          body: soapBody.replace("{{TOKEN}}", token.token).replace("{{SIGN}}", token.sign),
        });

        const afipXml = await afipResp.text();
        const cae = extractFromXml(afipXml, "CAE");
        const caeFchVto = extractFromXml(afipXml, "CAEFchVto");
        const resultado = extractFromXml(afipXml, "Resultado");

        if (resultado !== "A") {
          const obs = extractFromXml(afipXml, "Msg") || extractFromXml(afipXml, "Obs");
          return jsonResponse({ error: "AFIP rejected invoice", details: obs, xml: afipXml }, 400);
        }

        // Save invoice to database
        const { error: dbErr } = await supabase.from("invoices").insert({
          order_id: body.order_id,
          invoice_type: invoiceType,
          punto_venta: puntoVenta,
          invoice_number: newNum,
          cae,
          cae_expiry: caeFchVto,
          total: body.total,
          doc_tipo: docTipo,
          doc_nro: docNro,
          items: body.items || [],
          status: "authorized",
          created_at: new Date().toISOString(),
        });

        if (dbErr) console.error("DB insert error:", dbErr);

        return jsonResponse({
          ok: true,
          invoice_number: newNum,
          punto_venta: puntoVenta,
          cae,
          cae_expiry: caeFchVto,
          invoice_type: invoiceType,
        });
      }

      case "consult": {
        // Look up an existing invoice
        if (!body.order_id) return jsonResponse({ error: "order_id required" }, 400);
        const { data } = await supabase.from("invoices").select("*").eq("order_id", body.order_id).single();
        return jsonResponse({ ok: true, invoice: data });
      }

      default:
        return jsonResponse({ error: "Invalid action" }, 400);
    }
  } catch (err) {
    console.error("afip-invoice error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

// ─── Helper functions ────────────────────────────────────────────────

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getAuthToken(_env: string, _cuit: string) {
  // TODO: Implement WSAA authentication with certificate signing (CMS/PKCS#7)
  // For now return placeholder — in production, this signs a LoginTicketRequest
  // with the AFIP certificate and exchanges it for a token+sign pair.
  // The token is cached for ~12 hours.
  return { token: "PLACEHOLDER_TOKEN", sign: "PLACEHOLDER_SIGN" };
}

async function getLastInvoiceNumber(env: string, cuit: string, puntoVenta: number, invoiceType: number) {
  // TODO: Call FECompUltimoAutorizado SOAP method
  // For now return 0 (testing mode)
  return 0;
}

function buildFECAESolicitar(params: {
  cuit: string; puntoVenta: number; invoiceType: number;
  invoiceNum: number; date: string; total: number;
  docTipo: number; docNro: string; concept: number;
}) {
  // SOAP envelope for FECAESolicitar
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/">
  <soap:Body>
    <ar:FECAESolicitar>
      <ar:Auth>
        <ar:Token>{{TOKEN}}</ar:Token>
        <ar:Sign>{{SIGN}}</ar:Sign>
        <ar:Cuit>${params.cuit}</ar:Cuit>
      </ar:Auth>
      <ar:FeCAEReq>
        <ar:FeCabReq>
          <ar:CantReg>1</ar:CantReg>
          <ar:PtoVta>${params.puntoVenta}</ar:PtoVta>
          <ar:CbteTipo>${params.invoiceType}</ar:CbteTipo>
        </ar:FeCabReq>
        <ar:FeDetReq>
          <ar:FECAEDetRequest>
            <ar:Concepto>${params.concept}</ar:Concepto>
            <ar:DocTipo>${params.docTipo}</ar:DocTipo>
            <ar:DocNro>${params.docNro}</ar:DocNro>
            <ar:CbteDesde>${params.invoiceNum}</ar:CbteDesde>
            <ar:CbteHasta>${params.invoiceNum}</ar:CbteHasta>
            <ar:CbteFch>${params.date}</ar:CbteFch>
            <ar:ImpTotal>${params.total.toFixed(2)}</ar:ImpTotal>
            <ar:ImpTotConc>0.00</ar:ImpTotConc>
            <ar:ImpNeto>${params.total.toFixed(2)}</ar:ImpNeto>
            <ar:ImpOpEx>0.00</ar:ImpOpEx>
            <ar:ImpIVA>0.00</ar:ImpIVA>
            <ar:ImpTrib>0.00</ar:ImpTrib>
            <ar:MonId>PES</ar:MonId>
            <ar:MonCotiz>1</ar:MonCotiz>
          </ar:FECAEDetRequest>
        </ar:FeDetReq>
      </ar:FeCAEReq>
    </ar:FECAESolicitar>
  </soap:Body>
</soap:Envelope>`;
}

function extractFromXml(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`));
  return match ? match[1] : "";
}
