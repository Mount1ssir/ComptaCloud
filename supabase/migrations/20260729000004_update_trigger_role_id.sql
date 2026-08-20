-- Migration: Automatically populate users.role_id in handle_new_user trigger
-- Resolves the system role_id matching raw_user_meta_data->>'role' upon user creation

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    assigned_role public.user_role;
    assigned_tenant_id uuid;
    resolved_role_id uuid;
BEGIN
    assigned_role := COALESCE((new.raw_user_meta_data->>'role')::public.user_role, 'client'::public.user_role);
    assigned_tenant_id := (new.raw_user_meta_data->>'tenant_id')::uuid;

    -- Resolve matching system role_id
    SELECT id INTO resolved_role_id
    FROM public.roles
    WHERE name = assigned_role::text AND is_system = true;

    INSERT INTO public.users (id, email, role, tenant_id, role_id)
    VALUES (
        new.id,
        new.email,
        assigned_role,
        assigned_tenant_id,
        resolved_role_id
    );
    RETURN new;
END;
$$;
