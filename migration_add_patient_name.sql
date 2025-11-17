-- Add patient_name column to transactions table
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS patient_name VARCHAR(255);

-- Create index for faster search by patient name
CREATE INDEX IF NOT EXISTS idx_transactions_patient_name ON transactions(patient_name);

