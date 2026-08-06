-- Migration: Fix handle_new_user trigger to write role_legacy safely and resolve role_id by name

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role_name text;
    v_tenant_id uuid;
    resolved_role_id uuid;
BEGIN
    v_role_name := COALESCE(new.raw_user_meta_data->>'role', 'client');
    v_tenant_id := (new.raw_user_meta_data->>'tenant_id')::uuid;

    SELECT id INTO resolved_role_id
    FROM public.roles
    WHERE name = v_role_name
    LIMIT 1;

    IF resolved_role_id IS NULL THEN
        SELECT id INTO resolved_role_id FROM public.roles WHERE name = 'client' LIMIT 1;
    END IF;

    INSERT INTO public.users (id, email, role_legacy, tenant_id, role_id)
    VALUES (
        new.id,
        new.email,
        CASE 
          WHEN v_role_name IN ('super_admin', 'cabinet_admin', 'accountant', 'client') THEN v_role_name::public.user_role 
          ELSE 'client'::public.user_role 
        END,
        v_tenant_id,
        resolved_role_id
    );
    RETURN new;
END;
$$;
