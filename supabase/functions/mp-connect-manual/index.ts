// supabase/functions/mp-connect-manual/index.ts
// Conecta MercadoPago de forma manual: el admin pega su Access Token productivo
// (sin OAuth flow). Esto es necesario porque MP no permite OAuth para apps de
// tipo "Integración propia" (que es lo que crea el wizard nuevo de MP por
// default). Es el patrón que usan Tienda Nube, Wapi y otras plataformas LATAM.
//
// Flow:
//   1. Admin entra a su panel MP → Credenciales productivas → copia Access Token
//   2. Pega el token en Hermes → Settings → Pasarelas → "Conectar manualmente"
//   3. ESTA función:
//      - Valida el token llamando a GET /users/me en MP
//      - Si OK, guarda en payment_integrations con access_token + external_user_id
//      - Devuelve éxito + datos de la cuenta MP (id, nickname, email)
//   4. Frontend muestra "✓ Conectado a la cuenta XXX"
//
// Body: { access_token: string, public_key?: string }
//
// Env vars:
//   - SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY (para escribir a payment_integrations sin RLS)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { access_token, public_key } = await req.json();
    if (!access_token || typeof access_token !== 'string') {
      return new Response(JSON.stringify({ error: 'access_token requerido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Validar token llamando a /users/me de MP
    const meRes = await fetch('https://api.mercadopago.com/users/me', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${access_token}` },
    });

    if (!meRes.ok) {
      const errBody = await meRes.text();
      console.error('MP users/me failed:', meRes.status, errBody);
      // Status code más amigable según error
      if (meRes.status === 401) {
        return new Response(JSON.stringify({
          error: 'Token inválido o expirado. Verificá que copiaste el Access Token correcto desde Credenciales productivas.',
        }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({
        error: 'No se pudo validar el token con MercadoPago',
        detail: errBody,
      }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const mpUser = await meRes.json();
    // Fields: id, nickname, email, first_name, last_name, country_id, site_id, status...

    // Detectar live_mode: tokens TEST empiezan con TEST-..., tokens prod APP_USR-...
    const liveMode = !access_token.startsWith('TEST-');

    // 2. Persistir en payment_integrations. Soft-replace: desactivamos previas activas.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    await supabase
      .from('payment_integrations')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('provider', 'mercadopago')
      .eq('is_active', true);

    const { data: inserted, error: insertErr } = await supabase
      .from('payment_integrations')
      .insert({
        provider: 'mercadopago',
        access_token,
        refresh_token: null,                       // No hay refresh en flujo manual
        external_user_id: String(mpUser.id || ''),
        scopes: [],
        public_key: public_key || null,
        expires_at: null,                          // Tokens manuales no expiran (hasta que el admin los rote)
        is_active: true,
        metadata: {
          live_mode: liveMode,
          connection_type: 'manual',               // distingue de 'oauth'
          mp_nickname: mpUser.nickname || null,
          mp_email: mpUser.email || null,
          mp_country: mpUser.country_id || null,
          mp_site_id: mpUser.site_id || null,
        },
      })
      .select('id, provider, external_user_id, public_key, connected_at, metadata')
      .single();

    if (insertErr) {
      console.error('payment_integrations insert error:', insertErr);
      return new Response(JSON.stringify({ error: 'No se pudo guardar la integración' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      integration: inserted,
      mp_account: {
        id: mpUser.id,
        nickname: mpUser.nickname,
        email: mpUser.email,
        country: mpUser.country_id,
        live_mode: liveMode,
      },
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('mp-connect-manual error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
