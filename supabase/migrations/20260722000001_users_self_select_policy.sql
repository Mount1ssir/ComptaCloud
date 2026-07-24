-- Allow any authenticated user to read their OWN row
-- (needed so the app/middleware can look up their role and tenant_id)
CREATE POLICY users_select_own ON users
    FOR SELECT
    USING (id = auth.uid());
