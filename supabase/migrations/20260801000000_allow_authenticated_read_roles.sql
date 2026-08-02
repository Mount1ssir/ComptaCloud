-- Migration: Grant SELECT on public.roles to authenticated users
-- Enables PostgREST foreign key embedding (users.role_id -> roles(name)) for authenticated sessions

CREATE POLICY authenticated_select_roles ON public.roles
    FOR SELECT
    TO authenticated
    USING (true);
