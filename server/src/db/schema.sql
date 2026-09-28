-- ============================================================
-- Obscural — Supabase Database Schema
-- Run this in Supabase SQL Editor to initialize all tables.
-- ============================================================

-- ── Helper: auto-update updated_at ──
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT UNIQUE NOT NULL,           -- wallet address (0x...)
  name          TEXT DEFAULT '',
  email         TEXT DEFAULT '',
  avatar_url    TEXT DEFAULT '',
  location      TEXT DEFAULT '',
  company       TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);

CREATE TRIGGER trg_profiles_updated
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 2. INVOICES
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  on_chain_id   BIGINT,                         -- InvoiceFactory tokenId
  title         TEXT DEFAULT '',
  description   TEXT DEFAULT '',
  creator_id    TEXT NOT NULL,                   -- wallet address
  recipient_id  TEXT DEFAULT '',
  amount        NUMERIC(18, 6) DEFAULT 0,
  currency      TEXT DEFAULT 'USD',
  status        TEXT DEFAULT 'draft',            -- draft | sent | paid | overdue | cancelled | disputed
  due_date      TIMESTAMPTZ,
  items         JSONB DEFAULT '[]'::jsonb,       -- [{description, quantity, price}]
  tax_percent   NUMERIC(5, 2) DEFAULT 0,
  subtotal      NUMERIC(18, 6) DEFAULT 0,
  tax_amount    NUMERIC(18, 6) DEFAULT 0,
  total         NUMERIC(18, 6) DEFAULT 0,
  note          TEXT DEFAULT '',
  from_data     JSONB DEFAULT '{}'::jsonb,       -- {name, email, address, walletAddress}
  to_data       JSONB DEFAULT '{}'::jsonb,       -- {name, email, address, walletAddress}
  tx_hash       TEXT,                            -- on-chain tx hash
  data_hash     TEXT,                            -- keccak256 of off-chain data
  escrow_status TEXT,                            -- deposited | released | refunded | disputed
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_creator ON invoices(creator_id);
CREATE INDEX IF NOT EXISTS idx_invoices_recipient ON invoices(recipient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);

CREATE TRIGGER trg_invoices_updated
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 3. CONTACTS
-- ============================================================
CREATE TABLE IF NOT EXISTS contacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      TEXT NOT NULL,                   -- who owns this contact
  name          TEXT NOT NULL DEFAULT '',
  email         TEXT DEFAULT '',
  wallet_address TEXT DEFAULT '',
  home_address  TEXT DEFAULT '',
  company       TEXT DEFAULT '',
  notes         TEXT DEFAULT '',
  avatar_url    TEXT DEFAULT '',
  is_favorite   BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_owner ON contacts(owner_id);

CREATE TRIGGER trg_contacts_updated
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 4. NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL,
  type          TEXT DEFAULT 'info',             -- info | warning | success | error
  icon          TEXT DEFAULT '🔔',
  title         TEXT NOT NULL,
  description   TEXT DEFAULT '',
  link          TEXT DEFAULT '',
  is_read       BOOLEAN DEFAULT FALSE,
  metadata      JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- ============================================================
-- 5. TRUST OVERRIDES (Autopilot)
-- ============================================================
CREATE TABLE IF NOT EXISTS trust_overrides (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      TEXT NOT NULL,
  address       TEXT NOT NULL,                   -- counterparty wallet
  manual_score  INTEGER DEFAULT 0,
  reason        TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_id, address)
);

CREATE INDEX IF NOT EXISTS idx_trust_owner ON trust_overrides(owner_id);

CREATE TRIGGER trg_trust_updated
  BEFORE UPDATE ON trust_overrides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 6. AGENT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_type    TEXT NOT NULL,                   -- router | invoiceCreator | analyst | splitter | autopilot | reminder
  action        TEXT DEFAULT '',
  input         JSONB DEFAULT '{}'::jsonb,
  output        JSONB DEFAULT '{}'::jsonb,
  user_id       TEXT,
  duration_ms   INTEGER,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_logs_type ON agent_logs(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_logs_user ON agent_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_created ON agent_logs(created_at DESC);

-- ============================================================
-- 7. TRANSACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL,
  invoice_id    UUID REFERENCES invoices(id) ON DELETE SET NULL,
  type          TEXT DEFAULT 'outbound',         -- inbound | outbound
  category      TEXT DEFAULT 'invoice_payment',  -- invoice_payment | escrow_deposit | escrow_release | escrow_refund | bill_split_pay | bill_split_receive
  from_address  TEXT DEFAULT '',
  to_address    TEXT DEFAULT '',
  amount        NUMERIC(18, 6) DEFAULT 0,
  currency      TEXT DEFAULT 'ETH',
  tx_hash       TEXT UNIQUE,
  status        TEXT DEFAULT 'pending',          -- pending | confirmed | failed
  block_number  BIGINT,
  gas_used      BIGINT,
  metadata      JSONB DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_tx_hash ON transactions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_tx_invoice ON transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_tx_created ON transactions(created_at DESC);

-- ============================================================
-- Row Level Security (RLS)
-- Enable RLS on all tables. Policies use service_role key
-- from the backend, so we allow full access for service_role.
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Service role bypass (backend uses service_role key)
CREATE POLICY "Service role full access" ON profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON trust_overrides FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON agent_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON transactions FOR ALL USING (true) WITH CHECK (true);
