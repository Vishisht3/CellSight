# CellSight Online Portal — Design

---

## 1. Data Model

### 1.1 New Table: `organizations`

```sql
CREATE TABLE IF NOT EXISTS organizations (
  id         TEXT PRIMARY KEY,
  name       TEXT UNIQUE NOT NULL,
  org_type   TEXT NOT NULL,          -- 'fleet_operator' | 'ev_manufacturer' | 'both' | 'demo'
  created_at TEXT NOT NULL
);
```

`org_type` drives the default post-login landing page:
- `fleet_operator` or `both` → `/fleet`
- `ev_manufacturer` → `/supply-chain`
- `demo` → `/fleet` (same as fleet_operator)

### 1.2 Schema Changes (existing tables)

`organization_id TEXT NOT NULL REFERENCES organizations(id)` is added to every tenant-owned table:

| Table | New column | Notes |
|---|---|---|
| `users` | `organization_id` | FK to organizations |
| `assets` | `organization_id` | FK to organizations |
| `suppliers` | `organization_id` | FK to organizations |
| `material_lots` | `organization_id` | FK to organizations |
| `cell_batches` | `organization_id` | FK to organizations |
| `battery_packs` | `organization_id` | FK to organizations |
| `alerts` | `organization_id` | FK to organizations |

`refresh_tokens`, `soh_history`, `telemetry_data`, and `batch_material_links` are **not** tenant-owned directly; they inherit isolation via their parent entity's `organization_id`.

### 1.3 Demo Organization

A reserved row is inserted at seed time:

```json
{ "id": "demo-org-00000000-0000-0000-0000-000000000000", "name": "__demo__", "org_type": "demo" }
```

All three demo users (`maintenance@cellsight.com`, `fleet@cellsight.com`, `supply@cellsight.com`) are assigned `organization_id = 'demo-org-...'`. Real sign-ups are blocked from using the name `__demo__`.

---

## 2. Entity Relationship (relevant tables only)

```
organizations
    │ id (PK)
    │ name
    │ org_type
    │
    ├──< users            (organization_id FK)
    ├──< suppliers        (organization_id FK)
    │       └──< material_lots   (organization_id FK)
    │               └──< batch_material_links
    ├──< cell_batches     (organization_id FK)
    │       └──< battery_packs   (organization_id FK)
    │               └──< assets  (organization_id FK)
    │                       └──< telemetry_data
    │                       └──< soh_history
    └──< alerts           (organization_id FK)
```

---

## 3. API Changes

### 3.1 New endpoint: `POST /api/auth/signup`

**Request body:**
```json
{
  "companyName": "Acme Fleet Co.",
  "orgType": "fleet_operator",
  "email": "alice@acme.com",
  "password": "••••••••"
}
```

**Response 201:**
```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<token>",
  "user": { "id": "...", "email": "alice@acme.com", "role": "admin", "organizationId": "..." },
  "organization": { "id": "...", "name": "Acme Fleet Co.", "orgType": "fleet_operator" }
}
```

**Error cases:**
- `409 Conflict` — organization name already taken
- `400 Bad Request` — validation failure (invalid orgType, weak password, malformed email)

### 3.2 JWT Claims Update

Access tokens now include `organizationId`:

```json
{ "userId": "...", "email": "...", "role": "fleet_manager", "organizationId": "..." }
```

### 3.3 Tenant-Scoped Endpoints

Every endpoint that returns a list or performs a lookup now requires `organizationId` from `req.user` and passes it to the repository layer. No route-level changes are needed beyond passing the claim through; all scoping happens in repositories.

---

## 4. Repository Scoping Pattern

Every repository method that previously returned all rows now accepts `organizationId` as a required parameter and appends `WHERE organization_id = ?` to its query.

**Before:**
```typescript
list(): Asset[] {
  return this.db.prepare(`SELECT ... FROM assets ORDER BY created_at DESC`).all() as Asset[];
}
```

**After:**
```typescript
list(organizationId: string): Asset[] {
  return this.db.prepare(
    `SELECT ... FROM assets WHERE organization_id = ? ORDER BY created_at DESC`
  ).all(organizationId) as Asset[];
}
```

All callers (route handlers, background tasks, services) already receive `dbContext` and `req.user`, so `organizationId` is always available without additional lookups.

---

## 5. Sign-Up Sequence Diagram

