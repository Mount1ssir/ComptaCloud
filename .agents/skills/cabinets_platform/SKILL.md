---
name: cabinets_platform_audit
description: Comprehensive technical architecture, database schema, completed features, recent changes, and next technical steps for Cabinets Platform.
---

# Cabinets Platform — Complete Technical Architecture & Features Reference

## 1. Project Architecture & Tech Stack

### Core Technologies
- **Framework**: Next.js 16.2.6 (App Router, Turbopack)
- **Backend / Database**: PostgreSQL 15 on Supabase (Local Docker environment)
- **State & Auth**: Supabase Auth (`@supabase/supabase-js`, `@supabase/ssr`), SSR cookie session handling via `proxy.ts` middleware.
- **Language & Styling**: TypeScript (Strict Mode), Vanilla CSS with Tailwind Tokens / Shadcn UI components.

### Security & Access Control Primitives
1. **Dynamic RBAC Tables**:
   - `public.roles` (`id`, `name`, `is_system`, `is_platform_role`, `tenant_id`, `created_at`)
   - `public.permissions` (`id`, `key`, `label`, `category`, `scope`)
   - `public.role_permissions` (`role_id`, `permission_id`)
   - `users.role_id` (FK to `public.roles.id`) and `users.role_legacy` (enum column retained for legacy compatibility)
2. **Subscription Plans & Quota Tables**:
   - `public.plans` (`id`, `name`, `slug`, `tier_rank`, `description`, `price_monthly`, `currency`, `is_active`, `is_recommended`)
   - `public.plan_permissions` (`plan_id`, `permission_id`)
   - `public.plan_limits` (`plan_id`, `limit_key`, `limit_value`)
   - `public.subscriptions` (`tenant_id`, `plan_id` [FK to `plans.id`], `plan_legacy`, `status`)
3. **Database SECURITY DEFINER RPC Primitives**:
   - `is_super_admin()`: Returns `true` if caller's `users.role_id` points to a role with `is_platform_role = true` and `tenant_id IS NULL`.
   - `is_platform_role()`: Checks if caller holds a platform-level management role (`is_platform_role = true`).
   - `has_permission(perm_key TEXT)`: Evaluates role-based permissions (`role_permissions`).
   - `has_plan_permission(p_perm_key TEXT)`: Evaluates subscription plan authorization for `scope = 'plan'` permissions.
   - `check_plan_limit(p_limit_key TEXT)`: Evaluates live tenant usage (e.g. `max_accountants` counting all tenant users `WHERE tenant_id = v_tenant_id`) against `plan_limits.limit_value`. Returns JSON payload `{ allowed, current_count, limit_value, remaining, message }`.
   - `can_perform_with_plan(p_perm_key TEXT)`: Scope-aware RPC function:
     - `scope IN ('cabinet', 'platform')` $\rightarrow$ Evaluates **role-only** via `has_permission()`.
     - `scope = 'plan'` $\rightarrow$ Evaluates **dual-gated** via `has_permission() AND has_plan_permission()`.
   - `upsert_plan_details(...)`: Security DEFINER RPC for creating/updating plans and atomic permission assignment.
4. **Permissions Generator & Drift Protection**:
   - Generator: `scripts/local-only/generate_permissions_reference.js` writing to `lib/permissions.gen.ts`.
   - Drift Check: `scripts/local-only/verify_permissions_drift.js` (`npm run permissions:verify`).

---

## 2. Completed Phases & Feature Index

### Phase A – F: Core Refactoring & Dynamic Permissions
- System roles seeded (`super_admin`, `cabinet_admin`, `accountant`, `client`).
- Dynamic RBAC schema deployed (`roles`, `permissions`, `role_permissions`, `users.role_id`).
- All server actions, API routes, and RLS policies updated to inspect dynamic permissions and `is_platform_role()`.

