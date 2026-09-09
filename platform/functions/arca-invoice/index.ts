// Emision fiscal argentina para el edificio Dico.
//
// Usa WSAA + WSFEv1. Las credenciales llegan por ARCA_CREDENTIALS_JSON, un
// secreto server-side con esta forma:
// { "referencia": { "certificate": "PEM o base64", "privateKey": "PEM o base64" } }
// `fiscal_profiles.credential_ref` elige la entrada sin exponer el material.
//
// La cola y el bloqueo viven en Postgres (0067). Si el transporte se corta
// despues de FECAESolicitar, el reintento consulta el numero reservado antes
// de volver a emitir: una respuesta perdida no puede crear otra factura.

// @ts-types="npm:@types/node-forge@1.3.11"
import forge from "npm:node-forge@1.3.1";
import { XMLParser } from "npm:fast-xml-parser@5.2.5";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
};

const URLS = {
  homologation: {
    wsaa: "https://wsaahomo.afip.gov.ar/ws/services/LoginCms",
    wsfe: "https://wswhomo.afip.gov.ar/wsfev1/service.asmx",
  },
  production: {
    wsaa: "https://wsaa.afip.gov.ar/ws/services/LoginCms",
    wsfe: "https://servicios1.afip.gov.ar/wsfev1/service.asmx",
  },
} as const;

type Environment = keyof typeof URLS;
type Credential = { certificate: string; privateKey: string };
type Json = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
});
const authCache = new Map<string, { token: string; sign: string; expiresAt: number }>();

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function escapeXml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function deepFind(input: unknown, key: string): unknown {
  if (!input || typeof input !== "object") return undefined;
  const object = input as Record<string, unknown>;
  if (key in object) return object[key];
  for (const value of Object.values(object)) {
    const found = deepFind(value, key);
    if (found !== undefined) return found;
  }
  return undefined;
}

function asArray(value: unknown): Json[] {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value])
    .filter((item): item is Json => !!item && typeof item === "object");
}

function messages(parsed: unknown, container: string, item: string) {
  return asArray(deepFind(deepFind(parsed, container), item)).map((entry) => ({
    code: String(entry.Code ?? entry.code ?? ""),
    message: String(entry.Msg ?? entry.message ?? ""),
  }));
}

function unwrapPem(value: string) {
  if (value.includes("-----BEGIN")) return value;
  return new TextDecoder().decode(Uint8Array.from(atob(value), (char) => char.charCodeAt(0)));
}

function credentialsFor(reference: string): Credential {
  const raw = Deno.env.get("ARCA_CREDENTIALS_JSON");
  if (!raw) throw new Error("ARCA_CREDENTIALS_JSON no configurado");
  const all = JSON.parse(raw) as Record<string, Credential>;
  const credential = all[reference];
  if (!credential?.certificate || !credential?.privateKey) {
    throw new Error("Credencial ARCA no encontrada");
  }
  return {
    certificate: unwrapPem(credential.certificate),
    privateKey: unwrapPem(credential.privateKey),
  };
}

