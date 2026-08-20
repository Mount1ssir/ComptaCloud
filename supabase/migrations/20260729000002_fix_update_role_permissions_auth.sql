-- Migration: Explicit Super Admin Authorization Check for update_role_permissions RPC
-- Re-declares update_role_permissions SECURITY DEFINER function with inline is_super_admin() check

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
    -- AUTHORIZATION CHECK: Must be first statement in function body
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
