-- Migration: Phase D Checkpoint 8 Preparation — Create can_perform helper RPC
-- Combines is_super_admin() OR has_permission(perm_key) into a single RPC call
-- Explicitly GRANT EXECUTE to authenticated users

-- ROLLBACK:
-- DROP FUNCTION IF EXISTS public.can_perform(TEXT);

CREATE OR REPLACE FUNCTION public.can_perform(perm_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN (is_super_admin() OR has_permission(perm_key));
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_perform(TEXT) TO authenticated;
