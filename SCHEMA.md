# Hermes Gastro — Database Schema

**Source of truth:** [`supabase/migrations/000_initial_schema.sql`](./supabase/migrations/000_initial_schema.sql)

A new Supabase project becomes a Hermes-ready client by running that single script. It is idempotent (safe to re-run) and includes tables, indexes, RLS, policies, functions, views, triggers, storage buckets, realtime publication and minimal seed data — **no client-specific values**.

Schema is organized below by **domain**, not by table order.

---

## 1. Orders & Fulfillment

The order pipeline — from customer submit to admin completion. Owned end-to-end by the catalog (write) and admin (transition).

### `orders`
The canonical order row. One per checkout.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `uuid_generate_v4()` |
| `created_at` | timestamptz | server-assigned |
| `date` | date | bucketing for daily reports |
| `status` | text | `'new' \| 'preparing' \| 'active' \| 'completed' \| 'cancelled'` — see `OrderStatus` in `src/lib/utils.jsx` |
| `customer`, `phone`, `email` | text | submitted by user |
| `total`, `discount` | numeric | computed server-side in `submit-order` edge function |
| `delivery` | text | `'retiro' \| 'envio'` |
| `payment` | text | `'efectivo' \| 'transferencia' \| 'mercadopago'` |
| `is_gift`, `gift_note` | bool, text | gift-mode metadata |
| `coupon_id` | uuid FK → coupons | applied coupon if any |
| `delivery_date` | date | scheduled orders |
| `receipt_url`, `receipt_verified` | text, bool | for transfer/mercadopago payments |
| `tracking_token` | uuid | `gen_random_uuid()` — anon order tracking link |
| `user_id` | uuid FK → auth.users | nullable (guest orders) |

**RLS:**
- `orders_admin_all` — full CRUD for any authenticated user
- `orders_public_insert` — anyone can INSERT (validated server-side by `submit-order`)
- `orders_user_read_own` — authenticated users see only their own (filtered by `user_id`)
- **Anon order tracking** uses `get_order_tracker(uuid)` RPC, NOT direct SELECT

### `order_items`
Line items of each order — recipe + qty + price snapshot.

### `coupons`
Promo codes. Unique `code`, `discount_pct`, optional `email` lock, single-use (`used` flag flips on apply). `expires_at` enforced by `submit-order`.

### `sales`
Append-only ledger written when an order moves to `completed`. Each row is one recipe sold (qty, unit_price, unit_cost, total). Used by Finance reports.

### RPC — `get_order_tracker(p_order_id uuid)`
`SECURITY DEFINER`, executable by anon. Returns the order plus its items joined to recipe names, formatted for the public `/order/:id` tracking page. **This is how anon users see their order without breaking RLS on `orders` and `order_items`.**

---

## 2. Catalog & Inventory

What the storefront shows and the kitchen produces from.

### `recipes`
A sellable product (or a combo). `is_combo=true` means the row is a bundle of other recipes via `combo_items`. `is_archived` hides historical recipes from new orders without deleting financial history.

**RLS:** public can SELECT (the catalog is public); authenticated admins can write.

### `recipe_ingredients`
M:N — which ingredients (and how much) a recipe uses. Composite PK `(recipe_id, ingredient_id)`.

### `combo_items`
For `recipe.is_combo=true`: which other recipes the combo bundles. Stock is deducted recursively.

### `ingredients`
Raw materials. Has `stock`, `min_stock`, `category`. Stock is decremented by `adjust_stock(uuid, numeric)` RPC when admin moves an order from `new` → `preparing`.

### `category_groups`
Catalog navigation. Defines parent categories (`name`, `icon`) with child `subcategories[]`. Used to render the storefront category bar.

### `purchases` + `purchase_items`
Inventory inflows from suppliers. Admin records supplier purchase; `purchase_items` increments ingredient stock.

### `waste_log`
Inventory outflows from spoilage / cancellation. Used by the Mermas screen.

### RPC — `adjust_stock(p_ingredient_id uuid, p_delta numeric)`
`SECURITY DEFINER`. `delta` is signed (+ buy / − consume). Floors at zero. Used by `useOrderWorkflow.moveOrder` on the `new → preparing` transition.

---

## 3. Finance & Reporting

### `expenses`
Outgoing money beyond ingredient purchases. `expense_type` is `'variable'` or `'fixed'`. Categories defined per-client in `settings.exp_cats`.

### Views

#### `order_tracker_view`
Joins `orders` with aggregated `order_items` (as `items jsonb`). Used internally by `get_order_tracker`. Customer name is reduced to first-name only.

#### `customer_masked_view`
PII-scrubbed view of `customers`. Phone shown as `***1234`, email as `r***@domain.com`. Used by exports / reports that shouldn't leak full contact data.

---

## 4. Customers & Auth

### `auth.users` (managed by Supabase)
Source of truth for user identity. A trigger (`on_auth_user_created`) fires on INSERT and populates `public.profiles`.

