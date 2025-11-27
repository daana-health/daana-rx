  -- Cleanup Script for Multi-Clinic Migration
  -- Run this FIRST if you've already partially run the migration
  -- This will remove any existing policies and prepare for a fresh migration

  -- Drop all multi-clinic policies if they exist
  DROP POLICY IF EXISTS user_multi_clinic_isolation ON users;
  DROP POLICY IF EXISTS clinic_multi_access ON clinics;
  DROP POLICY IF EXISTS location_multi_clinic_isolation ON locations;
  DROP POLICY IF EXISTS lot_multi_clinic_isolation ON lots;
  DROP POLICY IF EXISTS unit_multi_clinic_isolation ON units;
  DROP POLICY IF EXISTS transaction_multi_clinic_isolation ON transactions;
  DROP POLICY IF EXISTS invitation_isolation ON invitations;
  DROP POLICY IF EXISTS invitation_token_access ON invitations;

  -- Drop helper functions if they exist
  DROP FUNCTION IF EXISTS add_user_to_clinic(UUID, UUID);
  DROP FUNCTION IF EXISTS remove_user_from_clinic(UUID, UUID);
  DROP FUNCTION IF EXISTS switch_active_clinic(UUID, UUID);
  DROP FUNCTION IF EXISTS get_user_clinics(UUID);

  -- Drop user_clinics table if it exists (we're using arrays instead)
  DROP TABLE IF EXISTS user_clinics CASCADE;

  -- Remove array columns if they exist (but keep data)
  -- Note: We won't drop these columns to preserve any data that might already be there
  -- If you want to start completely fresh, uncomment these lines:
  -- ALTER TABLE users DROP COLUMN IF EXISTS clinic_ids;
  -- ALTER TABLE users DROP COLUMN IF EXISTS active_clinic_id;
  -- ALTER TABLE clinics DROP COLUMN IF EXISTS user_ids;

  -- Recreate the original policies (from your original schema)
  CREATE POLICY user_isolation ON users
    FOR ALL
    USING (
      user_id = auth.uid()
      OR
      clinic_id IN (
        SELECT clinic_id FROM users WHERE user_id = auth.uid()
      )
    );

  CREATE POLICY clinic_isolation ON clinics
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM users
        WHERE users.user_id = auth.uid()
        AND users.clinic_id = clinics.clinic_id
      )
    );

  CREATE POLICY location_isolation ON locations
    FOR ALL
    USING (
      clinic_id IN (
        SELECT clinic_id FROM users WHERE user_id = auth.uid()
      )
    );

  CREATE POLICY lot_isolation ON lots
    FOR ALL
    USING (
      clinic_id IN (
        SELECT clinic_id FROM users WHERE user_id = auth.uid()
      )
    );

  CREATE POLICY unit_isolation ON units
    FOR ALL
    USING (
      clinic_id IN (
        SELECT clinic_id FROM users WHERE user_id = auth.uid()
      )
    );

  CREATE POLICY transaction_isolation ON transactions
    FOR ALL
    USING (
      clinic_id IN (
        SELECT clinic_id FROM users WHERE user_id = auth.uid()
      )
    );

  -- Now you're ready to run the migration_multi_clinic_support.sql file
