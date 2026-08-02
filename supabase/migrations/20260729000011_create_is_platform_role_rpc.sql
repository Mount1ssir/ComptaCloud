-- Migration: Phase D Checkpoint 9 Preparation — Create is_platform_role helper RPC
-- Evaluates whether the calling user's assigned role (via users.role_id) has roles.is_platform_role = true
-- Explicitly GRANT EXECUTE to authenticated users

-- ROLLBACK:
-- DROP FUNCTION IF EXISTS public.is_platform_role();

CREATE OR REPLACE FUNCTION public.is_platform_role()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM users u
        JOIN roles r ON r.id = u.role_id
        WHERE u.id = auth.uid()
          AND r.is_platform_role = true
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_platform_role() TO authenticated;
