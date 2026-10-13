-- CampusConnect Supabase PostgreSQL Schema
-- Run this script in the Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Universities Table
CREATE TABLE IF NOT EXISTS universities (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'India',
  approved_domains JSONB NOT NULL DEFAULT '["lpu.in", "lpu.co.in"]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  logo_url TEXT,
  verification_requirements TEXT NOT NULL DEFAULT 'Institutional email or valid Student ID Card',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_universities_code ON universities(code);
CREATE INDEX IF NOT EXISTS idx_universities_active ON universities(is_active);

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'USER', -- USER, VERIFIED_STUDENT, MODERATOR, ADMIN
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, SUSPENDED, BANNED
  is_age_verified BOOLEAN NOT NULL DEFAULT false,
  date_of_birth TIMESTAMPTZ,
  university_id TEXT REFERENCES universities(id) ON DELETE SET NULL,
  credits INT NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_university_id ON users(university_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- 3. Profiles Table
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  gender TEXT NOT NULL DEFAULT 'PREFER_NOT_TO_SAY',
  avatar_url TEXT,
  bio TEXT,
  course TEXT,
  academic_year TEXT,
  language TEXT NOT NULL DEFAULT 'English',
  interests JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_online BOOLEAN NOT NULL DEFAULT false,
  is_discoverable BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_online ON profiles(is_online);
CREATE INDEX IF NOT EXISTS idx_profiles_discoverable ON profiles(is_discoverable);

-- 4. Student Verifications Table
CREATE TABLE IF NOT EXISTS student_verifications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  university_id TEXT NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  institutional_email TEXT,
  id_card_url TEXT,
  document_type TEXT NOT NULL DEFAULT 'ID_CARD',
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
  rejection_reason TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verifications_user_id ON student_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_verifications_status ON student_verifications(status);

-- 5. Matching Preferences Table
CREATE TABLE IF NOT EXISTS matching_preferences (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  target_university_id TEXT REFERENCES universities(id) ON DELETE SET NULL,
  preferred_partner_gender TEXT NOT NULL DEFAULT 'EVERYONE',
  preferred_language TEXT,
  preferred_course TEXT,
  preferred_year TEXT,
  random_match BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matching_preferences_user_id ON matching_preferences(user_id);

-- 6. Match Queue Table
CREATE TABLE IF NOT EXISTS match_queue (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  university_id TEXT NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  target_university_id TEXT REFERENCES universities(id) ON DELETE SET NULL,
  user_gender TEXT NOT NULL,
  preferred_partner_gender TEXT NOT NULL,
  language TEXT,
  course TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'WAITING' -- WAITING, MATCHED, CANCELLED, EXPIRED
);

CREATE INDEX IF NOT EXISTS idx_match_queue_user_id ON match_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_match_queue_status ON match_queue(status);
CREATE INDEX IF NOT EXISTS idx_match_queue_expires_at ON match_queue(expires_at);

-- 7. Conversations Table
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, ENDED
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  ended_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  end_reason TEXT,
  credit_deducted BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);

-- 8. Conversation Participants Table
CREATE TABLE IF NOT EXISTS conversation_participants (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  has_unread BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_participants_user ON conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_participants_conv ON conversation_participants(conversation_id);

-- 9. Messages Table
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- 10. WebRTC Signals Table
CREATE TABLE IF NOT EXISTS webrtc_signals (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL, -- offer, answer, ice-candidate, end-call, decline-call
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signals_conv_recipient ON webrtc_signals(conversation_id, recipient_id, created_at);

-- 11. Friend Requests Table
CREATE TABLE IF NOT EXISTS friend_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, ACCEPTED, DECLINED, CANCELLED
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(sender_id, receiver_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON friend_requests(sender_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON friend_requests(receiver_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_status ON friend_requests(status);

-- 12. Credit Packages Table
CREATE TABLE IF NOT EXISTS credit_packages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  credits INT NOT NULL,
  price_in_inr NUMERIC(10, 2) NOT NULL,
  description TEXT NOT NULL,
  is_popular BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. Credit Ledger Table
CREATE TABLE IF NOT EXISTS credit_ledgers (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  change INT NOT NULL,
  balance_after INT NOT NULL,
  reason TEXT NOT NULL,
  reference_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_user ON credit_ledgers(user_id);

-- 14. Payment Orders Table
CREATE TABLE IF NOT EXISTS payment_orders (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_id TEXT REFERENCES credit_packages(id) ON DELETE SET NULL,
  razorpay_order_id TEXT UNIQUE NOT NULL,
  amount_in_paise INT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'CREATED', -- CREATED, PAID, FAILED, REFUNDED
  idempotency_key TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 15. Payment Transactions Table
CREATE TABLE IF NOT EXISTS payment_transactions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id TEXT REFERENCES payment_orders(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  razorpay_payment_id TEXT UNIQUE NOT NULL,
  razorpay_signature TEXT,
  amount_in_paise INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SUCCESS',
  raw_response JSONB,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. Blocks Table
CREATE TABLE IF NOT EXISTS blocks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

-- 17. Abuse Reports Table
CREATE TABLE IF NOT EXISTS abuse_reports (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reported_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  details TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  resolution_notes TEXT,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 18. Admin Audit Logs Table
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  admin_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default Seed Data for Universities & Packages
INSERT INTO universities (id, name, code, city, state, country, approved_domains)
VALUES 
  ('uni-lpu-001', 'Lovely Professional University', 'LPU', 'Phagwara', 'Punjab', 'India', '["lpu.in", "lpu.co.in"]'::jsonb),
  ('uni-thapar-002', 'Thapar Institute of Engineering and Technology', 'TIET', 'Patiala', 'Punjab', 'India', '["thapar.edu"]'::jsonb),
  ('uni-cgc-003', 'Chandigarh University', 'CU', 'Mohali', 'Punjab', 'India', '["cumail.in"]'::jsonb),
  ('uni-chitkara-004', 'Chitkara University', 'CHITKARA', 'Rajpura', 'Punjab', 'India', '["chitkara.edu.in"]'::jsonb)
ON CONFLICT (code) DO NOTHING;

INSERT INTO credit_packages (id, name, credits, price_in_inr, description, is_popular)
VALUES 
  ('pkg-starter-001', 'Quick Pass', 10, 9.00, 'Try out campus chat with 10 matches', false),
  ('pkg-popular-002', 'Campus Connect Pro', 50, 29.00, 'Best value for active students', true),
  ('pkg-unlimited-003', 'Semester Unlimited Pass', 200, 99.00, 'Full semester access with priority matching', false)
ON CONFLICT (id) DO NOTHING;
