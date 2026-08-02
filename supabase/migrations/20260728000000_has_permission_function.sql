
CREATE OR REPLACE FUNCTION public.has_permission(perm_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role_id UUID;
    v_result BOOLEAN;
BEGIN
    SELECT role_id INTO v_role_id FROM users WHERE id = auth.uid();
    IF v_role_id IS NULL THEN
        RETURN false;
    END IF;
    SELECT EXISTS(
        SELECT 1 FROM role_permissions rp
        JOIN permissions p ON p.id = rp.permission_id
        WHERE rp.role_id = v_role_id AND p.key = perm_key
    ) INTO v_result;
    RETURN v_result;
END;
$$;
