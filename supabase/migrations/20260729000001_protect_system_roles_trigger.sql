-- Migration: Protect System Roles & Atomic Role Permissions RPC
-- Trigger prevents UPDATE (rename) or DELETE on system roles (is_system = true)
-- RPC function update_role_permissions allows atomic replacement of role_permissions

CREATE OR REPLACE FUNCTION public.protect_system_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' AND OLD.is_system = true THEN
        RAISE EXCEPTION 'Cannot delete a system role';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.is_system = true AND NEW.name <> OLD.name THEN
        RAISE EXCEPTION 'Cannot rename a system role';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE TRIGGER protect_system_roles_trigger
    BEFORE UPDATE OR DELETE ON public.roles
    FOR EACH ROW EXECUTE FUNCTION public.protect_system_roles();

-- Atomic RPC function for updating role permissions
CREATE OR REPLACE FUNCTION public.update_role_permissions(
    p_role_id UUID,
    p_permission_ids UUID[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT is_super_admin() THEN
        RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
    END IF;

    DELETE FROM public.role_permissions WHERE role_id = p_role_id;

    IF p_permission_ids IS NOT NULL AND array_length(p_permission_ids, 1) > 0 THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT p_role_id, unnest(p_permission_ids);
    END IF;

    RETURN true;
END;
$$;
