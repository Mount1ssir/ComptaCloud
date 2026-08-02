-- Migration: Phase D Checkpoint 7 — Convert save_tenant_drive_token RPC authorization check
-- Rule 1: Always include (is_super_admin() OR (has_permission('drive:connect') AND tenant_id = p_tenant_id))
-- Rule 2: Preserve auth.role() <> 'service_role' bypass and tenant_id = p_tenant_id isolation for non-super_admin callers
-- Rule 4: Include ROLLBACK definition as comment

-- ROLLBACK:
-- CREATE OR REPLACE FUNCTION public.save_tenant_drive_token(p_tenant_id UUID, p_refresh_token TEXT, p_account_email TEXT, p_encryption_key TEXT) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$ BEGIN IF auth.role() <> 'service_role' AND NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'cabinet_admin' AND tenant_id = p_tenant_id) THEN RAISE EXCEPTION 'not_authorized'; END IF; UPDATE tenants SET google_drive_connected = true, google_drive_refresh_token_encrypted = extensions.pgp_sym_encrypt(p_refresh_token, p_encryption_key), google_drive_connected_at = now(), google_drive_account_email = p_account_email WHERE id = p_tenant_id; RETURN true; END; $$;

CREATE OR REPLACE FUNCTION public.save_tenant_drive_token(
    p_tenant_id UUID,
    p_refresh_token TEXT,
    p_account_email TEXT,
    p_encryption_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    -- Verify calling user is authorized (super_admin bypass OR cabinet_admin with drive:connect permission for p_tenant_id, or service_role)
    IF auth.role() <> 'service_role' AND NOT EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid()
          AND (is_super_admin() OR (has_permission('drive:connect') AND tenant_id = p_tenant_id))
    ) THEN
        RAISE EXCEPTION 'not_authorized';
    END IF;

    UPDATE tenants
    SET google_drive_connected = true,
        google_drive_refresh_token_encrypted = extensions.pgp_sym_encrypt(p_refresh_token, p_encryption_key),
        google_drive_connected_at = now(),
        google_drive_account_email = p_account_email
    WHERE id = p_tenant_id;

    RETURN true;
END;
$$;