```
Browser                  API                    Database
  │                        │                        │
  │  POST /auth/signup     │                        │
  │ ─────────────────────> │                        │
  │                        │  validate body         │
  │                        │  check org name unique ─────────────> SELECT FROM organizations
  │                        │ <──────────────────────────────────── [] (not found → OK)
  │                        │                        │
  │                        │  INSERT organization ──────────────> organizations row
  │                        │  INSERT user (admin) ──────────────> users row (org_id = new org)
  │                        │  issue JWT + refresh token          │
  │                        │                        │
  │  201 { tokens, user,   │                        │
  │        organization }  │                        │
  │ <───────────────────── │                        │
  │                        │                        │
  │  redirect to /fleet    │                        │
  │  or /supply-chain      │                        │
  │  (based on orgType)    │                        │
```

---

## 6. AI Layer Upgrades

### 6.1 SoH: Linear Regression Model

**Current approach:** Hard-coded formula — `cycleDegradation + voltageFade + tempStress` with fixed coefficients.

**New approach:** Ordinary least-squares (OLS) regression trained in-process on the synthetic demo fleet data. The model is fit once at service startup and cached.

**Feature vector per telemetry window:**
```
[totalCycles, avgVoltage, avgTemperature, avgStateOfCharge, voltageStdDev, tempStdDev]
```

**Target:** SoH computed from the existing formula on the training data (bootstrap from synthetic ground truth).

**Training procedure:**
1. At `SohCalculationService` construction, call `trainModel()`.
2. Collect all assets that have ≥ `TELEMETRY_MIN_HISTORY_POINTS` records.
3. For each asset, build (features, label) pairs using sliding 100-point windows.
4. Fit OLS coefficients using the normal equation: `β = (XᵀX)⁻¹Xᵀy`.
5. Store `β` in memory; if fewer than 10 assets are available, fall back to the rule-based formula.

**Prediction error reporting:** After fitting, hold out 20 % of windows and compute RMSE. Log `modelRmse` alongside every SoH calculation.

**Interface:** Identical to the existing `calculateSoh(assetId)` — no callers need to change.

### 6.2 Correlation: Z-Score Anomaly Detection

**Current approach:** Flag any batch/supplier whose degradation rate exceeds the fleet average by a fixed percentage threshold (20 % for batches, 15 % for suppliers).

**New approach:** Compute the population z-score for each entity's average degradation rate against the fleet distribution (mean μ, standard deviation σ). Flag any entity with `z > 2.0` as a statistical outlier.

```
z = (entity_avg_rate - μ) / σ
```

**Advantages over flat-threshold:**
- Self-calibrating: as fleet data accumulates, the threshold tightens.
- Eliminates false positives during early data collection (low σ when fleet is uniform).
- Maps directly to a 95th-percentile significance level.

**Fallback:** If `σ = 0` (all entities have identical rates), no alerts are generated.

**Interface:** `generateBatchInsights()` and `generateSupplierInsights()` signatures are unchanged.

---

## 7. Frontend Changes

### 7.1 New Page: `SignUpPage.tsx`

Route: `/signup`

Fields:
- Company name (text)
- Organization type (select: Fleet Operator / EV Manufacturer / Both)
- Work email (email input)
- Password + confirm password (with strength indicator)

Styled consistently with `LoginPage.tsx` (same Windows 2007 enterprise theme — gradient title bar, fieldset form, win-btn classes).

On success: stores tokens identically to login flow, redirects based on `orgType`.

### 7.2 `LoginPage.tsx` Change

Add a "Create account" / "Sign up your company" link below the form that navigates to `/signup`.

### 7.3 `useAuth.tsx` / `types/index.ts`

Add `Organization` type and `organizationId` field to `User`. `AuthProvider` stores and exposes the current org.

---

## 8. Backward Compatibility

- Existing demo accounts continue to work: they belong to `__demo__` org, all their data is scoped to that org.
- The `register` endpoint (`POST /api/auth/register`) is kept for internal/test use but requires `organizationId` in the body.
- The database migration (adding `organization_id` columns) uses `ALTER TABLE ... ADD COLUMN organization_id TEXT` with a default pointing to the `__demo__` org so existing rows are not orphaned.
- All background tasks (`scheduler`) already use the full `DatabaseContext`; they will call the scoped list methods. For demo mode the tasks pass the demo org ID.
