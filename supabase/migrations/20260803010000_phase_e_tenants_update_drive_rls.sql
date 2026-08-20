-- Migration: Phase E.2.5 — Plan-aware tenant_isolation_tenants_update_drive_cabinet_admin RLS policy conversion
-- Updates RLS policy on public.tenants to use can_perform_with_plan('drive:connect')

DROP POLICY IF EXISTS tenant_isolation_tenants_update_drive_cabinet_admin ON public.tenants;

CREATE POLICY tenant_isolation_tenants_update_drive_cabinet_admin ON public.tenants
    FOR UPDATE
    TO authenticated
    USING (
        id = get_my_tenant_id()
        AND (is_super_admin() OR can_perform_with_plan('drive:connect'))
    )
    WITH CHECK (
        id = get_my_tenant_id()
        AND (is_super_admin() OR can_perform_with_plan('drive:connect'))
    );
