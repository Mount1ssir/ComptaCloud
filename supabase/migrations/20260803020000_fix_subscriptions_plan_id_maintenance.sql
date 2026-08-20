-- Migration: Phase E Issue 1 Fix — Maintain subscriptions.plan_id FK & Fail-Closed Quota Primitives

-- 1. Backfill all existing subscriptions rows to ensure plan_id is 100% in sync with plans.slug
UPDATE public.subscriptions s
SET plan_id = p.id
FROM public.plans p
WHERE LOWER(TRIM(s.plan)) = p.slug;

-- 2. Update create_tenant_with_admin_invite RPC to resolve and set plan_id for default 'trial' plan
CREATE OR REPLACE FUNCTION public.create_tenant_with_admin_invite(
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
    v_trial_plan_id UUID;
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

    -- Resolve plan_id for default 'trial' plan
    SELECT id INTO v_trial_plan_id
    FROM public.plans
    WHERE slug = 'trial';

    -- 1. Insert Tenant with status = 'pending'
    INSERT INTO tenants (name, subdomain, status)
    VALUES (p_name, p_subdomain, 'pending'::tenant_status)
    RETURNING id INTO v_tenant_id;

    -- 2. Insert Subscription with resolved plan_id
    INSERT INTO subscriptions (tenant_id, plan, plan_id, status)
    VALUES (v_tenant_id, 'trial', v_trial_plan_id, 'trial')
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

-- 3. Update has_plan_permission() to FAIL CLOSED when v_plan_id IS NULL
CREATE OR REPLACE FUNCTION public.has_plan_permission(p_perm_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
    v_plan_id UUID;
    v_has_perm BOOLEAN;
BEGIN
    -- Super Admin bypass (identity-based)
    IF is_super_admin() THEN
        RETURN true;
    END IF;

    -- Require authenticated user session
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    -- Resolve caller's tenant_id
    SELECT tenant_id INTO v_tenant_id
    FROM public.users
    WHERE id = auth.uid();

    IF v_tenant_id IS NULL THEN
        RETURN false;
    END IF;

    -- Resolve plan_id of tenant's subscription
    SELECT plan_id INTO v_plan_id
    FROM public.subscriptions
    WHERE tenant_id = v_tenant_id;

    -- FAIL CLOSED: If plan_id is NULL or unmapped, return false
    IF v_plan_id IS NULL THEN
        RETURN false;
    END IF;

    -- Check if plan_permissions includes permission_id for p_perm_key
    SELECT EXISTS (
        SELECT 1
        FROM public.plan_permissions pp
        JOIN public.permissions p ON p.id = pp.permission_id
        WHERE pp.plan_id = v_plan_id
          AND p.key = p_perm_key
    ) INTO v_has_perm;

    RETURN COALESCE(v_has_perm, false);
END;
$$;

-- 4. Update check_plan_limit() to FAIL CLOSED when v_plan_id IS NULL
CREATE OR REPLACE FUNCTION public.check_plan_limit(p_limit_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
    v_plan_id UUID;
    v_limit_value INT;
    v_current_count INT := 0;
    v_allowed BOOLEAN := true;
    v_remaining INT := -1;
    v_message TEXT := 'OK';
BEGIN
    -- 1. Validate limit key supported BEFORE anything else
    IF p_limit_key NOT IN ('max_accountants', 'max_storage_gb') THEN
        RAISE EXCEPTION 'unsupported_limit_key: %', p_limit_key USING ERRCODE = '42883';
    END IF;

    -- 2. Super Admin bypass (identity-based)
    IF is_super_admin() THEN
        RETURN jsonb_build_object(
            'allowed', true,
            'current_count', 0,
            'limit_value', -1,
            'remaining', -1,
            'message', 'Super Admin bypass'
        );
    END IF;

    -- 3. Require authenticated user session
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'current_count', 0,
            'limit_value', 0,
            'remaining', 0,
            'message', 'Session non authentifiée.'
        );
    END IF;

    -- 4. Resolve calling user's tenant_id
    SELECT tenant_id INTO v_tenant_id
    FROM public.users
    WHERE id = auth.uid();

    IF v_tenant_id IS NULL THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'current_count', 0,
            'limit_value', 0,
            'remaining', 0,
            'message', 'Utilisateur sans cabinet.'
        );
    END IF;

    -- 5. Resolve plan_id of tenant's subscription
    SELECT plan_id INTO v_plan_id
    FROM public.subscriptions
    WHERE tenant_id = v_tenant_id;

    -- 6. FAIL CLOSED: If plan_id is NULL or unmapped, block access loudly
    IF v_plan_id IS NULL THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'current_count', 0,
            'limit_value', 0,
            'remaining', 0,
            'message', 'Abonnement non configuré (plan_id manquant). Veuillez contacter le support.'
        );
    END IF;

    -- Fetch limit_value for this plan
    SELECT limit_value INTO v_limit_value
    FROM public.plan_limits
    WHERE plan_id = v_plan_id
      AND limit_key = p_limit_key;

    -- If no limit defined or unlimited (-1), pass
    IF v_limit_value IS NULL OR v_limit_value = -1 THEN
        RETURN jsonb_build_object(
            'allowed', true,
            'current_count', 0,
            'limit_value', -1,
            'remaining', -1,
            'message', 'Illimité'
        );
    END IF;

    -- 7. Calculate current live count based on limit_key
    IF p_limit_key = 'max_accountants' THEN
        SELECT COUNT(*) INTO v_current_count
        FROM public.users u
        JOIN public.roles r ON r.id = u.role_id
        WHERE u.tenant_id = v_tenant_id
          AND r.name = 'accountant';
    ELSIF p_limit_key = 'max_storage_gb' THEN
        v_current_count := 0;
    END IF;

    -- 8. Boundary check: allowed if current_count < limit_value
    IF v_current_count >= v_limit_value THEN
        v_allowed := false;
        v_remaining := 0;
        v_message := 'Limite atteinte (' || v_current_count || '/' || v_limit_value || ' comptables). Veuillez mettre à niveau votre abonnement.';
    ELSE
        v_allowed := true;
        v_remaining := v_limit_value - v_current_count;
        v_message := 'OK (' || v_current_count || '/' || v_limit_value || ')';
    END IF;

    RETURN jsonb_build_object(
        'allowed', v_allowed,
        'current_count', v_current_count,
        'limit_value', v_limit_value,
        'remaining', v_remaining,
        'message', v_message
    );
END;
$$;
