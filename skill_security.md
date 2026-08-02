# security_skill.md — Security Architecture Reference

> **cabinets-platform** — Multi-Tenant Accounting SaaS
> Covers Phases 1–7 (schema through Google Drive BYOS integration)

---

## 1. Role Model

The platform defines four roles as a strict PostgreSQL enum:

```sql
CREATE TYPE user_role AS ENUM ('super_admin', 'cabinet_admin', 'accountant', 'client');
```

| Role | Who they are | Scope |
|---|---|---|
| `super_admin` | Platform operator | Full access to ALL tenants, NO tenant_id constraint |
| `cabinet_admin` | Owner of a single accounting firm | Full access to their own tenant data |
| `accountant` | Staff of a cabinet | Read access to their own tenant |
| `client` | Client of a cabinet | Read access to their own row only |

**Enforcement rule**: Every user except `super_admin` MUST have a `tenant_id`. This is enforced as a hard PostgreSQL constraint:

```sql
CONSTRAINT check_tenant_id_null_for_super_admin CHECK (
    (role = 'super_admin') OR (tenant_id IS NOT NULL)
)
```

---

## 2. How Security is Layered (Defence in Depth)

Security is enforced at **four independent layers**. A bypass of any single layer does NOT compromise the system.

```
Layer 1: Next.js Middleware (proxy.ts)   <- URL route access control
Layer 2: Server Action / Route Handler   <- app-level role check before DB writes
Layer 3: PostgreSQL RLS Policies         <- DB-level row filtering, enforced always
Layer 4: Column-Level GRANT (REVOKE)     <- restricts which columns can be written
```

---

## 3. Layer 1 — Next.js Middleware Route Protection (proxy.ts)

The middleware intercepts every non-static request before it reaches a page or API handler.

### What it does

