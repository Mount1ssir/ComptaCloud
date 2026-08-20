-- Migration: Phase I Feature 1 — First-Login Branding Prompt Dismissal

-- 1. Add branding_prompt_dismissed column to public.tenants
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS branding_prompt_dismissed BOOLEAN NOT NULL DEFAULT false;

-- 2. Grant UPDATE on branding_prompt_dismissed to authenticated
GRANT UPDATE (
  branding_prompt_dismissed
) ON public.tenants TO authenticated;

-- 3. Update update_tenant_branding RPC to set branding_prompt_dismissed = true on save
CREATE OR REPLACE FUNCTION public.update_tenant_branding(
    p_logo_url TEXT,
    p_primary_color TEXT,
    p_secondary_color TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
BEGIN
    -- 1. Resolve caller user ID
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Utilisateur non authentifié.' USING ERRCODE = '42501';
    END IF;

    -- 2. Resolve caller tenant ID
    SELECT tenant_id INTO v_tenant_id FROM public.users WHERE id = v_user_id;
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Aucun cabinet associé à votre compte.' USING ERRCODE = '42501';
    END IF;

    -- 3. Entitlement & Authorization check: Must have branding:customize permission on active plan (or be Super Admin)
    IF NOT (is_platform_role() OR can_perform_with_plan('branding:customize')) THEN
        RAISE EXCEPTION 'La personnalisation de la marque nécessite un forfait supérieur.' USING ERRCODE = '42501';
    END IF;

    -- 4. Update tenant branding columns & set branding_prompt_dismissed = true
    UPDATE public.tenants
    SET
        brand_logo_url = p_logo_url,
        brand_primary_color = p_primary_color,
        brand_secondary_color = p_secondary_color,
        branding_prompt_dismissed = true
    WHERE id = v_tenant_id;

    -- 5. Insert audit log record
    INSERT INTO public.logs (user_id, action)
    VALUES (v_user_id, 'branding.update: ' || v_tenant_id::text);

    RETURN jsonb_build_object(
        'success', true,
        'tenant_id', v_tenant_id,
        'brand_logo_url', p_logo_url,
        'brand_primary_color', p_primary_color,
        'brand_secondary_color', p_secondary_color,
        'branding_prompt_dismissed', true
    );
END;
$$;

-- 4. RPC to allow Cabinet Admin to dismiss the branding prompt ("Plus tard")
CREATE OR REPLACE FUNCTION public.dismiss_branding_prompt()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Utilisateur non authentifié.' USING ERRCODE = '42501';
    END IF;

    SELECT tenant_id INTO v_tenant_id FROM public.users WHERE id = v_user_id;
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Aucun cabinet associé à votre compte.' USING ERRCODE = '42501';
    END IF;

    UPDATE public.tenants
    SET branding_prompt_dismissed = true
    WHERE id = v_tenant_id;

    RETURN jsonb_build_object('success', true, 'tenant_id', v_tenant_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.dismiss_branding_prompt() TO authenticated;
