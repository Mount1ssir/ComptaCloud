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
   - `check_plan_limit(p_limit_key TEXT)`: Evaluates live tenant usage:
     - `max_accountants`: Counts all users `WHERE tenant_id = v_tenant_id`.
     - `max_clients`: Counts active clients `WHERE tenant_id = v_tenant_id AND status = 'active'`. (Archived clients do NOT count against quota).
   - `can_perform_with_plan(p_perm_key TEXT)`: Scope-aware RPC function:
     - `scope IN ('cabinet', 'platform')` $\rightarrow$ Evaluates **role-only** via `has_permission()`.
     - `scope = 'plan'` $\rightarrow$ Evaluates **dual-gated** via `has_permission() AND has_plan_permission()`.
   - `upsert_plan_details(...)`: SECURITY DEFINER RPC for creating/updating plans, atomic permission assignment, and limit seeding (`max_accountants`, `max_storage_gb`, `max_clients`).
4. **Permissions Generator & Drift Protection**:
   - Generator: `scripts/local-only/generate_permissions_reference.js` writing to `lib/permissions.gen.ts`.
   - Drift Check: `scripts/local-only/verify_permissions_drift.js` (`npm run permissions:verify`).

---

## 2. Completed Phases & Feature Index

### Phase A – G: Core Refactoring & Plan Cutover
- Dynamic RBAC schema deployed (`roles`, `permissions`, `role_permissions`, `users.role_id`).
- `subscriptions.plan_id` (FK to `plans.id`) is 100% authoritative for plan details and feature gating.

### Phase H: 6 Time-Boxed Platform & Cabinet Features
- **Feature 1 ("Recommandé" Badge)**: Migration `20260805000000_phase_h_plan_is_recommended.sql`, `upsert_plan_details` RPC updated, dialogs and plan cards badge rendered.
- **Feature 2 (Storage Limit Input Removal)**: Storage input removed from create/edit dialogs, defaults to `-1` (unlimited).
- **Feature 3 (Role Scope Selection)**: Super Admin role dialogs support Cabinet (`is_platform_role = false`) vs. Plateforme (`is_platform_role = true`).
- **Feature 4 (Dynamic Invite Role Dropdown)**: `invite-staff-dialog.tsx` renders dynamic cabinet roles (`is_platform_role = false`).
- **Feature 5 (`max_accountants` Total Team Limit)**: `check_plan_limit` counts `WHERE tenant_id = v_tenant_id` for all tenant members.
- **Feature 6 (Suspended Tenant Access Block & Sign-Out)**: `proxy.ts` redirects suspended users to `/suspended`; page features clean sign-out button.

### Phase I: Cabinet Admin Dashboard — White-Labeling & Client Management

#### Feature 1: White-Labeling & Brand Customization
- **Migrations**:
  - `20260806000000_phase_i_white_labeling.sql`: Adds `brand_logo_url`, `brand_primary_color`, `brand_secondary_color` to `public.tenants`, inserts `'branding:customize'` permission, wires into `pro` & `enterprise` plans, applies explicit column `GRANT UPDATE`, and sets up Supabase Storage bucket `'tenant-branding'`.
  - `20260806000001_phase_i_branding_rpc.sql`: `update_tenant_branding` SECURITY DEFINER RPC with RBAC, soft-fail plan entitlement checks (`42501`), and audit logging (`branding.update`).
- **Storage Security**: Storage bucket `'tenant-branding'` is public read. `INSERT`, `UPDATE`, `DELETE` RLS policies strictly enforce `(storage.foldername(name))[1] = get_my_tenant_id()::text` AND `(is_platform_role() OR can_perform_with_plan('branding:customize'))`.
- **UI & Layout**: `/dashboard/settings/branding` settings page with logo uploader, dual color pickers, live theme preview card, and CSS variable injection in root layout (`app/dashboard/layout.tsx`).
- **Verification Script**: `scripts/local-only/verify_phase_i_white_labeling.js` (PASSED 100%).

#### Feature 2: Client Management & Automated Google Drive Tree
- **Migrations**:
  - `20260806010000_phase_i_clients_schema.sql`: `public.clients` table (`id`, `tenant_id`, `name`, `client_type`, `email`, `phone`, `status`, `drive_folders`, `created_by`), RLS policies, and `plan_limits` key `'max_clients'` seeded per plan (`trial`: 3, `starter`: 10, `pro`: 50, `enterprise`: -1).
  - `20260806010001_phase_i_client_rpc.sql`: RPCs `create_client_record` (atomic active client quota check), `update_client_drive_folders`, `delete_client_record` (rollback), and `upsert_plan_details` overload update.
- **Server Action & Drive Automation**:
  - `createClientAction` (`app/dashboard/clients/actions.ts`):
    1. Call `create_client_record` RPC (DB Insert & quota check).
    2. If Google Drive is connected, create Root folder + 5 subfolders (`Charges`, `Salaires`, `Comptes`, `Contrats`, `Documents Généraux`) via Google Drive REST API v3.
    3. **Explicit Rollback**: If ANY Google Drive HTTP call fails, `catch` block explicitly calls `delete_client_record` RPC (deleting client DB row) and performs best-effort Drive folder cleanup.
    4. Call `update_client_drive_folders` RPC to persist folder metadata JSONB.
- **UI & Navigation**: `/dashboard/clients` management page with client table, status badges, folder shortcuts deep-linking into Drive, inline quota warning card, and `CreateClientDialog`.
- **Verification Script**: `scripts/local-only/verify_phase_i_client_management.js` (PASSED 100%).

---

## 3. Dedicated Credentials Reference

### Super Admin Dedicated Account
- **Email**: `supadmin@cabinetsplatform.com`
- **Password**: `mountassir`
- **Role**: `super_admin` (`is_platform_role = true`, `tenant_id = null`)
- **Seeding Script**: `node scripts/local-only/create_custom_super_admin.js`

### Core Plans Catalog
- **Essai Gratuit** (`trial`): Price = 0 MAD/month, Tier = 0, Max Clients = 3
- **Starter** (`starter`): Price = 290 MAD/month, Tier = 10, Max Clients = 10
- **Pro** (`pro`): Price = 790 MAD/month, Tier = 20, Max Clients = 50
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

# Phase I Feature 1: White-Labeling & Branding Isolated Verification
node scripts/local-only/verify_phase_i_white_labeling.js

# Phase I Feature 2: Client Management & Drive Automation Verification
node scripts/local-only/verify_phase_i_client_management.js

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
