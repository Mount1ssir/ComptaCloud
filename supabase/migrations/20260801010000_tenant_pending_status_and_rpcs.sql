-- Migration: Add 'pending' to tenant_status enum and update RPCs
-- Allows tenants to be created in 'pending' status awaiting invited cabinet_admin email acceptance

-- 1. Add 'pending' value to tenant_status enum
ALTER TYPE public.tenant_status ADD VALUE IF NOT EXISTS 'pending';

-- 2. Update create_tenant_with_subscription RPC to set initial status to 'pending'
CREATE OR REPLACE FUNCTION public.create_tenant_with_subscription(
    p_name TEXT,
    p_subdomain TEXT,
    p_admin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
    v_subscription_id UUID;
    v_result JSONB;
BEGIN
    -- AUTHORIZATION CHECK: super_admin OR tenants:manage permission
    IF NOT (is_super_admin() OR has_permission('tenants:manage')) THEN
        RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
    END IF;

    -- Validate subdomain format: 3 to 63 chars, lowercase alphanumeric + hyphens
    IF p_subdomain !~ '^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$' THEN
        RAISE EXCEPTION 'invalid_subdomain_format';
    END IF;

    -- Check subdomain uniqueness
    IF EXISTS (SELECT 1 FROM tenants WHERE subdomain = p_subdomain) THEN
        RAISE EXCEPTION 'subdomain_already_in_use';
    END IF;

    -- 1. Insert Tenant with status = 'pending'
    INSERT INTO tenants (name, subdomain, status)
    VALUES (p_name, p_subdomain, 'pending'::tenant_status)
    RETURNING id INTO v_tenant_id;

    -- 2. Insert Subscription (default plan = 'trial', status = 'trial')
    INSERT INTO subscriptions (tenant_id, plan, status)
    VALUES (v_tenant_id, 'trial', 'trial')
    RETURNING id INTO v_subscription_id;

    -- 3. Insert Audit Log
    INSERT INTO logs (user_id, action)
    VALUES (p_admin_id, 'tenant_created: ' || p_name || ' (' || p_subdomain || ')');

    -- Build return payload
    v_result := jsonb_build_object(
        'tenant_id', v_tenant_id,
        'subscription_id', v_subscription_id,
        'name', p_name,
        'subdomain', p_subdomain
    );

    RETURN v_result;
END;
$$;

-- 3. Update update_tenant_status RPC to support 'pending' status validation
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

    -- 2. Input validation (expanded to include 'pending')
    IF p_status NOT IN ('active', 'suspended', 'pending') THEN
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