1. Creates a @supabase/ssr server client and calls supabase.auth.getUser() to get the current session.
2. If unauthenticated, redirects /dashboard/* and /super-admin/* to / (login).
3. If authenticated, reads role from public.users via the RLS-enforced DB query.
4. Enforces role-route separation:
   - super_admin can only see /super-admin/*, is bounced away from /dashboard/* and /
   - cabinet_admin, accountant, client can only see /dashboard/*, are bounced away from /super-admin/*
5. /accept-invite is explicitly exempted from redirect.

### Routing rules

```ts
if (role === 'super_admin') {
  if (isDashboardRoute || isHomeRoute) redirect('/super-admin')
} else {
  if (isSuperAdminRoute || isHomeRoute) redirect('/dashboard')
}
```

> Note: The middleware does NOT replace database RLS. It only prevents UI navigation.
> All actual data isolation is enforced at Layer 3.

---

## 4. Layer 2 — Server Action / Route Handler Checks

Every Server Action and route handler performs an explicit application-level role check before touching the database:

```ts
const { data: callerProfile } = await supabase
  .from("users").select("role, tenant_id").eq("id", user.id).maybeSingle()

if (!callerProfile || callerProfile.role !== "cabinet_admin") {
  return { success: false, error: "Not authorized." }
}
```

This pattern is present in:
- inviteStaffAction — checks cabinet_admin before sending invite
- updateTeamMemberTitleAction — checks cabinet_admin before updating title
- disconnectDriveAction — checks cabinet_admin before clearing Drive tokens
- GET /api/drive/connect — checks cabinet_admin before initiating OAuth
- GET /api/drive/callback — checks cabinet_admin before saving refresh token

---

## 5. Layer 3 — PostgreSQL Row Level Security (RLS) Policies

RLS is enabled on every table from Phase 1:

```sql
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
```

PostgreSQL default-deny: With RLS enabled and no matching policy, a row is invisible.

### 5.1 Anon Role — Fully Revoked

```sql
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;
```

Unauthenticated browser clients get zero access to any table.

### 5.2 Super Admin Bypass Policies

```sql
CREATE POLICY super_admin_bypass_tenants ON tenants
    FOR ALL USING (is_super_admin()) WITH CHECK (is_super_admin());
-- Same pattern on subscriptions, users, logs
```

### 5.3 Self-Select Policy (all roles)

```sql
CREATE POLICY users_select_own ON users
    FOR SELECT USING (id = auth.uid());
```

Every authenticated user can read their own row in users — needed for the middleware to resolve their role.

### 5.4 Tenant Isolation Policies (Phase 5)

```sql
-- tenants: user sees only their own tenant row
CREATE POLICY tenant_isolation_tenants_select ON tenants
    FOR SELECT USING (id = get_my_tenant_id());

-- subscriptions: only cabinet_admin of that tenant can read
CREATE POLICY tenant_isolation_subscriptions_select ON subscriptions
    FOR SELECT USING (
        tenant_id = get_my_tenant_id()
        AND get_my_role() = 'cabinet_admin'
    );

-- users: cabinet_admin can read all users in their own tenant
CREATE POLICY tenant_isolation_users_select_cabinet_admin ON users
    FOR SELECT USING (
        tenant_id = get_my_tenant_id()
        AND get_my_role() = 'cabinet_admin'
    );
```

Result: An accountant from Tenant A CANNOT see any data belonging to Tenant B.

### 5.5 Title Update Policy (Phase 6)

```sql
CREATE POLICY tenant_isolation_users_update_title_cabinet_admin ON users
    FOR UPDATE
    USING (tenant_id = get_my_tenant_id() AND get_my_role() = 'cabinet_admin')
    WITH CHECK (tenant_id = get_my_tenant_id() AND get_my_role() = 'cabinet_admin');
```

### 5.6 Google Drive Update Policy (Phase 7)

```sql
CREATE POLICY tenant_isolation_tenants_update_drive_cabinet_admin ON tenants
    FOR UPDATE
    USING (id = get_my_tenant_id() AND get_my_role() = 'cabinet_admin')
    WITH CHECK (id = get_my_tenant_id() AND get_my_role() = 'cabinet_admin');
```

### Full RLS Policy Map

| Table | Policy Name | Operation | Who |
|---|---|---|---|
| tenants | super_admin_bypass_tenants | ALL | super_admin |
| tenants | tenant_isolation_tenants_select | SELECT | Any role (own tenant) |
| tenants | tenant_isolation_tenants_update_drive_cabinet_admin | UPDATE | cabinet_admin (own tenant, Drive cols only) |
| subscriptions | super_admin_bypass_subscriptions | ALL | super_admin |
| subscriptions | tenant_isolation_subscriptions_select | SELECT | cabinet_admin (own tenant) |
| users | super_admin_bypass_users | ALL | super_admin |
| users | users_select_own | SELECT | Any authenticated user (own row) |
| users | tenant_isolation_users_select_cabinet_admin | SELECT | cabinet_admin (own tenant) |
| users | tenant_isolation_users_update_title_cabinet_admin | UPDATE | cabinet_admin (own tenant) |
| logs | super_admin_bypass_logs | ALL | super_admin |

---

## 6. SECURITY DEFINER Helper Functions — Why They Exist

A naive RLS policy on the users table like:

```sql
-- BROKEN — causes infinite recursion:
USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'cabinet_admin'))
```

...creates infinite RLS recursion. The fix is SECURITY DEFINER functions that execute with
the definer's privileges (bypassing RLS) and return a cached lookup result.

### is_super_admin()

```sql
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin');
END;
$$;
```

### get_my_tenant_id()

```sql
CREATE OR REPLACE FUNCTION public.get_my_tenant_id()
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant_id UUID;
BEGIN
    SELECT tenant_id INTO v_tenant_id FROM users WHERE id = auth.uid();
    RETURN v_tenant_id;
END;
$$;
```

### get_my_role()

```sql
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS user_role LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_role user_role;
BEGIN
    SELECT role INTO v_role FROM users WHERE id = auth.uid();
    RETURN v_role;
END;
$$;
```

All three functions use SET search_path = public to prevent search_path injection attacks.

---

## 7. Layer 4 — Column-Level GRANT/REVOKE

Table-level REVOKE followed by column-level GRANT:

### users.title (Phase 6)

```sql
REVOKE UPDATE ON users FROM authenticated;
GRANT UPDATE (title) ON users TO authenticated;
```

Attempting UPDATE { role: 'super_admin' } returns PostgreSQL error 42501: permission denied for table users.

### tenants Drive columns (Phase 7)

```sql
REVOKE UPDATE ON tenants FROM authenticated;
GRANT UPDATE (
  google_drive_connected,
  google_drive_refresh_token_encrypted,
  google_drive_connected_at,
  google_drive_account_email
) ON tenants TO authenticated;
```

Attempting UPDATE { status: 'active' } returns 42501: permission denied for table tenants.

---

## 8. Automatic User Provisioning — handle_new_user Trigger

When Supabase creates a user in auth.users, the AFTER INSERT trigger automatically creates
a corresponding row in public.users, reading role and tenant_id from raw_user_meta_data.

If tenant_id is missing for a non-super_admin role, the trigger raises an exception,
preventing creation of tenant-less accounts that would become security orphans.

---

## 9. SECURITY DEFINER RPCs — Preventing Privilege Escalation

### create_tenant_with_subscription

```sql
IF NOT is_super_admin() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
END IF;
```

Even though SECURITY DEFINER bypasses RLS, the function manually checks is_super_admin()
before doing anything. A cabinet_admin calling this RPC is rejected immediately.

### save_tenant_drive_token

```sql
IF auth.role() <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'cabinet_admin' AND tenant_id = p_tenant_id
) THEN
    RAISE EXCEPTION 'not_authorized';
END IF;
```

Verifies the caller is a cabinet_admin of the specific tenant. Cross-tenant token writes are blocked.

---

## 10. Refresh Token Encryption — Google Drive BYOS

Google Drive OAuth refresh tokens are NEVER stored in plaintext.

### Encryption flow
1. Token received in OAuth callback handler (app/api/drive/callback/route.ts).
2. Sent to PostgreSQL via save_tenant_drive_token RPC.
3. Encrypted with pgcrypto.pgp_sym_encrypt(token, key) using DRIVE_TOKEN_ENCRYPTION_KEY.
4. Stored in tenants.google_drive_refresh_token_encrypted as BYTEA (encrypted binary blob).

### Decryption flow
1. Called only server-side from lib/google-drive/get-client.ts or disconnectDriveAction.
2. Uses get_tenant_drive_refresh_token RPC which calls pgp_sym_decrypt(blob, key).
3. The decrypted refresh token is NEVER sent to the browser.

Access tokens are minted fresh server-side per request and discarded after use.

---

## 11. Invite Flow Session Safety (/accept-invite)

### Bug that was fixed
When a cabinet_admin (already logged in) opened an invite link in the same browser,
getSession() returned the existing cabinet_admin session. updateUser({ password })
overwrote the cabinet_admin password instead of setting the invitee password.

### Fixed flow (strict order)

```
a. await supabase.auth.signOut()           -- purge ANY pre-existing session
b. Parse access_token + refresh_token from window.location.hash
c. await supabase.auth.setSession({ access_token, refresh_token })  -- URL tokens only
d. await supabase.auth.getUser()           -- verify & display target email on form
e. Enable form ONLY if setSession succeeded; show error if tokens are invalid/expired
f. await supabase.auth.updateUser({ password })  -- acts on session from step c only
```

The UI shows "Configuration du mot de passe pour: invited@example.com" for transparency.

---

## 12. Audit Logging

All sensitive actions write a row to the logs table:

| Action | Logged When |
|---|---|
| tenant_created: name (subdomain) | Super admin creates a cabinet |
| staff_invited: email as role | Cabinet admin invites a staff member |
| drive_connected | Cabinet admin connects Google Drive |
| drive_disconnected | Cabinet admin disconnects Google Drive |

Logs are append-only for non-super_admin (no DELETE policy exists for them).

---

## 13. Environment Variables — Secrets That Must Never Be Exposed

| Variable | Used For | Server-Only? |
|---|---|---|
| SUPABASE_SERVICE_ROLE_KEY | Admin client (bypasses RLS) for invite/seed scripts | YES |
| DRIVE_TOKEN_ENCRYPTION_KEY | AES key for pgcrypto refresh token encryption | YES |
| GOOGLE_DRIVE_CLIENT_SECRET | OAuth token exchange with Google | YES |
| NEXT_PUBLIC_SUPABASE_URL | Supabase project URL | Client-safe |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Anon/public key (scoped by RLS) | Client-safe |
| GOOGLE_DRIVE_CLIENT_ID | OAuth app identifier | Client-safe |
| NEXT_PUBLIC_SITE_URL | Base URL for OAuth redirects | Client-safe |

Rule: Any variable not prefixed NEXT_PUBLIC_ is inaccessible from client-side JavaScript.

---

## 14. What Each Role Can and Cannot Do

| Action | super_admin | cabinet_admin | accountant | client |
|---|---|---|---|---|
| See all tenants | YES | NO | NO | NO |
| See own tenant row | YES | YES | YES | YES |
| Create / suspend tenants | YES | NO | NO | NO |
| See all subscriptions | YES | own only | NO | NO |
| See all users in tenant | YES | own tenant only | NO | NO |
| Invite staff | YES | accountant/cab_admin | NO | NO |
| Update staff title | YES | own tenant only | NO | NO |
| Update tenant status/name | YES | NO (col-level REVOKE) | NO | NO |
| Connect / disconnect Drive | YES | own tenant only | NO | NO |
| See all audit logs | YES | NO | NO | NO |
