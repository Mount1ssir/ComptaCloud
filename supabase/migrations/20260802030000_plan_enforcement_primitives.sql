-- Migration: Phase E.1 — Plan Enforcement Primitives
-- Creates has_plan_permission(), check_plan_limit(), and can_perform_with_plan() SECURITY DEFINER functions

-- 1. Function: has_plan_permission(p_perm_key TEXT)
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

-- 2. Function: check_plan_limit(p_limit_key TEXT)
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

    -- 6. Fetch limit_value for this plan
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

-- 3. Function: can_perform_with_plan(p_perm_key TEXT)
CREATE OR REPLACE FUNCTION public.can_perform_with_plan(p_perm_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_scope TEXT;
    v_has_role_perm BOOLEAN;
    v_has_plan_perm BOOLEAN;
BEGIN
    -- Super Admin bypass (identity-based)
    IF is_super_admin() THEN
        RETURN true;
    END IF;

    -- Require authenticated user session
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    -- 1. Check role permission
    v_has_role_perm := has_permission(p_perm_key);
    IF NOT v_has_role_perm THEN
        RETURN false;
    END IF;

    -- 2. Resolve permission scope
    SELECT scope INTO v_scope
    FROM public.permissions
    WHERE key = p_perm_key;

    -- 3. Scope evaluation: cabinet/platform permissions are role-only
    IF v_scope IS NULL OR v_scope IN ('cabinet', 'platform') THEN
        RETURN true;
    END IF;

    -- 4. Scope = 'plan' requires dual-gating: role AND plan permission
    v_has_plan_perm := has_plan_permission(p_perm_key);
    RETURN v_has_plan_perm;
END;
$$;

-- Explicit EXECUTE privilege grants to authenticated role
GRANT EXECUTE ON FUNCTION public.has_plan_permission(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_plan_limit(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_perform_with_plan(TEXT) TO authenticated;
