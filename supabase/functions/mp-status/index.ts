// supabase/functions/mp-status/index.ts
// Endpoint público que devuelve si MercadoPago está conectado.
// Lo usa el catálogo (anon key) para decidir si mostrar el flujo
// Checkout Pro vs el flujo manual (alias + comprobante).
//
// NUNCA expone access_token ni refresh_token. Solo campos seguros.
//
// Response: { active: boolean, public_key?: string, mp_nickname?: string, live_mode?: boolean }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data, error } = await supabase
      .from('payment_integrations')
      .select('public_key, metadata, external_user_id')
      .eq('provider', 'mercadopago')
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      console.error('mp-status query error:', error);
      return new Response(JSON.stringify({ active: false }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!data) {
      return new Response(JSON.stringify({ active: false }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      active: true,
      public_key: data.public_key || null,
      mp_nickname: data.metadata?.mp_nickname || null,
      live_mode: data.metadata?.live_mode ?? null,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('mp-status error:', err);
    return new Response(JSON.stringify({ active: false, error: String(err) }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
