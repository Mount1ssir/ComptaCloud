-- Migration: Phase F — Atomic SECURITY DEFINER RPC for Super Admin Plan Management

CREATE OR REPLACE FUNCTION public.upsert_plan_details(
    p_plan_id UUID,               -- NULL for new plan creation, non-null for update
    p_name TEXT,
    p_slug TEXT,
    p_description TEXT,
    p_price_monthly NUMERIC,
    p_currency TEXT,
    p_tier_rank INT,
    p_is_active BOOLEAN,
    p_permission_keys TEXT[],     -- Array of permission keys e.g. ARRAY['drive:connect', 'drive:disconnect']
    p_max_accountants INT,
    p_max_storage_gb INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_target_plan_id UUID := p_plan_id;
    v_perm_id UUID;
    v_key TEXT;
BEGIN
    -- 1. Authorization check: super_admin or is_platform_role()
    IF NOT (is_super_admin() OR is_platform_role()) THEN
        RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
    END IF;

    -- 2. Validate inputs
    IF p_name IS NULL OR TRIM(p_name) = '' THEN
        RAISE EXCEPTION 'invalid_name';
    END IF;

    IF p_slug IS NULL OR TRIM(p_slug) = '' THEN
        RAISE EXCEPTION 'invalid_slug';
    END IF;

    -- 3. Create or Update Plan record in public.plans
    IF v_target_plan_id IS NULL THEN
        -- Check slug uniqueness
        IF EXISTS (SELECT 1 FROM public.plans WHERE LOWER(slug) = LOWER(TRIM(p_slug))) THEN
            RAISE EXCEPTION 'slug_already_exists';
        END IF;

        INSERT INTO public.plans (name, slug, description, price_monthly, currency, tier_rank, is_active)
        VALUES (TRIM(p_name), LOWER(TRIM(p_slug)), p_description, p_price_monthly, COALESCE(p_currency, 'EUR'), p_tier_rank, COALESCE(p_is_active, true))
        RETURNING id INTO v_target_plan_id;
    ELSE
        -- Verify target plan exists
        IF NOT EXISTS (SELECT 1 FROM public.plans WHERE id = v_target_plan_id) THEN
            RAISE EXCEPTION 'plan_not_found';
        END IF;

        -- Check slug uniqueness against other plans
        IF EXISTS (SELECT 1 FROM public.plans WHERE LOWER(slug) = LOWER(TRIM(p_slug)) AND id <> v_target_plan_id) THEN
            RAISE EXCEPTION 'slug_already_exists';
        END IF;

        UPDATE public.plans
        SET name = TRIM(p_name),
            slug = LOWER(TRIM(p_slug)),
            description = p_description,
            price_monthly = p_price_monthly,
            currency = COALESCE(p_currency, 'EUR'),
            tier_rank = p_tier_rank,
            is_active = COALESCE(p_is_active, true)
        WHERE id = v_target_plan_id;
    END IF;

    -- 4. Replace plan_permissions atomically
    DELETE FROM public.plan_permissions WHERE plan_id = v_target_plan_id;

    IF p_permission_keys IS NOT NULL AND array_length(p_permission_keys, 1) > 0 THEN
        FOREACH v_key IN ARRAY p_permission_keys LOOP
            SELECT id INTO v_perm_id FROM public.permissions WHERE key = v_key AND scope = 'plan';
            IF v_perm_id IS NOT NULL THEN
                INSERT INTO public.plan_permissions (plan_id, permission_id)
                VALUES (v_target_plan_id, v_perm_id)
                ON CONFLICT DO NOTHING;
            END IF;
        END LOOP;
    END IF;

    -- 5. Replace plan_limits atomically (max_accountants, max_storage_gb)
    DELETE FROM public.plan_limits WHERE plan_id = v_target_plan_id;

    IF p_max_accountants IS NOT NULL THEN
        INSERT INTO public.plan_limits (plan_id, limit_key, limit_value)
        VALUES (v_target_plan_id, 'max_accountants', p_max_accountants);
    END IF;

    IF p_max_storage_gb IS NOT NULL THEN
        INSERT INTO public.plan_limits (plan_id, limit_key, limit_value)
        VALUES (v_target_plan_id, 'max_storage_gb', p_max_storage_gb);
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'plan_id', v_target_plan_id
    );
END;
$$;
