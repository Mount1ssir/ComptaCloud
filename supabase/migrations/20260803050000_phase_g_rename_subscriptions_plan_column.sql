-- Migration: Phase G — Rename subscriptions.plan to subscriptions.plan_legacy & Deprecate Text Column

-- 1. Rename column subscriptions.plan to subscriptions.plan_legacy
ALTER TABLE public.subscriptions 
RENAME COLUMN plan TO plan_legacy;

-- 2. Add SQL comment documenting deprecation
COMMENT ON COLUMN public.subscriptions.plan_legacy IS 
'DEPRECATED: Free-text plan name retained for historical audit compatibility. Use plan_id foreign key referencing public.plans(id) as authoritative source.';

-- 3. Update create_tenant_with_admin_invite RPC to write plan_legacy and plan_id
CREATE OR REPLACE FUNCTION public.create_tenant_with_admin_invite(
    p_name TEXT,
    p_subdomain TEXT,
    p_admin_email TEXT,
    p_admin_first_name TEXT,
    p_admin_last_name TEXT,
    p_calling_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
    v_subscription_id UUID;
    v_role_id UUID;
    v_user_id UUID;
    v_result JSONB;
    v_starter_plan_id UUID;
BEGIN
    -- 1. Authorization Check: Super Admin only
    IF NOT is_super_admin() THEN
        RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
    END IF;

    -- 2. Subdomain validation
    IF p_subdomain !~ '^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$' THEN
        RAISE EXCEPTION 'invalid_subdomain_format';
    END IF;

    IF EXISTS (SELECT 1 FROM tenants WHERE subdomain = p_subdomain) THEN
        RAISE EXCEPTION 'subdomain_already_in_use';
    END IF;

    -- 3. Resolve default 'trial' or 'starter' plan_id for initial subscription
    SELECT id INTO v_starter_plan_id FROM public.plans WHERE slug IN ('trial', 'starter') ORDER BY tier_rank ASC LIMIT 1;

    -- 4. Create tenant in PENDING status
    INSERT INTO tenants (name, subdomain, status)
    VALUES (p_name, p_subdomain, 'pending')
    RETURNING id INTO v_tenant_id;

    -- 5. Create initial subscription referencing plan_legacy and resolved plan_id
    INSERT INTO subscriptions (tenant_id, plan_legacy, plan_id, status)
    VALUES (v_tenant_id, 'trial', v_starter_plan_id, 'trial')
    RETURNING id INTO v_subscription_id;

    -- 6. Resolve cabinet_admin system role ID
    SELECT id INTO v_role_id FROM roles WHERE name = 'cabinet_admin';

    -- 7. Create cabinet_admin user
    INSERT INTO users (tenant_id, email, first_name, last_name, role_id)
    VALUES (v_tenant_id, p_admin_email, p_admin_first_name, p_admin_last_name, v_role_id)
    RETURNING id INTO v_user_id;

    -- 8. Log action in audit logs
    INSERT INTO logs (user_id, action)
    VALUES (p_calling_user_id, 'tenant_created_pending_invite: ' || p_name || ' (' || p_subdomain || ') for ' || p_admin_email);

    v_result := jsonb_build_object(
        'tenant_id', v_tenant_id,
        'subscription_id', v_subscription_id,
        'user_id', v_user_id,
        'name', p_name,
        'subdomain', p_subdomain,
        'admin_email', p_admin_email
    );

    RETURN v_result;
END;
$$;

-- 4. Update legacy create_tenant_with_subscription RPC to write plan_legacy and plan_id
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
    v_starter_plan_id UUID;
BEGIN
    IF NOT is_super_admin() THEN
        RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
    END IF;

    IF p_subdomain !~ '^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$' THEN
        RAISE EXCEPTION 'invalid_subdomain_format';
    END IF;

    IF EXISTS (SELECT 1 FROM tenants WHERE subdomain = p_subdomain) THEN
        RAISE EXCEPTION 'subdomain_already_in_use';
    END IF;

    SELECT id INTO v_starter_plan_id FROM public.plans WHERE slug IN ('trial', 'starter') ORDER BY tier_rank ASC LIMIT 1;

    INSERT INTO tenants (name, subdomain, status)
    VALUES (p_name, p_subdomain, 'pending')
    RETURNING id INTO v_tenant_id;

    INSERT INTO subscriptions (tenant_id, plan_legacy, plan_id, status)
    VALUES (v_tenant_id, 'trial', v_starter_plan_id, 'trial')
    RETURNING id INTO v_subscription_id;

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
