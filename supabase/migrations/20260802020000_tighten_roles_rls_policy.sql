-- Migration: Phase D — Structural Role Visibility Separation (RLS)
-- Tightens authenticated_select_roles policy so platform roles (is_platform_role = true) are visible ONLY to super_admins.

DROP POLICY IF EXISTS authenticated_select_roles ON public.roles;

CREATE POLICY authenticated_select_roles ON public.roles
    FOR SELECT TO authenticated
    USING (
        is_super_admin() OR is_platform_role = false
    );