### `profiles`
Mirror of `auth.users` for app-side fields (name, phone, default_address_id). Self-scoped RLS: a user only sees their own profile.

### `addresses`
Saved delivery addresses per user. Self-scoped.

### `favorites`
Per-user list of recipe_ids saved as favorites. Self-scoped.

### `customers`
Anonymous/aggregated customer dimension (used in CRM screen) keyed by `email`. Auto-upserted by `submit-order` based on submitted email.

### Trigger — `on_auth_user_created`
Calls `handle_new_user()` after INSERT on `auth.users`. Inserts the matching profile row with name + phone from `raw_user_meta_data`.

---

## 5. Platform & Operations

### `settings` (single row, id=1)
Per-client tenant config. The single most important table. Includes:

| Group | Fields |
|---|---|
| **Identity** | `biz_name`, `logo_letter`, `logo_color`, `logo_url`, `cover_url`, `banner_text`, `banner_color` |
| **Hours** | `store_open` (bool), `store_hours` (jsonb week schedule) |
| **Categories** | `cat_images`, `hidden_cats`, `cat_names`, `exp_cats`, `ing_cats` |
| **Multi-tenant config** (read by edge functions) | `store_name`, `app_url`, `daily_deals` (jsonb day → categories), `cat_groups` (jsonb parent → subs), `deal_pct` |
| **Operations** | `waste_pct` (avg spoilage 0-100) |

**RLS:** public can SELECT (catalog needs it); authenticated admin can update.

### `feature_flags`
Key/value boolean flags read by `src/services/featureFlags.js`. Lets the admin disable WhatsApp links, reviews, loyalty etc. without code changes. 12 flags seeded by default.

### `theme_config`
Reserved for an in-DB theme builder. Default row created on initial seed. Currently not wired to the catalog (which reads from `clients/<CLIENT>/business.js`) but is the table the future Hermes Dashboard theme editor will write to.

### `rate_limits`
Token-bucket-ish table managed by `check_rate_limit(key, max, window_seconds)` RPC. Used by `submit-order` (10 orders/min per IP) and `notify-whatsapp` (30 messages/min per admin user). Old rows are cleaned by `cleanup_rate_limits()`.

### `admin_audit_log`
Append-only audit trail. Currently written by the `admin-reset` edge function. Designed to grow as we add destructive admin actions (mass delete, schema edits, etc.).

### RPCs
- `get_server_time()` — server-authoritative `now()`. Used by the catalog to avoid client clock drift on time-based features (store hours, scheduled orders).
- `check_rate_limit(text, integer, integer)` — token bucket check. Returns `false` if exceeded.
- `cleanup_rate_limits()` — drops rows older than 10 minutes. Can be called from cron.

---

## 6. Storage Buckets

| Bucket | Public | Used by |
|---|---|---|
| `recipe-images` | ✅ | Admin uploads product photos; storefront reads via public URL |
| `backups` | ❌ | Periodic CSV/JSON snapshots (customers, sales). Anon can upload (for offline-first scenarios) but not read. |
| `receipts` | ✅ | Customer-uploaded payment proofs for `transferencia` / `mercadopago`. Public so admin can preview and the customer can re-open the link. |

---

## 7. Realtime

`supabase_realtime` publication includes these tables so `useRealtimeInvalidation` receives change events and refreshes the admin UI:

```
orders, order_items, recipes, ingredients, recipe_ingredients,
sales, expenses, purchases, waste_log, coupons, settings
```

When any of these changes, the matching TanStack Query cache key is invalidated client-side and the next refetch pulls the latest. Without this publication the admin only updates via polling (5s fallback).

---

## 8. Performance Indexes

Defined in section 3 of the SQL. Optimized for the hottest admin queries:
- Order lists by status/date and creation time
- Sales/expenses/purchases/waste_log by date
- Order items by recipe (analytics)
- Coupons by `(code, used)` for fast lookup during checkout

---

## How to onboard a new client

1. Create a new Supabase project (any region — `sa-east-1` for ARG clients).
2. Open SQL Editor → paste the entire contents of `supabase/migrations/000_initial_schema.sql` → Run. Takes ~5 seconds.
3. Verify: `SELECT count(*) FROM information_schema.tables WHERE table_schema='public';` should be **22**.
4. Update `settings` row with the client's `store_name`, `app_url`, `cat_groups`, `daily_deals` (if any).
5. Deploy the 5 edge functions from a sibling project: `supabase functions deploy submit-order validate-coupon admin-reset notify-whatsapp notify-new-customer --project-ref <new-project-ref>`.
6. Run `npm run create-client` from the repo root to generate `clients/<slug>/business.js` and `.env.<slug>`.
7. Create a new Vercel project pointing at this repo with env vars `CLIENT=<slug>`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

That's it. The client should not inherit any data from previous clients.
