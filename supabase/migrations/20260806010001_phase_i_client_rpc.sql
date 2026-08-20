-- Migration: Phase I Feature 2 — Client RPC Functions & Quota Check

-- 1. Drop old upsert_plan_details signatures to avoid overload mismatch
DROP FUNCTION IF EXISTS public.upsert_plan_details(UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT, INT, BOOLEAN, TEXT[], INT, INT);
DROP FUNCTION IF EXISTS public.upsert_plan_details(UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT, INT, BOOLEAN, TEXT[], INT, INT, BOOLEAN);
DROP FUNCTION IF EXISTS public.upsert_plan_details(UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT, INT, BOOLEAN, TEXT[], INT, INT, BOOLEAN, INT);

-- 2. Update check_plan_limit to support 'max_clients' key
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
    -- Super Admin bypass
    IF is_super_admin() THEN
        RETURN jsonb_build_object(
            'allowed', true,
            'limit_key', p_limit_key,
            'current_count', 0,
            'max_allowed', -1,
            'bypassed', true
        );
    END IF;

    -- Resolve caller's tenant_id
    SELECT tenant_id INTO v_tenant_id FROM public.users WHERE id = auth.uid();
    IF v_tenant_id IS NULL THEN
        RETURN jsonb_build_object('allowed', false, 'message', 'Aucun cabinet associé à votre compte.');
    END IF;

    -- Resolve tenant subscription plan_id and status
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

    -- Query configured limit_value from plan_limits
    SELECT limit_value INTO v_limit_value
    FROM public.plan_limits
    WHERE plan_id = v_plan_id AND limit_key = p_limit_key;

    IF v_limit_value IS NULL THEN
        RETURN jsonb_build_object('allowed', true, 'limit_key', p_limit_key, 'current_count', 0, 'max_allowed', -1);
    END IF;

    IF v_limit_value = -1 THEN
        RETURN jsonb_build_object('allowed', true, 'limit_key', p_limit_key, 'current_count', 0, 'max_allowed', -1);
    END IF;

    -- Count current tenant usage
    IF p_limit_key = 'max_accountants' THEN
        SELECT COUNT(*)::INT INTO v_current_count
        FROM public.users u
        WHERE u.tenant_id = v_tenant_id;
    ELSIF p_limit_key = 'max_clients' THEN
        -- Active clients quota counting rule: count active clients only
        SELECT COUNT(*)::INT INTO v_current_count
        FROM public.clients c
        WHERE c.tenant_id = v_tenant_id AND c.status = 'active';
    ELSIF p_limit_key = 'max_storage_gb' THEN
        v_current_count := 0;
    ELSE
        v_current_count := 0;
    END IF;

    -- Enforce limit gate
    IF v_current_count >= v_limit_value THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'limit_key', p_limit_key,
            'current_count', v_current_count,
            'max_allowed', v_limit_value,
            'message', 'Limite atteinte (' || v_current_count || '/' || v_limit_value || ' ' || 
                       CASE WHEN p_limit_key = 'max_clients' THEN 'clients' ELSE 'membres d''équipe' END || 
                       ' pour votre forfait). Veuillez faire évoluer votre abonnement.'
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

-- 3. Update upsert_plan_details to preserve/seed max_clients in plan_limits
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
    p_is_recommended BOOLEAN DEFAULT false,
    p_max_clients INT DEFAULT NULL
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
    v_clients_limit INT := p_max_clients;
BEGIN
    IF NOT (is_super_admin() OR is_platform_role()) THEN
        RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
    END IF;

    IF p_name IS NULL OR TRIM(p_name) = '' THEN
        RAISE EXCEPTION 'invalid_name';
    END IF;

    IF p_slug IS NULL OR TRIM(p_slug) = '' THEN
        RAISE EXCEPTION 'invalid_slug';
    END IF;

    IF v_target_plan_id IS NULL THEN
        IF EXISTS (SELECT 1 FROM public.plans WHERE LOWER(slug) = LOWER(TRIM(p_slug))) THEN
            RAISE EXCEPTION 'slug_already_exists';
        END IF;

        INSERT INTO public.plans (name, slug, description, price_monthly, currency, tier_rank, is_active, is_recommended)
        VALUES (TRIM(p_name), LOWER(TRIM(p_slug)), p_description, p_price_monthly, COALESCE(p_currency, 'MAD'), p_tier_rank, COALESCE(p_is_active, true), COALESCE(p_is_recommended, false))
        RETURNING id INTO v_target_plan_id;
    ELSE
        IF NOT EXISTS (SELECT 1 FROM public.plans WHERE id = v_target_plan_id) THEN
            RAISE EXCEPTION 'plan_not_found';
        END IF;

        IF EXISTS (SELECT 1 FROM public.plans WHERE LOWER(slug) = LOWER(TRIM(p_slug)) AND id <> v_target_plan_id) THEN
            RAISE EXCEPTION 'slug_already_exists';
        END IF;

        UPDATE public.plans
        SET name = TRIM(p_name),
            slug = LOWER(TRIM(p_slug)),
            description = p_description,
            price_monthly = p_price_monthly,
            currency = COALESCE(p_currency, 'MAD'),
            tier_rank = p_tier_rank,
            is_active = COALESCE(p_is_active, true),
            is_recommended = COALESCE(p_is_recommended, false)
        WHERE id = v_target_plan_id;
    END IF;

    -- Replace plan_permissions
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

    -- Replace plan_limits
    DELETE FROM public.plan_limits WHERE plan_id = v_target_plan_id;

    IF p_max_accountants IS NOT NULL THEN
        INSERT INTO public.plan_limits (plan_id, limit_key, limit_value)
        VALUES (v_target_plan_id, 'max_accountants', p_max_accountants);
    END IF;

    IF p_max_storage_gb IS NOT NULL THEN
        INSERT INTO public.plan_limits (plan_id, limit_key, limit_value)
        VALUES (v_target_plan_id, 'max_storage_gb', p_max_storage_gb);
    END IF;

    -- Seed max_clients
    IF v_clients_limit IS NULL THEN
        v_clients_limit := CASE
            WHEN LOWER(TRIM(p_slug)) IN ('trial', 'essai') THEN 3
            WHEN LOWER(TRIM(p_slug)) = 'starter' THEN 10
            WHEN LOWER(TRIM(p_slug)) = 'pro' THEN 50
            WHEN LOWER(TRIM(p_slug)) = 'enterprise' THEN -1
            ELSE 10
        END;
    END IF;

    INSERT INTO public.plan_limits (plan_id, limit_key, limit_value)
    VALUES (v_target_plan_id, 'max_clients', v_clients_limit);

    RETURN jsonb_build_object(
        'success', true,
        'plan_id', v_target_plan_id,
        'name', TRIM(p_name),
        'slug', LOWER(TRIM(p_slug))
    );
