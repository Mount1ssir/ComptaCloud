-- Migration: Phase D Checkpoint 5 — Convert tenant_isolation_tenants_update_drive_cabinet_admin policy
-- Rule 1: Always include (is_super_admin() OR has_permission('drive:connect'))
-- Rule 2: Preserve tenant_id matching logic (id = get_my_tenant_id())
-- Rule 3: Column-level GRANT UPDATE on Drive columns ON tenants TO authenticated remains untouched
-- Rule 4: Include ROLLBACK definition as comment

-- ROLLBACK:
-- DROP POLICY IF EXISTS tenant_isolation_tenants_update_drive_cabinet_admin ON tenants;
-- CREATE POLICY tenant_isolation_tenants_update_drive_cabinet_admin ON tenants FOR UPDATE USING (id = get_my_tenant_id() AND get_my_role() = 'cabinet_admin') WITH CHECK (id = get_my_tenant_id() AND get_my_role() = 'cabinet_admin');

DROP POLICY IF EXISTS tenant_isolation_tenants_update_drive_cabinet_admin ON tenants;

CREATE POLICY tenant_isolation_tenants_update_drive_cabinet_admin ON tenants
    FOR UPDATE
    USING (
        id = get_my_tenant_id()
        AND (is_super_admin() OR has_permission('drive:connect'))
    )
    WITH CHECK (
        id = get_my_tenant_id()
        AND (is_super_admin() OR has_permission('drive:connect'))
    );