function isoWithoutMillis(date: Date) {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function buildTra() {
  const now = Date.now();
  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<loginTicketRequest version="1.0"><header>` +
    `<uniqueId>${Math.floor(now / 1000)}</uniqueId>` +
    `<generationTime>${isoWithoutMillis(new Date(now - 10 * 60_000))}</generationTime>` +
    `<expirationTime>${isoWithoutMillis(new Date(now + 10 * 60_000))}</expirationTime>` +
    `</header><service>wsfe</service></loginTicketRequest>`;
}

function signTra(tra: string, credential: Credential) {
  const certificate = forge.pki.certificateFromPem(credential.certificate);
  const privateKey = forge.pki.privateKeyFromPem(credential.privateKey);
  const signed = forge.pkcs7.createSignedData();
  signed.content = forge.util.createBuffer(tra, "utf8");
  signed.addCertificate(certificate);
  signed.addSigner({
    key: privateKey,
    certificate,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      // node-forge recibe Date en runtime; sus tipos historicos lo declaran string.
      { type: forge.pki.oids.signingTime, value: new Date() as unknown as string },
    ],
  });
  signed.sign();
  return forge.util.encode64(forge.asn1.toDer(signed.toAsn1()).getBytes());
}

async function soap(url: string, action: string, body: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: action,
      },
      body,
      signal: controller.signal,
    });
    const xml = await response.text();
    if (!response.ok) throw new Error(`ARCA HTTP ${response.status}`);
    return parser.parse(xml);
  } finally {
    clearTimeout(timeout);
  }
}

async function wsaa(environment: Environment, reference: string) {
  const cacheKey = `${environment}:${reference}`;
  const cached = authCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached;
  const cms = signTra(buildTra(), credentialsFor(reference));
  const envelope = `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">` +
    `<soapenv:Body><loginCms xmlns="http://wsaa.view.sua.dvadac.desein.afip.gov">` +
    `<in0>${cms}</in0></loginCms></soapenv:Body></soapenv:Envelope>`;
  const response = await soap(URLS[environment].wsaa, "", envelope);
  const loginXml = String(deepFind(response, "loginCmsReturn") || "");
  if (!loginXml) throw new Error("WSAA no devolvio credenciales");
  const login = parser.parse(loginXml);
  const token = String(deepFind(login, "token") || "");
  const sign = String(deepFind(login, "sign") || "");
  const expiration = Date.parse(String(deepFind(login, "expirationTime") || ""));
  if (!token || !sign || !Number.isFinite(expiration)) {
    throw new Error("Respuesta WSAA incompleta");
  }
  const result = { token, sign, expiresAt: expiration };
  authCache.set(cacheKey, result);
  return result;
}

function wsfeEnvelope(operation: string, content: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" ` +
    `xmlns:ar="http://ar.gov.afip.dif.FEV1/"><soap:Body>` +
    `<ar:${operation}>${content}</ar:${operation}></soap:Body></soap:Envelope>`;
}

function authXml(auth: { token: string; sign: string }, cuit: string) {
  return `<ar:Auth><ar:Token>${escapeXml(auth.token)}</ar:Token>` +
    `<ar:Sign>${escapeXml(auth.sign)}</ar:Sign><ar:Cuit>${escapeXml(cuit)}</ar:Cuit></ar:Auth>`;
}

async function lastAuthorized(
  environment: Environment,
  auth: { token: string; sign: string },
  cuit: string,
  pointOfSale: number,
  voucherType: number,
) {
  const operation = "FECompUltimoAutorizado";
  const response = await soap(
    URLS[environment].wsfe,
    `http://ar.gov.afip.dif.FEV1/${operation}`,
    wsfeEnvelope(operation, authXml(auth, cuit) +
      `<ar:PtoVta>${pointOfSale}</ar:PtoVta><ar:CbteTipo>${voucherType}</ar:CbteTipo>`),
  );
  const errors = messages(response, "Errors", "Err");
  if (errors.length) throw new Error(`ARCA ${errors[0].code}: ${errors[0].message}`);
  return Number(deepFind(response, "CbteNro") || 0);
}

async function consultVoucher(
  environment: Environment,
  auth: { token: string; sign: string },
  cuit: string,
  document: Json,
) {
  const operation = "FECompConsultar";
  const response = await soap(
    URLS[environment].wsfe,
    `http://ar.gov.afip.dif.FEV1/${operation}`,
    wsfeEnvelope(operation, authXml(auth, cuit) +
      `<ar:FeCompConsReq><ar:CbteTipo>${document.voucher_type}</ar:CbteTipo>` +
      `<ar:CbteNro>${document.voucher_number}</ar:CbteNro>` +
      `<ar:PtoVta>${document.point_of_sale}</ar:PtoVta></ar:FeCompConsReq>`),
  );
  const result = deepFind(response, "ResultGet") as Json | undefined;
  return result ? {
    result: String(result.Resultado || ""),
    cae: String(result.CodAutorizacion || ""),
    expires: String(result.FchVto || ""),
    total: Number(result.ImpTotal || 0),
    observations: messages(result, "Observaciones", "Obs"),
  } : null;
}

function yyyymmdd(value: unknown) {
  return String(value || "").replaceAll("-", "").slice(0, 8);
}

function vatXml(breakdown: unknown) {
  const entries = Array.isArray(breakdown) ? breakdown : [];
  if (!entries.length) return "";
  return `<ar:Iva>${entries.map((entry: Json) =>
    `<ar:AlicIva><ar:Id>${entry.id}</ar:Id>` +
    `<ar:BaseImp>${Number(entry.base_amount).toFixed(2)}</ar:BaseImp>` +
    `<ar:Importe>${Number(entry.amount).toFixed(2)}</ar:Importe></ar:AlicIva>`
  ).join("")}</ar:Iva>`;
}

async function authorize(
  environment: Environment,
  auth: { token: string; sign: string },
  cuit: string,
  document: Json,
) {
  const operation = "FECAESolicitar";
  const detail = `<ar:FECAEDetRequest>` +
    `<ar:Concepto>${document.concept}</ar:Concepto>` +
    `<ar:DocTipo>${document.receiver_doc_type}</ar:DocTipo>` +
    `<ar:DocNro>${escapeXml(document.receiver_doc_number)}</ar:DocNro>` +
    `<ar:CbteDesde>${document.voucher_number}</ar:CbteDesde>` +
    `<ar:CbteHasta>${document.voucher_number}</ar:CbteHasta>` +
    `<ar:CbteFch>${yyyymmdd(document.issue_date)}</ar:CbteFch>` +
    `<ar:ImpTotal>${Number(document.total).toFixed(2)}</ar:ImpTotal>` +
    `<ar:ImpTotConc>${Number(document.non_taxed_amount).toFixed(2)}</ar:ImpTotConc>` +
    `<ar:ImpNeto>${Number(document.net_amount).toFixed(2)}</ar:ImpNeto>` +
    `<ar:ImpOpEx>${Number(document.exempt_amount).toFixed(2)}</ar:ImpOpEx>` +
    `<ar:ImpIVA>${Number(document.vat_amount).toFixed(2)}</ar:ImpIVA>` +
    `<ar:ImpTrib>${Number(document.other_taxes_amount).toFixed(2)}</ar:ImpTrib>` +
    `<ar:MonId>${escapeXml(document.currency)}</ar:MonId>` +
    `<ar:MonCotiz>${Number(document.exchange_rate).toFixed(6)}</ar:MonCotiz>` +
    `<ar:CondicionIVAReceptorId>${document.receiver_vat_condition}</ar:CondicionIVAReceptorId>` +
    vatXml(document.vat_breakdown) + `</ar:FECAEDetRequest>`;
  const request = authXml(auth, cuit) + `<ar:FeCAEReq><ar:FeCabReq>` +
    `<ar:CantReg>1</ar:CantReg><ar:PtoVta>${document.point_of_sale}</ar:PtoVta>` +
    `<ar:CbteTipo>${document.voucher_type}</ar:CbteTipo></ar:FeCabReq>` +
    `<ar:FeDetReq>${detail}</ar:FeDetReq></ar:FeCAEReq>`;
  const response = await soap(
    URLS[environment].wsfe,
    `http://ar.gov.afip.dif.FEV1/${operation}`,
    wsfeEnvelope(operation, request),
  );
  const result = deepFind(response, "FECAEDetResponse") as Json | undefined;
  const errors = messages(response, "Errors", "Err");
  const observations = messages(result, "Observaciones", "Obs");
  return {
    result: String(result?.Resultado || deepFind(response, "Resultado") || ""),
    cae: String(result?.CAE || ""),
    expires: String(result?.CAEFchVto || ""),
    errors,
    observations,
  };
}

function dateFromArca(value: string) {
  if (!/^\d{8}$/.test(value)) return null;
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (request.method !== "POST") return json({ error: "Metodo no permitido" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  let lockedTenant: string | null = null;
  let documentId: string | null = null;
  let attemptId: number | null = null;

  try {
    const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || "";
    const { data: authData } = await admin.auth.getUser(token);
    const user = authData.user;
    if (!user) return json({ error: "No autorizado" }, 401);
    const body = await request.json();
    documentId = String(body.document_id || "");
    if (!documentId) return json({ error: "document_id requerido" }, 400);

    const { data: document, error: documentError } = await admin
      .from("fiscal_documents").select("*").eq("id", documentId).single();
    if (documentError || !document) return json({ error: "Documento fiscal no encontrado" }, 404);
    if (document.status === "authorized") return json({ ok: true, document });

    const { data: memberships } = await admin.from("tenant_members")
      .select("roles, branch_id").eq("tenant_id", document.tenant_id).eq("user_id", user.id);
    const allowed = (memberships || []).some((membership) =>
      (membership.branch_id === null || membership.branch_id === document.branch_id) &&
      membership.roles.some((role: string) => ["owner", "manager", "cashier"].includes(role))
    );
    if (!allowed) return json({ error: "Sin permiso para facturar" }, 403);

    const { data: profile, error: profileError } = await admin.from("fiscal_profiles")
      .select("*").eq("tenant_id", document.tenant_id).eq("enabled", true).single();
    if (profileError || !profile) return json({ error: "Facturacion ARCA no configurada" }, 409);
    const cutoff = new Date(Date.now() - 2 * 60_000).toISOString();
    const { data: claimed } = await admin.from("fiscal_profiles").update({
      processing_document_id: document.id,
      processing_locked_at: new Date().toISOString(),
    }).eq("tenant_id", document.tenant_id)
      .or(`processing_document_id.is.null,processing_locked_at.lt.${cutoff}`)
      .select("tenant_id").maybeSingle();
    if (!claimed) return json({ error: "Hay otra factura procesandose" }, 409);
    lockedTenant = document.tenant_id;

    await admin.from("fiscal_documents").update({
      status: "processing",
      processing_started_at: new Date().toISOString(),
      attempt_count: Number(document.attempt_count || 0) + 1,
      last_error_code: null,
      last_error_message: null,
    }).eq("id", document.id);
    const attempt = await admin.from("fiscal_attempts").insert({
      fiscal_document_id: document.id,
      tenant_id: document.tenant_id,
    }).select("id").single();
    attemptId = attempt.data?.id ?? null;

    const environment = profile.environment as Environment;
    const auth = await wsaa(environment, profile.credential_ref);
    const fiscalDocument = { ...document } as Json;

    if (document.voucher_number) {
      const existing = await consultVoucher(environment, auth, profile.cuit, fiscalDocument);
      if (existing?.result === "A" && Math.abs(existing.total - Number(document.total)) < 0.01) {
        const authorized = {
          status: "authorized",
          arca_result: "A",
          cae: existing.cae,
          cae_expires_on: dateFromArca(existing.expires),
          arca_observations: existing.observations,
          authorized_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await admin.from("fiscal_documents").update(authorized).eq("id", document.id);
        if (attemptId) await admin.from("fiscal_attempts").update({
          outcome: "authorized", finished_at: new Date().toISOString(),
          response_message: "Reconciliada con FECompConsultar",
        }).eq("id", attemptId);
        return json({ ok: true, document: { ...document, ...authorized } });
      }
    } else {
      const last = await lastAuthorized(
        environment, auth, profile.cuit, document.point_of_sale, document.voucher_type,
      );
      fiscalDocument.voucher_number = last + 1;
      const numbered = await admin.from("fiscal_documents").update({
        voucher_number: fiscalDocument.voucher_number,
        updated_at: new Date().toISOString(),
      }).eq("id", document.id).is("voucher_number", null).select("id").maybeSingle();
      if (!numbered.data) throw new Error("No se pudo reservar el numero fiscal");
    }

    const result = await authorize(environment, auth, profile.cuit, fiscalDocument);
    if (result.result !== "A" || !result.cae) {
      const first = result.errors[0] || result.observations[0] || { code: "REJECTED", message: "ARCA rechazo el comprobante" };
      await admin.from("fiscal_documents").update({
        status: "rejected",
        arca_result: result.result || "R",
        arca_observations: result.observations,
        last_error_code: first.code,
        last_error_message: first.message,
        updated_at: new Date().toISOString(),
      }).eq("id", document.id);
      if (attemptId) await admin.from("fiscal_attempts").update({
        outcome: "rejected", finished_at: new Date().toISOString(),
        response_code: first.code, response_message: first.message,
      }).eq("id", attemptId);
      await admin.from("cash_exceptions").insert({
        tenant_id: document.tenant_id,
        branch_id: document.branch_id,
        order_id: document.order_id,
        kind: "fiscal_failure",
        severity: "critical",
        title: "ARCA rechazo una factura",
        description: `${first.code}: ${first.message}`,
        reported_by: user.id,
        context: { fiscal_document_id: document.id },
      });
      return json({ error: first.message, code: first.code }, 422);
    }

    const authorized = {
      status: "authorized",
      arca_result: "A",
      cae: result.cae,
      cae_expires_on: dateFromArca(result.expires),
      arca_observations: result.observations,
      authorized_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await admin.from("fiscal_documents").update(authorized).eq("id", document.id);
    if (attemptId) await admin.from("fiscal_attempts").update({
      outcome: "authorized", finished_at: new Date().toISOString(),
    }).eq("id", attemptId);
    return json({ ok: true, document: { ...document, ...fiscalDocument, ...authorized } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error fiscal interno";
    if (documentId) await admin.from("fiscal_documents").update({
      status: "retry_required",
      last_error_code: "TRANSPORT_OR_INTERNAL",
      last_error_message: message.slice(0, 500),
      updated_at: new Date().toISOString(),
    }).eq("id", documentId).neq("status", "authorized");
    if (attemptId) await admin.from("fiscal_attempts").update({
      outcome: "transport_error",
      finished_at: new Date().toISOString(),
      response_message: message.slice(0, 500),
    }).eq("id", attemptId);
    console.error("arca-invoice:", message);
    return json({ error: "No se pudo completar la emision. Quedo lista para reintentar." }, 502);
  } finally {
    if (lockedTenant && documentId) {
      await admin.from("fiscal_profiles").update({
        processing_document_id: null,
        processing_locked_at: null,
      }).eq("tenant_id", lockedTenant).eq("processing_document_id", documentId);
    }
  }
});
