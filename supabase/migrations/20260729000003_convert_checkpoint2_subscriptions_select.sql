
DROP POLICY IF EXISTS tenant_isolation_subscriptions_select ON subscriptions;

CREATE POLICY tenant_isolation_subscriptions_select ON subscriptions
    FOR SELECT
    USING (
        tenant_id = get_my_tenant_id()
        AND (is_super_admin() OR has_permission('subscriptions:view'))
    );
