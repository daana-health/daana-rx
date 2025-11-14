-- DaanaRx Database Schema
-- Execute this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Clinics table
CREATE TABLE IF NOT EXISTS clinics (
  clinic_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  primary_color VARCHAR(7),
  secondary_color VARCHAR(7),
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username VARCHAR(255) UNIQUE NOT NULL,
  clinic_id UUID NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE,
  user_role VARCHAR(50) NOT NULL CHECK (user_role IN ('superadmin', 'admin', 'employee')),
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Locations table
CREATE TABLE IF NOT EXISTS locations (
  location_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  temp VARCHAR(50) NOT NULL CHECK (temp IN ('fridge', 'room temp')),
  clinic_id UUID NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lots table
CREATE TABLE IF NOT EXISTS lots (
  lot_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source VARCHAR(255) NOT NULL,
  note TEXT,
  date_created TIMESTAMPTZ DEFAULT NOW(),
  location_id UUID NOT NULL REFERENCES locations(location_id) ON DELETE RESTRICT,
  clinic_id UUID NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE
);

-- Drugs table (universal drug database)
CREATE TABLE IF NOT EXISTS drugs (
  drug_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  medication_name VARCHAR(255) NOT NULL,
  generic_name VARCHAR(255) NOT NULL,
  strength DECIMAL(10, 4) NOT NULL,
  strength_unit VARCHAR(50) NOT NULL,
  ndc_id VARCHAR(50) UNIQUE NOT NULL,
  form VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for drug search
CREATE INDEX IF NOT EXISTS idx_drugs_ndc ON drugs(ndc_id);
CREATE INDEX IF NOT EXISTS idx_drugs_generic_name ON drugs(generic_name);
CREATE INDEX IF NOT EXISTS idx_drugs_medication_name ON drugs(medication_name);

-- Units table
CREATE TABLE IF NOT EXISTS units (
  unit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  total_quantity INTEGER NOT NULL CHECK (total_quantity >= 0),
  available_quantity INTEGER NOT NULL CHECK (available_quantity >= 0),
  patient_reference_id VARCHAR(255),
  lot_id UUID NOT NULL REFERENCES lots(lot_id) ON DELETE RESTRICT,
  expiry_date DATE NOT NULL,
  date_created TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES users(user_id),
  drug_id UUID NOT NULL REFERENCES drugs(drug_id),
  qr_code TEXT,
  optional_notes TEXT,
  clinic_id UUID NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE,
  CONSTRAINT available_lte_total CHECK (available_quantity <= total_quantity)
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  transaction_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  type VARCHAR(50) NOT NULL CHECK (type IN ('adjust', 'check out', 'check in')),
  quantity INTEGER NOT NULL,
  unit_id UUID NOT NULL REFERENCES units(unit_id) ON DELETE RESTRICT,
  patient_reference_id VARCHAR(255),
  user_id UUID NOT NULL REFERENCES users(user_id),
  notes TEXT,
  clinic_id UUID NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_units_clinic ON units(clinic_id);
CREATE INDEX IF NOT EXISTS idx_units_lot ON units(lot_id);
CREATE INDEX IF NOT EXISTS idx_units_expiry ON units(expiry_date);
CREATE INDEX IF NOT EXISTS idx_transactions_clinic ON transactions(clinic_id);
CREATE INDEX IF NOT EXISTS idx_transactions_unit ON transactions(unit_id);
CREATE INDEX IF NOT EXISTS idx_transactions_timestamp ON transactions(timestamp);
CREATE INDEX IF NOT EXISTS idx_lots_clinic ON lots(clinic_id);
CREATE INDEX IF NOT EXISTS idx_locations_clinic ON locations(clinic_id);
CREATE INDEX IF NOT EXISTS idx_users_clinic ON users(clinic_id);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Clinics: Users can only see their own clinic
CREATE POLICY clinic_isolation ON clinics
  FOR ALL
  USING (clinic_id = (
    SELECT clinic_id FROM users WHERE user_id = auth.uid()
  ));

-- Users: Users can only see users from their clinic
CREATE POLICY user_isolation ON users
  FOR ALL
  USING (clinic_id = (
    SELECT clinic_id FROM users WHERE user_id = auth.uid()
  ));

-- Locations: Users can only see locations from their clinic
CREATE POLICY location_isolation ON locations
  FOR ALL
  USING (clinic_id = (
    SELECT clinic_id FROM users WHERE user_id = auth.uid()
  ));

-- Lots: Users can only see lots from their clinic
CREATE POLICY lot_isolation ON lots
  FOR ALL
  USING (clinic_id = (
    SELECT clinic_id FROM users WHERE user_id = auth.uid()
  ));

-- Units: Users can only see units from their clinic
CREATE POLICY unit_isolation ON units
  FOR ALL
  USING (clinic_id = (
    SELECT clinic_id FROM users WHERE user_id = auth.uid()
  ));

-- Transactions: Users can only see transactions from their clinic
CREATE POLICY transaction_isolation ON transactions
  FOR ALL
  USING (clinic_id = (
    SELECT clinic_id FROM users WHERE user_id = auth.uid()
  ));

-- Drugs table is global, no RLS needed
ALTER TABLE drugs ENABLE ROW LEVEL SECURITY;
CREATE POLICY drugs_read_all ON drugs FOR SELECT USING (true);
CREATE POLICY drugs_insert_authenticated ON drugs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_clinics_updated_at BEFORE UPDATE ON clinics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed some common drugs (optional - can be populated via API)
INSERT INTO drugs (medication_name, generic_name, strength, strength_unit, ndc_id, form) VALUES
  ('Lisinopril 10mg Tablet', 'Lisinopril', 10, 'mg', '0781-1506-01', 'Tablet'),
  ('Metformin 500mg Tablet', 'Metformin', 500, 'mg', '0093-7214-01', 'Tablet'),
  ('Amlodipine 5mg Tablet', 'Amlodipine', 5, 'mg', '0093-7367-01', 'Tablet'),
  ('Atorvastatin 20mg Tablet', 'Atorvastatin', 20, 'mg', '0093-5056-01', 'Tablet'),
  ('Omeprazole 20mg Capsule', 'Omeprazole', 20, 'mg', '0093-5056-56', 'Capsule')
ON CONFLICT (ndc_id) DO NOTHING;

-- Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
