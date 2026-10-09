-- =========================================================================
-- Stockwise Management Schema for Supabase (PostgreSQL)
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/hpcgukplcjhlkcbccfji/sql
-- =========================================================================

-- 1. INVENTORY TABLE
CREATE TABLE IF NOT EXISTS public.inventory (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price NUMERIC DEFAULT 0,
  quantity NUMERIC DEFAULT 0,
  upper_office_qty NUMERIC DEFAULT 0,
  down_office_qty NUMERIC DEFAULT 0,
  nagdevi_office_qty NUMERIC DEFAULT 0,
  box_packing TEXT,
  category TEXT,
  order_index NUMERIC DEFAULT 0,
  owner_id TEXT DEFAULT 'system',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for instant search and sorting
CREATE INDEX IF NOT EXISTS idx_inventory_name ON public.inventory(name);
CREATE INDEX IF NOT EXISTS idx_inventory_order_index ON public.inventory(order_index);

-- 2. SALES TABLE
CREATE TABLE IF NOT EXISTS public.sales (
  id TEXT PRIMARY KEY,
  item_id TEXT,
  item_name TEXT NOT NULL,
  customer_name TEXT DEFAULT '',
  company_name TEXT DEFAULT '',
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  location TEXT NOT NULL DEFAULT 'nagdevi',
  notes TEXT,
  owner_id TEXT DEFAULT 'system',
  sold_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_sold_at ON public.sales(sold_at DESC);

-- 3. PURCHASES TABLE
CREATE TABLE IF NOT EXISTS public.purchases (
  id TEXT PRIMARY KEY,
  item_id TEXT,
  item_name TEXT NOT NULL,
  supplier_name TEXT DEFAULT '',
  box_packing TEXT,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  location TEXT NOT NULL DEFAULT 'nagdevi',
  notes TEXT,
  owner_id TEXT DEFAULT 'system',
  purchased_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_purchases_purchased_at ON public.purchases(purchased_at DESC);

-- 4. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  item_id TEXT,
  item_name TEXT NOT NULL,
  action TEXT NOT NULL,
  changes JSONB,
  performed_by TEXT DEFAULT '',
  performed_by_email TEXT DEFAULT '',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);

-- Enable Realtime publication for tables so UI updates automatically
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
ALTER PUBLICATION supabase_realtime ADD TABLE public.purchases;
ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;

