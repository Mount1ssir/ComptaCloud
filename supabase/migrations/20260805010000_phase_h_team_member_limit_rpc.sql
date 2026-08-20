-- Migration: Phase H — Update check_plan_limit to count total team members for a tenant

CREATE OR REPLACE FUNCTION public.check_plan_limit(
    p_limit_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
    v_plan_id UUID;
    v_limit_value INT;
    v_current_count INT;
    v_sub_status subscription_status;
BEGIN
    -- 1. Super Admin bypass
    IF is_super_admin() THEN
        RETURN jsonb_build_object(
            'allowed', true,
            'limit_key', p_limit_key,
            'current_count', 0,
            'max_allowed', -1,
            'bypassed', true
        );
    END IF;

    -- 2. Resolve caller's tenant_id
    SELECT tenant_id INTO v_tenant_id FROM public.users WHERE id = auth.uid();
    IF v_tenant_id IS NULL THEN
        RETURN jsonb_build_object('allowed', false, 'message', 'Aucun cabinet associé à votre compte.');
    END IF;

    -- 3. Resolve tenant subscription plan_id and status
    SELECT plan_id, status INTO v_plan_id, v_sub_status
    FROM public.subscriptions
    WHERE tenant_id = v_tenant_id
    LIMIT 1;

    IF v_plan_id IS NULL THEN
        RETURN jsonb_build_object('allowed', false, 'message', 'Abonnement introuvable pour ce cabinet.');
    END IF;

    IF v_sub_status = 'suspended' THEN
        RETURN jsonb_build_object('allowed', false, 'message', 'Abonnement suspendu.');
    END IF;

    -- 4. Query configured limit_value from plan_limits
    SELECT limit_value INTO v_limit_value
    FROM public.plan_limits
    WHERE plan_id = v_plan_id AND limit_key = p_limit_key;

    IF v_limit_value IS NULL THEN
        -- Default fallback if limit key not configured
        RETURN jsonb_build_object('allowed', true, 'limit_key', p_limit_key, 'current_count', 0, 'max_allowed', -1);
    END IF;

    IF v_limit_value = -1 THEN
        RETURN jsonb_build_object('allowed', true, 'limit_key', p_limit_key, 'current_count', 0, 'max_allowed', -1);
    END IF;

    -- 5. Count current tenant usage
    IF p_limit_key = 'max_accountants' THEN
        -- FEATURE 5: Count ALL team members in tenant regardless of role
        SELECT COUNT(*)::INT INTO v_current_count
        FROM public.users u
        WHERE u.tenant_id = v_tenant_id;
    ELSIF p_limit_key = 'max_storage_gb' THEN
        v_current_count := 0;
    ELSE
        v_current_count := 0;
    END IF;

    -- 6. Enforce limit gate
    IF v_current_count >= v_limit_value THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'limit_key', p_limit_key,
            'current_count', v_current_count,
            'max_allowed', v_limit_value,
            'message', 'Limite atteinte (' || v_current_count || '/' || v_limit_value || ' membres d''équipe pour votre forfait). Veuillez faire évoluer votre abonnement.'
        );
    END IF;

    RETURN jsonb_build_object(
        'allowed', true,
        'limit_key', p_limit_key,
        'current_count', v_current_count,
        'max_allowed', v_limit_value
    );
END;
$$;
