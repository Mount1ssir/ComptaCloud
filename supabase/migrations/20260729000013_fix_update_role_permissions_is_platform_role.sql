-- Migration: Update update_role_permissions RPC to check is_platform_role()
-- Replaces inline is_super_admin() with is_platform_role() per Checkpoint 10 standards.

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
    -- AUTHORIZATION CHECK: Caller must have a platform management role
    IF NOT is_platform_role() THEN
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

GRANT EXECUTE ON FUNCTION public.update_role_permissions(UUID, UUID[]) TO authenticated;
