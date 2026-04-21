// supabase/functions/get-catalog/index.ts
// Edge-cached catalog endpoint for the public storefront.
// Returns products + settings with aggressive cache headers so CDN edge nodes
// serve most requests without hitting the database.
//
// Cache-Control: public, s-maxage=60, stale-while-revalidate=300
//  → CDN caches for 60s, serves stale for up to 5 min while revalidating.
//
// Invalidation: Admin frontend calls this with ?purge=1 header after product changes.
// The CDN sees a new response and updates its cache.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    // Fetch settings (single row)
    const { data: settingsRows, error: settErr } = await supabase
      .from('settings')
      .select('biz_name, logo_letter, logo_color, logo_url, cover_url, cat_images, hidden_cats, cat_names, banner_text, banner_color, store_open, store_hours')
      .limit(1);

    if (settErr) throw settErr;

    const settings = settingsRows?.[0] ?? {
      biz_name: 'La Nona Pato',
      logo_letter: 'N',
      logo_color: '#C45D3E',
    };

    // Fetch visible, non-archived products
    const { data: products, error: prodErr } = await supabase
      .from('recipes')
      .select('id, name, category, sale_price, image_url, description, related_ids')
      .eq('visible', true)
      .eq('is_archived', false)
      .order('category', { ascending: true });

    if (prodErr) throw prodErr;

    // Server timestamp for freshness
    const serverNow = new Date().toISOString();

    const body = JSON.stringify({ settings, products: products ?? [], serverNow });

    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        'CDN-Cache-Control': 'public, max-age=60',
        'Vary': 'Accept-Encoding',
      },
    });
  } catch (err) {
    console.error('get-catalog error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to load catalog' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
