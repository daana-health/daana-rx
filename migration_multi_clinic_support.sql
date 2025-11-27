-- Migration: Multi-Clinic Support with Arrays
-- This migration enables users to belong to multiple clinics using array columns
-- Created: 2025-11-26

-- Step 1: Add array columns to store relationships
ALTER TABLE users ADD COLUMN IF NOT EXISTS clinic_ids UUID[] DEFAULT ARRAY[]::UUID[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS active_clinic_id UUID REFERENCES clinics(clinic_id);

ALTER TABLE clinics ADD COLUMN IF NOT EXISTS user_ids UUID[] DEFAULT ARRAY[]::UUID[];

-- Step 2: Migrate existing data
-- For each user, add their current clinic_id to their clinic_ids array
UPDATE users
SET clinic_ids = ARRAY[clinic_id]
WHERE clinic_id IS NOT NULL AND (clinic_ids IS NULL OR clinic_ids = '{}');

-- Set active_clinic_id to current clinic_id for all users
UPDATE users
SET active_clinic_id = clinic_id
WHERE active_clinic_id IS NULL AND clinic_id IS NOT NULL;

-- For each clinic, collect all user_ids into the user_ids array
UPDATE clinics c
SET user_ids = (
  SELECT ARRAY_AGG(u.user_id)
  FROM users u
  WHERE u.clinic_id = c.clinic_id
)
WHERE user_ids IS NULL OR user_ids = '{}';

-- Step 3: Update RLS policies to support multi-clinic access

-- Drop old user_isolation policy
DROP POLICY IF EXISTS user_isolation ON users;

-- Create new policy for multi-clinic user access
CREATE POLICY user_multi_clinic_isolation ON users
  FOR ALL
  USING (
    -- User can see themselves
    user_id = auth.uid()
    OR
    -- User can see other users in any clinic they belong to
    EXISTS (
      SELECT 1 FROM users u1
      WHERE u1.user_id = auth.uid()
      AND u1.clinic_ids && users.clinic_ids -- Array overlap operator
    )
  );

-- Update clinic isolation policy to show all clinics user belongs to
DROP POLICY IF EXISTS clinic_isolation ON clinics;

CREATE POLICY clinic_multi_access ON clinics
  FOR ALL
  USING (
    clinic_id = ANY(
      SELECT UNNEST(clinic_ids)
      FROM users
      WHERE user_id = auth.uid()
    )
  );

-- Update other table policies to check against user's clinic_ids
-- Locations policy
DROP POLICY IF EXISTS location_isolation ON locations;

CREATE POLICY location_multi_clinic_isolation ON locations
  FOR ALL
  USING (
    clinic_id = ANY(
      SELECT UNNEST(clinic_ids)
      FROM users
      WHERE user_id = auth.uid()
    )
  );

-- Lots policy
DROP POLICY IF EXISTS lot_isolation ON lots;

CREATE POLICY lot_multi_clinic_isolation ON lots
  FOR ALL
  USING (
    clinic_id = ANY(
      SELECT UNNEST(clinic_ids)
      FROM users
      WHERE user_id = auth.uid()
    )
  );

-- Units policy
DROP POLICY IF EXISTS unit_isolation ON units;

CREATE POLICY unit_multi_clinic_isolation ON units
  FOR ALL
  USING (
    clinic_id = ANY(
      SELECT UNNEST(clinic_ids)
      FROM users
      WHERE user_id = auth.uid()
    )
  );

-- Transactions policy
DROP POLICY IF EXISTS transaction_isolation ON transactions;

CREATE POLICY transaction_multi_clinic_isolation ON transactions
  FOR ALL
  USING (
    clinic_id = ANY(
      SELECT UNNEST(clinic_ids)
      FROM users
      WHERE user_id = auth.uid()
    )
  );

-- Step 4: Create invitations table if it doesn't exist
CREATE TABLE IF NOT EXISTS invitations (
  invitation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL,
  clinic_id UUID NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES users(user_id),
  user_role VARCHAR(50) NOT NULL CHECK (user_role IN ('admin', 'employee')),
  status VARCHAR(50) NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'expired')),
  invitation_token UUID DEFAULT uuid_generate_v4() UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ
);

