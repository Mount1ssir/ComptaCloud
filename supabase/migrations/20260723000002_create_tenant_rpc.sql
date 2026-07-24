-- Atomic PostgreSQL function to create a tenant, default subscription, and audit log in a single transaction
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
    -- Validate subdomain format: 3 to 63 chars, lowercase alphanumeric + hyphens, no starting/ending hyphen
    IF p_subdomain !~ '^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$' THEN
        RAISE EXCEPTION 'invalid_subdomain_format';
    END IF;

    -- Check subdomain uniqueness
    IF EXISTS (SELECT 1 FROM tenants WHERE subdomain = p_subdomain) THEN
        RAISE EXCEPTION 'subdomain_already_in_use';
    END IF;

    -- 1. Insert Tenant
    INSERT INTO tenants (name, subdomain, status)
    VALUES (p_name, p_subdomain, 'active')
    RETURNING id INTO v_tenant_id;

    -- 2. Insert Subscription (default plan = 'trial', status = 'trial')
    INSERT INTO subscriptions (tenant_id, plan, status)
    VALUES (v_tenant_id, 'trial', 'trial')
    RETURNING id INTO v_subscription_id;

    -- 3. Insert Audit Log
    INSERT INTO logs (user_id, action)
    VALUES (p_admin_id, 'tenant_created: ' || p_name || ' (' || p_subdomain || ')');

    v_result := jsonb_build_object(
        'tenant_id', v_tenant_id,
        'subscription_id', v_subscription_id,
        'name', p_name,
        'subdomain', p_subdomain
    );

    RETURN v_result;
END;
$$;
