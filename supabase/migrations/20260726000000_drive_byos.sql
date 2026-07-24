-- Migration: Google Drive BYOS Integration
-- Enables pgcrypto extension for AES encryption of refresh tokens
-- Adds Google Drive connection columns to tenants table
-- Restricts tenant UPDATE privileges for authenticated users to Google Drive columns only

-- 1. Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Add Google Drive connection columns to tenants table
ALTER TABLE tenants
    ADD COLUMN google_drive_connected BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN google_drive_refresh_token_encrypted BYTEA,
    ADD COLUMN google_drive_connected_at TIMESTAMPTZ,
    ADD COLUMN google_drive_account_email TEXT;

-- 3. Revoke broad table-level UPDATE on tenants from authenticated role
REVOKE UPDATE ON tenants FROM authenticated;

-- 4. Grant column-level UPDATE on Google Drive columns ONLY to authenticated role
GRANT UPDATE (
  google_drive_connected,
  google_drive_refresh_token_encrypted,
  google_drive_connected_at,
  google_drive_account_email
) ON tenants TO authenticated;

-- 5. RLS Policy for Cabinet Admin to update Drive columns on their own tenant row
CREATE POLICY tenant_isolation_tenants_update_drive_cabinet_admin ON tenants
    FOR UPDATE
    USING (id = get_my_tenant_id() AND get_my_role() = 'cabinet_admin')
    WITH CHECK (id = get_my_tenant_id() AND get_my_role() = 'cabinet_admin');
