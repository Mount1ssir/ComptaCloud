
DROP POLICY IF EXISTS tenant_isolation_tenants_select ON tenants;

CREATE POLICY tenant_isolation_tenants_select ON tenants
    FOR SELECT
    USING (is_super_admin() OR id = get_my_tenant_id());
