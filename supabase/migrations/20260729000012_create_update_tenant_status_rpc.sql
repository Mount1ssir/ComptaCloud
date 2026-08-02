-- Migration: Create update_tenant_status SECURITY DEFINER RPC
-- Solves pre-existing 42501 permission denied for table tenants error caused by REVOKE UPDATE ON tenants in 20260726000000_drive_byos.sql

CREATE OR REPLACE FUNCTION public.update_tenant_status(
    p_tenant_id UUID,
    p_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
BEGIN
    -- 1. Authorization check: super_admin OR tenants:manage permission
    IF NOT (is_super_admin() OR has_permission('tenants:manage')) THEN
        RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
    END IF;

    -- 2. Input validation
    IF p_status NOT IN ('active', 'suspended') THEN
        RAISE EXCEPTION 'invalid_status';
    END IF;

    -- 3. Verify tenant existence
    IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant_id) THEN
        RAISE EXCEPTION 'tenant_not_found';
    END IF;

    -- 4. Update status under SECURITY DEFINER context
    UPDATE tenants
    SET status = p_status::tenant_status
    WHERE id = p_tenant_id;

    RETURN true;
END;
$$;

-- Grant EXECUTE to authenticated role
GRANT EXECUTE ON FUNCTION public.update_tenant_status(UUID, TEXT) TO authenticated;
