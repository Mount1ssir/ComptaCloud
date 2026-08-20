-- Migration: Phase H — Add is_recommended column to public.plans and update upsert_plan_details RPC

-- 1. Add is_recommended column to plans table
ALTER TABLE public.plans
ADD COLUMN IF NOT EXISTS is_recommended BOOLEAN NOT NULL DEFAULT false;

-- 2. Drop old overloaded signature & create updated upsert_plan_details RPC
DROP FUNCTION IF EXISTS public.upsert_plan_details(UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT, INT, BOOLEAN, TEXT[], INT, INT);

CREATE OR REPLACE FUNCTION public.upsert_plan_details(
    p_plan_id UUID,
    p_name TEXT,
    p_slug TEXT,
    p_description TEXT,
    p_price_monthly NUMERIC,
    p_currency TEXT,
    p_tier_rank INT,
    p_is_active BOOLEAN,
    p_permission_keys TEXT[],
    p_max_accountants INT,
    p_max_storage_gb INT,
    p_is_recommended BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_plan_id UUID;
    v_perm_key TEXT;
BEGIN
    IF NOT is_super_admin() THEN
        RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
    END IF;

    IF p_plan_id IS NULL THEN
        INSERT INTO public.plans (
            name, slug, description, price_monthly, currency, tier_rank, is_active, is_recommended
        )
        VALUES (
            p_name, LOWER(TRIM(p_slug)), p_description, p_price_monthly, COALESCE(p_currency, 'MAD'), p_tier_rank, COALESCE(p_is_active, true), COALESCE(p_is_recommended, false)
        )
        RETURNING id INTO v_plan_id;
    ELSE
        UPDATE public.plans
        SET name = p_name,
            slug = LOWER(TRIM(p_slug)),
            description = p_description,
            price_monthly = p_price_monthly,
            currency = COALESCE(p_currency, 'MAD'),
            tier_rank = p_tier_rank,
            is_active = COALESCE(p_is_active, true),
            is_recommended = COALESCE(p_is_recommended, false)
        WHERE id = p_plan_id
        RETURNING id INTO v_plan_id;

        IF v_plan_id IS NULL THEN
            RAISE EXCEPTION 'plan_not_found';
        END IF;
    END IF;

    DELETE FROM public.plan_permissions WHERE plan_id = v_plan_id;
    IF p_permission_keys IS NOT NULL AND array_length(p_permission_keys, 1) > 0 THEN
        FOREACH v_perm_key IN ARRAY p_permission_keys
        LOOP
            INSERT INTO public.plan_permissions (plan_id, permission_id)
            SELECT v_plan_id, id FROM public.permissions WHERE key = v_perm_key;
        END LOOP;
    END IF;

    DELETE FROM public.plan_limits WHERE plan_id = v_plan_id;
    IF p_max_accountants IS NOT NULL THEN
        INSERT INTO public.plan_limits (plan_id, limit_key, limit_value)
        VALUES (v_plan_id, 'max_accountants', p_max_accountants);
    END IF;
    IF p_max_storage_gb IS NOT NULL THEN
        INSERT INTO public.plan_limits (plan_id, limit_key, limit_value)
        VALUES (v_plan_id, 'max_storage_gb', p_max_storage_gb);
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'plan_id', v_plan_id
    );
END;
$$;
