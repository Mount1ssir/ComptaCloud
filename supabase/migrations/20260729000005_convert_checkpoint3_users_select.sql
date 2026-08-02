-- Migration: Phase D Checkpoint 3 — Convert tenant_isolation_users_select_cabinet_admin policy
-- Rule 1: Always include (is_super_admin() OR has_permission('team:view'))
-- Rule 2: Preserve tenant_id matching logic (tenant_id = get_my_tenant_id())
-- Rule 4: Include ROLLBACK definition as comment

-- ROLLBACK:
-- DROP POLICY IF EXISTS tenant_isolation_users_select_cabinet_admin ON users;
-- CREATE POLICY tenant_isolation_users_select_cabinet_admin ON users FOR SELECT USING (tenant_id = get_my_tenant_id() AND get_my_role() = 'cabinet_admin');

DROP POLICY IF EXISTS tenant_isolation_users_select_cabinet_admin ON users;

CREATE POLICY tenant_isolation_users_select_cabinet_admin ON users
    FOR SELECT
    USING (
        tenant_id = get_my_tenant_id()
        AND (is_super_admin() OR has_permission('team:view'))
    );