-- Add index for invitations
CREATE INDEX IF NOT EXISTS idx_invitations_clinic ON invitations(clinic_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);

-- Enable RLS on invitations
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Invitations: Users can see invitations for clinics they belong to (admin/superadmin only)
CREATE POLICY invitation_isolation ON invitations
  FOR ALL
  USING (
    clinic_id = ANY(
      SELECT UNNEST(clinic_ids)
      FROM users
      WHERE user_id = auth.uid()
      AND user_role IN ('admin', 'superadmin')
    )
  );

-- Allow anyone to read invitations by token (for accepting invitations)
CREATE POLICY invitation_token_access ON invitations
  FOR SELECT
  USING (true);

-- Step 5: Grant permissions
GRANT ALL ON invitations TO authenticated;

-- Step 6: Create helper functions

-- Function to add user to clinic
CREATE OR REPLACE FUNCTION add_user_to_clinic(
  p_user_id UUID,
  p_clinic_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Add clinic to user's clinic_ids array if not already present
  UPDATE users
  SET clinic_ids = array_append(clinic_ids, p_clinic_id)
  WHERE user_id = p_user_id
  AND NOT (clinic_ids @> ARRAY[p_clinic_id]);

  -- Add user to clinic's user_ids array if not already present
  UPDATE clinics
  SET user_ids = array_append(user_ids, p_user_id)
  WHERE clinic_id = p_clinic_id
  AND NOT (user_ids @> ARRAY[p_user_id]);

  -- If this is the user's first clinic, set it as active
  UPDATE users
  SET active_clinic_id = p_clinic_id
  WHERE user_id = p_user_id
  AND (active_clinic_id IS NULL OR active_clinic_id = '00000000-0000-0000-0000-000000000000'::UUID);

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to remove user from clinic
CREATE OR REPLACE FUNCTION remove_user_from_clinic(
  p_user_id UUID,
  p_clinic_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Remove clinic from user's clinic_ids array
  UPDATE users
  SET clinic_ids = array_remove(clinic_ids, p_clinic_id)
  WHERE user_id = p_user_id;

  -- Remove user from clinic's user_ids array
  UPDATE clinics
  SET user_ids = array_remove(user_ids, p_user_id)
  WHERE clinic_id = p_clinic_id;

  -- If this was the active clinic, set active to first clinic in array
  UPDATE users
  SET active_clinic_id = clinic_ids[1]
  WHERE user_id = p_user_id
  AND active_clinic_id = p_clinic_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to switch active clinic
CREATE OR REPLACE FUNCTION switch_active_clinic(
  p_user_id UUID,
  p_clinic_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_has_access BOOLEAN;
BEGIN
  -- Check if user has access to this clinic
  SELECT p_clinic_id = ANY(clinic_ids)
  INTO v_has_access
  FROM users
  WHERE user_id = p_user_id;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'User does not have access to this clinic';
  END IF;

  -- Update active clinic
  UPDATE users
  SET active_clinic_id = p_clinic_id
  WHERE user_id = p_user_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all clinics for a user with additional info
CREATE OR REPLACE FUNCTION get_user_clinics(p_user_id UUID)
RETURNS TABLE (
  clinic_id UUID,
  clinic_name VARCHAR,
  primary_color VARCHAR,
  secondary_color VARCHAR,
  logo_url TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.clinic_id,
    c.name,
    c.primary_color,
    c.secondary_color,
    c.logo_url,
    c.created_at,
    c.updated_at
  FROM clinics c
  WHERE c.clinic_id = ANY(
    SELECT UNNEST(u.clinic_ids)
    FROM users u
    WHERE u.user_id = p_user_id
  )
  ORDER BY c.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION add_user_to_clinic(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_user_from_clinic(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION switch_active_clinic(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_clinics(UUID) TO authenticated;

-- Migration complete
-- Users can now belong to multiple clinics via clinic_ids array
-- Clinics track their users via user_ids array
-- Use active_clinic_id to track which clinic they're currently viewing
