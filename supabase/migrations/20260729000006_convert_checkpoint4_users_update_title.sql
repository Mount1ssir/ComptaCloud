-- Migration: Phase D Checkpoint 4 — Convert tenant_isolation_users_update_title_cabinet_admin policy
-- Rule 1: Always include (is_super_admin() OR has_permission('team:update_title'))
-- Rule 2: Preserve tenant_id matching logic (tenant_id = get_my_tenant_id())
-- Rule 3: Column-level GRANT UPDATE (title) ON users TO authenticated remains untouched
-- Rule 4: Include ROLLBACK definition as comment

-- ROLLBACK:
-- DROP POLICY IF EXISTS tenant_isolation_users_update_title_cabinet_admin ON users;
-- CREATE POLICY tenant_isolation_users_update_title_cabinet_admin ON users FOR UPDATE USING (tenant_id = get_my_tenant_id() AND get_my_role() = 'cabinet_admin') WITH CHECK (tenant_id = get_my_tenant_id() AND get_my_role() = 'cabinet_admin');

DROP POLICY IF EXISTS tenant_isolation_users_update_title_cabinet_admin ON users;

CREATE POLICY tenant_isolation_users_update_title_cabinet_admin ON users
    FOR UPDATE
    USING (
        tenant_id = get_my_tenant_id()
        AND (is_super_admin() OR has_permission('team:update_title'))
    )
    WITH CHECK (
        tenant_id = get_my_tenant_id()
        AND (is_super_admin() OR has_permission('team:update_title'))
    );
