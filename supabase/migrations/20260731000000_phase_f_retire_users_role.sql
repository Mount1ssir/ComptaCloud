-- Migration: Phase F — Retire users.role in favor of users.role_id
-- Renames users.role column to users.role_legacy
-- Adds deprecation SQL comment
-- Updates handle_new_user trigger to reference role_legacy
-- Updates is_super_admin() and get_my_role() helper functions to use role_id / role_legacy

-- 1. Rename column
ALTER TABLE public.users RENAME COLUMN role TO role_legacy;

-- 2. Add Deprecation Comment
COMMENT ON COLUMN public.users.role_legacy IS 'DEPRECATED: Superseded by role_id -> roles/permissions as of Phase F dynamic permissions migration.';

-- 3. Update handle_new_user trigger to populate role_legacy and role_id
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

    INSERT INTO public.users (id, email, role_legacy, tenant_id, role_id)
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

-- 4. Update is_super_admin() function to use users.role_id -> roles.is_platform_role
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.users u
        JOIN public.roles r ON r.id = u.role_id
        WHERE u.id = auth.uid()
          AND r.is_platform_role = true
    );
END;
$$;

-- 5. Update get_my_role() function to use users.role_legacy
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS user_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role user_role;
BEGIN
    SELECT role_legacy INTO v_role FROM public.users WHERE id = auth.uid();
    RETURN v_role;
END;
$$;
