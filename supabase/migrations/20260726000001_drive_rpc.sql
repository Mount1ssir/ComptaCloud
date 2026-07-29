-- Helper functions for encrypting and decrypting Google Drive refresh tokens using pgcrypto

-- 1. Helper RPC to save encrypted Google Drive refresh token for a tenant
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
    -- Verify calling user is cabinet_admin of p_tenant_id (or service_role)
    IF auth.role() <> 'service_role' AND NOT EXISTS (
        SELECT 1 FROM users
        WHERE id = auth.uid() AND role = 'cabinet_admin' AND tenant_id = p_tenant_id
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

-- 2. Helper RPC to decrypt and retrieve Google Drive refresh token for a tenant
CREATE OR REPLACE FUNCTION public.get_tenant_drive_refresh_token(
    p_tenant_id UUID,
    p_encryption_key TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_token TEXT;
BEGIN
    SELECT extensions.pgp_sym_decrypt(google_drive_refresh_token_encrypted, p_encryption_key)
    INTO v_token
    FROM tenants
    WHERE id = p_tenant_id AND google_drive_connected = true;

    RETURN v_token;
END;
$$;