### Phase G: Plan Foreign Key Cutover & Legacy Column Rename
- Migration [`20260803050000_phase_g_rename_subscriptions_plan_column.sql`](file:///c:/Users/HP/Desktop/New%20folder/cabinets-platform/supabase/migrations/20260803050000_phase_g_rename_subscriptions_plan_column.sql) renamed `subscriptions.plan` to `subscriptions.plan_legacy`.
- `subscriptions.plan_id` (FK to `plans.id`) is 100% authoritative for plan details and features.
- All write RPCs (`create_tenant_with_admin_invite`, `create_tenant_with_subscription`, `updateSubscriptionAction`) maintain `plan_id` as primary while writing `plan_legacy` for fallback.
- Read queries join through `subscriptions.plan_id` to `plans`. Added fail-closed recovery UI badge `"Plan non configuré (plan_id manquant)"` with inline Super Admin plan assign dropdown.

### Phase H: 6 Time-Boxed Platform & Cabinet Features

#### Feature 1: "Recommandé" Badge on Plans
- **Database**: Migration [`20260805000000_phase_h_plan_is_recommended.sql`](file:///c:/Users/HP/Desktop/New%20folder/cabinets-platform/supabase/migrations/20260805000000_phase_h_plan_is_recommended.sql) added `is_recommended BOOLEAN NOT NULL DEFAULT false` to `public.plans` and updated `upsert_plan_details` RPC.
- **Server Actions**: Updated `PlanFormData`, `createPlanAction`, and `updatePlanAction` in [`app/super-admin/plans-actions.ts`](file:///c:/Users/HP/Desktop/New%20folder/cabinets-platform/app/super-admin/plans-actions.ts).
- **UI Components**: Updated [`create-plan-dialog.tsx`](file:///c:/Users/HP/Desktop/New%20folder/cabinets-platform/components/create-plan-dialog.tsx) and [`edit-plan-dialog.tsx`](file:///c:/Users/HP/Desktop/New%20folder/cabinets-platform/components/edit-plan-dialog.tsx) with "Marquer comme recommandé" checkbox. Updated [`app/super-admin/plans/page.tsx`](file:///c:/Users/HP/Desktop/New%20folder/cabinets-platform/app/super-admin/plans/page.tsx) to render a top badge on cards where `is_recommended === true`.

#### Feature 2: Storage Quota UI Cleanup
- **UI**: Removed "Stockage GB max" input field from plan creation and editing dialogs. Form data defaults `max_storage_gb` to `-1` (unlimited) as storage is managed via Google Drive BYOS.

#### Feature 3: Role Scope Selection (Platform vs. Cabinet)
- **Server Actions**: Updated `createRoleAction(name, isPlatformRole)` in [`app/super-admin/roles-actions.ts`](file:///c:/Users/HP/Desktop/New%20folder/cabinets-platform/app/super-admin/roles-actions.ts).
- **UI Component**: Updated [`create-role-dialog.tsx`](file:///c:/Users/HP/Desktop/New%20folder/cabinets-platform/components/create-role-dialog.tsx) to include a "Portée / Type de rôle" selector: Cabinet (`is_platform_role = false`) or Plateforme (`is_platform_role = true`).

#### Feature 4: Dynamic Cabinet-Scoped Role Invites
- **UI Component**: Updated [`invite-staff-dialog.tsx`](file:///c:/Users/HP/Desktop/New%20folder/cabinets-platform/components/invite-staff-dialog.tsx) and [`app/dashboard/team/page.tsx`](file:///c:/Users/HP/Desktop/New%20folder/cabinets-platform/app/dashboard/team/page.tsx) to fetch and render dynamic cabinet roles (`WHERE is_platform_role = false`).
- **Server Action Validation**: Updated [`inviteStaffAction`](file:///c:/Users/HP/Desktop/New%20folder/cabinets-platform/app/dashboard/actions.ts) to query `public.roles` and reject any role where `is_platform_role === true` (hard security boundary).

#### Feature 5: Total Team Member Limit (`max_accountants`)
- **Database**: Migration [`20260805010000_phase_h_team_member_limit_rpc.sql`](file:///c:/Users/HP/Desktop/New%20folder/cabinets-platform/supabase/migrations/20260805010000_phase_h_team_member_limit_rpc.sql) updated `check_plan_limit` to count all team members in the tenant (`WHERE u.tenant_id = v_tenant_id`).
- **Server Actions**: Removed `if (role === "accountant")` check in [`inviteStaffAction`](file:///c:/Users/HP/Desktop/New%20folder/cabinets-platform/app/dashboard/actions.ts) so quota checks execute unconditionally for all user invitations, with updated error message ("membres d'équipe").

#### Feature 6: Suspended Cabinet Access Block & Clean Sign-Out
- **Middleware Guard**: Updated [`proxy.ts`](file:///c:/Users/HP/Desktop/New%20folder/cabinets-platform/proxy.ts) so non-platform users belonging to a tenant with `status === 'suspended'` attempting to access `/dashboard/*` are redirected to `/suspended`.
- **Suspended Page**: Created [`app/suspended/page.tsx`](file:///c:/Users/HP/Desktop/New%20folder/cabinets-platform/app/suspended/page.tsx) displaying a clear "Cabinet suspendu" notice with a sign-out button calling `await supabase.auth.signOut()` and navigating to `/`.
- **Bypass**: Super Admin (`tenant_id = null`) bypasses tenant status gates completely.

#### Auth Trigger Enhancement
- **Database**: Migration [`20260805020000_fix_handle_new_user_trigger.sql`](file:///c:/Users/HP/Desktop/New%20folder/cabinets-platform/supabase/migrations/20260805020000_fix_handle_new_user_trigger.sql) updated `handle_new_user()` trigger to safely handle legacy enum casting, custom role name resolution, and `role_id` lookup.

---

## 3. Dedicated Credentials & Accounts

### Super Admin Dedicated Account
- **Email**: `supadmin@cabinetsplatform.com`
- **Password**: `mountassir`
- **Role**: `super_admin` (`is_platform_role = true`, `tenant_id = null`)
- **Seeding Script**: `node scripts/local-only/create_custom_super_admin.js`

### Core Plans Catalog
- **Essai Gratuit** (`trial`): Price = 0 MAD/month, Tier = 0
- **Starter** (`starter`): Price = 290 MAD/month, Tier = 10
- **Pro** (`pro`): Price = 790 MAD/month, Tier = 20
- **Seeding Script**: `node scripts/local-only/seed_user_plans.js`

### Role Dedicated Test Accounts

| Role | Email | Password | Tenant / Plan |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `supadmin@cabinetsplatform.com` | `mountassir` | Platform-wide (`tenant_id = null`) |
| **Cabinet Admin** | `user.admin@cabinet.com` | `Password123!` | Cabinet User Platform (`pro` plan) |
| **Accountant** | `user.accountant@cabinet.com` | `Password123!` | Cabinet User Platform (`pro` plan) |
| **Client** | `user.client@cabinet.com` | `Password123!` | Cabinet User Platform (`pro` plan) |

*Re-seed script*: `node scripts/local-only/create_user_requested_accounts.js`

---

## 4. Verification Suite & Script Commands

```bash
# Type check (0 errors)
npx tsc --noEmit

# Feature 3: Platform vs Cabinet Role Creation & Isolation
node scripts/local-only/verify_feature3_platform_role.js

# Feature 4 & 5: Dynamic Roles & Total Team Member Limit
node scripts/local-only/verify_feature4_and_5.js

# Feature 6: Suspended Cabinet Access Block & Sign-Out
node scripts/local-only/verify_feature6_suspended_tenant.js

# Plans Management & RPC E2E
node scripts/local-only/verify_phase_f_plans_management_e2e.js

# Multi-Tenant RLS & Data Isolation
node scripts/local-only/verify_tenant_isolation_rls.js

# Security Definer RPC Execution & Grants
node scripts/local-only/verify_is_platform_role.js
```

---

## 5. Current Issues & Backlog Status

- **Failing Tests / Lints**: **0 Errors**. `npx tsc --noEmit` and all automated test scripts pass 100%.
- **Tracked Backlog Items**:
  - OAuth `state` CSRF nonce validation in `app/api/drive/callback/route.ts` queued for future hardening sprint.