END;
$$;

-- 4. RPC create_client_record
CREATE OR REPLACE FUNCTION public.create_client_record(
    p_name TEXT,
    p_client_type TEXT,
    p_email TEXT,
    p_phone TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID;
    v_client_id UUID;
    v_limit_res JSONB;
    v_is_allowed BOOLEAN;
    v_err_msg TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Utilisateur non authentifié.' USING ERRCODE = '42501';
    END IF;

    -- Resolve caller's tenant_id
    SELECT tenant_id INTO v_tenant_id FROM public.users WHERE id = v_user_id;
    IF v_tenant_id IS NULL AND NOT is_platform_role() THEN
        RAISE EXCEPTION 'Aucun cabinet associé à votre compte.' USING ERRCODE = '42501';
    END IF;

    IF v_tenant_id IS NULL AND is_platform_role() THEN
        SELECT id INTO v_tenant_id FROM public.tenants LIMIT 1;
        IF v_tenant_id IS NULL THEN
            RAISE EXCEPTION 'Aucun cabinet disponible.' USING ERRCODE = '42501';
        END IF;
    END IF;

    -- Check client creation role authorization (non-client users)
    IF NOT (is_platform_role() OR can_perform('team:manage') OR can_perform('team:invite') OR has_permission('branding:customize')) THEN
        RAISE EXCEPTION 'Vous n''êtes pas autorisé à créer un client.' USING ERRCODE = '42501';
    END IF;

    -- Enforce max_clients plan quota
    v_limit_res := check_plan_limit('max_clients');
    v_is_allowed := (v_limit_res->>'allowed')::BOOLEAN;

    IF NOT v_is_allowed THEN
        v_err_msg := COALESCE(v_limit_res->>'message', 'Limite de clients atteinte pour votre forfait.');
        RAISE EXCEPTION '%', v_err_msg USING ERRCODE = '42501';
    END IF;

    -- Insert client row
    INSERT INTO public.clients (
        tenant_id,
        name,
        client_type,
        email,
        phone,
        status,
        drive_folders,
        created_by
    ) VALUES (
        v_tenant_id,
        p_name,
        COALESCE(p_client_type, 'company'),
        p_email,
        p_phone,
        'active',
        '{}'::jsonb,
        v_user_id
    ) RETURNING id INTO v_client_id;

    RETURN jsonb_build_object(
        'success', true,
        'client_id', v_client_id,
        'tenant_id', v_tenant_id
    );
END;
$$;

-- 5. RPC update_client_drive_folders
CREATE OR REPLACE FUNCTION public.update_client_drive_folders(
    p_client_id UUID,
    p_drive_folders JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Utilisateur non authentifié.' USING ERRCODE = '42501';
    END IF;

    SELECT tenant_id INTO v_tenant_id FROM public.users WHERE id = v_user_id;

    UPDATE public.clients
    SET
        drive_folders = p_drive_folders,
        updated_at = now()
    WHERE id = p_client_id
      AND (tenant_id = v_tenant_id OR is_platform_role());

    RETURN jsonb_build_object('success', true);
END;
$$;

-- 6. RPC delete_client_record (Rollback)
CREATE OR REPLACE FUNCTION public.delete_client_record(
    p_client_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Utilisateur non authentifié.' USING ERRCODE = '42501';
    END IF;

    SELECT tenant_id INTO v_tenant_id FROM public.users WHERE id = v_user_id;

    DELETE FROM public.clients
    WHERE id = p_client_id
      AND (tenant_id = v_tenant_id OR is_platform_role());

    RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_plan_details(UUID, TEXT, TEXT, TEXT, NUMERIC, TEXT, INT, BOOLEAN, TEXT[], INT, INT, BOOLEAN, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_client_record(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_client_drive_folders(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_client_record(UUID) TO authenticated;
