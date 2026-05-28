// supabase/functions/mp-oauth-callback/index.ts
// Recibe el OAuth callback de MercadoPago cuando el admin autoriza la conexión.
//
// Flow:
//   1. Admin clickea "Conectar MercadoPago" en Settings → Pasarelas
//   2. Frontend redirige a: https://auth.mercadopago.com.ar/authorization?...
//   3. MP redirige de vuelta a: <app>/mp-callback?code=XXX&state=YYY
//   4. Frontend (pequeño componente MpCallback) hace POST a ESTA función con el code
//   5. ESTA función:
//      - Intercambia code → access_token con MP API
//      - Guarda en payment_integrations
//      - Devuelve éxito al frontend
//   6. Frontend redirige al admin a Settings → Pasarelas con badge "Conectado ✓"
//
// Env vars necesarias:
//   - MP_CLIENT_ID         (App ID de la app MP)
//   - MP_CLIENT_SECRET     (Client Secret de la app MP)
//   - SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY (escribir a payment_integrations sin RLS)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
    const { code, redirect_uri } = await req.json();
    if (!code || !redirect_uri) {
      return new Response(JSON.stringify({ error: 'Missing code or redirect_uri' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const clientId = Deno.env.get('MP_CLIENT_ID');
    const clientSecret = Deno.env.get('MP_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      return new Response(JSON.stringify({ error: 'MP credentials not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Intercambiar code por access_token + refresh_token
    const tokenRes = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri,
      }),
    });

    if (!tokenRes.ok) {
      const errorBody = await tokenRes.text();
      console.error('MP token exchange failed:', tokenRes.status, errorBody);
      return new Response(JSON.stringify({ error: 'Token exchange failed', detail: errorBody }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tokenData = await tokenRes.json();
    // Response fields: access_token, refresh_token, user_id, scope, expires_in, public_key, live_mode, ...

    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 15552000) * 1000).toISOString();

    // 2. Persistir en payment_integrations. Hacemos "soft replace": desactivamos
    //    cualquier integración MP previa, después insertamos la nueva.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Desactivar previas
    await supabase
      .from('payment_integrations')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('provider', 'mercadopago')
      .eq('is_active', true);

    // Insertar nueva activa
    const { data: inserted, error: insertErr } = await supabase
      .from('payment_integrations')
      .insert({
        provider: 'mercadopago',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        external_user_id: String(tokenData.user_id || ''),
        scopes: (tokenData.scope || '').split(' ').filter(Boolean),
        public_key: tokenData.public_key || null,
        expires_at: expiresAt,
        is_active: true,
        metadata: {
          live_mode: tokenData.live_mode,
          token_type: tokenData.token_type,
        },
      })
      .select('id, provider, external_user_id, public_key, connected_at')
      .single();

    if (insertErr) {
      console.error('payment_integrations insert error:', insertErr);
      return new Response(JSON.stringify({ error: 'DB insert failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      integration: inserted,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('mp-oauth-callback error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
