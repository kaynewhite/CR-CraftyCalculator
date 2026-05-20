-- Crafty Rachel Database Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  email         TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  password_hash TEXT,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'superadmin')),
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'rejected')),
  rejection_feedback TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add password_hash column if upgrading from old schema
DO $$ BEGIN
  ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Subscription plans (static reference)
CREATE TABLE IF NOT EXISTS subscription_plans (
  id            TEXT PRIMARY KEY,
  name          TEXT UNIQUE NOT NULL CHECK (name IN ('free', 'basic', 'pro')),
  display_name  TEXT NOT NULL,
  price         NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_calculations INT NOT NULL DEFAULT 3,
  calc_expiry_days INT NOT NULL DEFAULT 30,
  max_materials INT NOT NULL DEFAULT 10,
  features      JSONB NOT NULL DEFAULT '[]',
  limitations   JSONB NOT NULL DEFAULT '[]'
);

INSERT INTO subscription_plans (id, name, display_name, price, max_calculations, calc_expiry_days, max_materials, features, limitations)
VALUES
  ('plan_free',  'free',  'Free Plan',  0,   3,  30, 10,
   '["Up to 3 calculations per month","Basic material tracking","Saved calculations cap of 3 (expires after 30 days)","Simple profit calculator","Email support"]',
   '["Limited to 10 materials in inventory","Cannot create custom categories","No advanced reports","Basic features only"]'),
  ('plan_basic', 'basic', 'Basic Plan', 100, 10, 60, 50,
   '["Unlimited calculations","Advanced material management","Saved calculations cap of 10 (expires after 60 days)","Full saved calculations","Priority email support","Up to 50 materials in inventory"]',
   '["Cannot create custom categories","No advanced analytics"]'),
  ('plan_pro',   'pro',   'Pro Plan',   250, -1, 0,  -1,
   '["Everything in Basic","Unlimited materials in inventory","Advanced analytics and reports","Custom categories","Priority support (24/7)"]',
   '[]')
ON CONFLICT (name) DO NOTHING;

-- User subscriptions
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan          TEXT NOT NULL DEFAULT 'free' REFERENCES subscription_plans(name),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  start_date    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expiry_date   TIMESTAMPTZ,
  duration_months INT DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Materials inventory
CREATE TABLE IF NOT EXISTS materials (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  quantity      NUMERIC(12,4) NOT NULL DEFAULT 0,
  cost_per_unit NUMERIC(12,4) NOT NULL DEFAULT 0,
  unit          TEXT NOT NULL DEFAULT 'piece' CHECK (unit IN ('piece','pack','roll','sheet','ream','meter')),
  category      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Calculations (saved pricings)
CREATE TABLE IF NOT EXISTS calculations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  category      TEXT NOT NULL,
  materials     JSONB NOT NULL DEFAULT '[]',
  total_cost    NUMERIC(12,4) NOT NULL DEFAULT 0,
  suggested_price NUMERIC(12,4) NOT NULL DEFAULT 0,
  profit_margin NUMERIC(8,4) NOT NULL DEFAULT 0,
  profit_amount NUMERIC(12,4) NOT NULL DEFAULT 0,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payment requests (GCash / Maya proof uploads)
CREATE TABLE IF NOT EXISTS payment_requests (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan          TEXT NOT NULL CHECK (plan IN ('basic', 'pro')),
  method        TEXT NOT NULL CHECK (method IN ('gcash', 'maya')),
  screenshot_url TEXT,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','scanning','approved','rejected')),
  feedback      TEXT,
  approved_by   TEXT,
  approved_at   TIMESTAMPTZ,
  rejected_by   TEXT,
  rejected_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Subscription logs
CREATE TABLE IF NOT EXISTS subscription_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action        TEXT NOT NULL CHECK (action IN ('approved','rejected','upgraded','downgraded','cancelled')),
  plan          TEXT NOT NULL,
  cost          NUMERIC(10,2) NOT NULL DEFAULT 0,
  approved_by   TEXT,
  feedback      TEXT,
  details       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- System logs
CREATE TABLE IF NOT EXISTS system_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type          TEXT NOT NULL CHECK (type IN ('approval','rejection','error','system','maintenance')),
  message       TEXT NOT NULL,
  user_id       TEXT,
  admin_id      TEXT,
  details       JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payment QR codes (admin-managed)
CREATE TABLE IF NOT EXISTS payment_qr_codes (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  method        TEXT UNIQUE NOT NULL CHECK (method IN ('gcash', 'maya')),
  qr_url        TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO payment_qr_codes (method) VALUES ('gcash'), ('maya')
ON CONFLICT (method) DO NOTHING;

-- Password reset tokens (admin-mediated flow)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  token         TEXT NOT NULL UNIQUE,
  used          BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_materials_user        ON materials(user_id);
CREATE INDEX IF NOT EXISTS idx_calculations_user     ON calculations(user_id);
CREATE INDEX IF NOT EXISTS idx_calcs_created         ON calculations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_requests_user ON payment_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_sub_logs_user         ON subscription_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_sys_logs_type         ON system_logs(type);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_token    ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_user     ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email           ON users(email);

-- Manual Payment & Subscription Requests
CREATE TABLE IF NOT EXISTS subscription_requests (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL CHECK (plan_name IN ('basic', 'pro')),
  screenshot_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);