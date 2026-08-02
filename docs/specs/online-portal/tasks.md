# CellSight Online Portal — Implementation Tasks

---

## Phase 1: Schema & Constants

### Task 1.1 — Add `OrgType` enum to `src/config/constants.ts`
```typescript
export enum OrgType {
  FLEET_OPERATOR   = 'fleet_operator',
  EV_MANUFACTURER  = 'ev_manufacturer',
  BOTH             = 'both',
  DEMO             = 'demo',
}
```
Also add `DEMO_ORG_ID` and `DEMO_ORG_NAME` constants.

### Task 1.2 — Update `src/database/schema.ts`
- Add `CREATE TABLE IF NOT EXISTS organizations (...)` DDL before the `users` table.
- Add `ALTER TABLE ... ADD COLUMN organization_id TEXT` for: `users`, `assets`, `suppliers`, `material_lots`, `cell_batches`, `battery_packs`, `alerts`.
- Use `execAsync` for all DDL so Railway startup is non-blocking (REQ-11.1).
- Insert the `__demo__` org row with `INSERT OR IGNORE`.

---

## Phase 2: Repository Layer

### Task 2.1 — Create `src/database/repositories/OrganizationRepository.ts`
Methods: `create(input)`, `findById(id)`, `findByName(name)`, `list()`.

### Task 2.2 — Update `src/database/repositories/UserRepository.ts`
- Add `organization_id` column to all SELECT projections.
- `create()` accepts and persists `organizationId`.
- Add `findByEmailAndOrg(email, organizationId)` for scoped lookup.

### Task 2.3 — Scope `AssetRepository`
- `list(organizationId)` — add `WHERE organization_id = ?`
- `listByStatus(status, organizationId)` — add tenant filter
- `getFleetSummary(organizationId)` — add tenant filter to COUNT/AVG
- `create()` — accept and persist `organizationId`

### Task 2.4 — Scope `AlertRepository`
- `list(organizationId, status?, limit?)` — add `WHERE organization_id = ?`
- `listByAsset(assetId, organizationId, limit?)` — add tenant filter
- `listBySupplier(supplierId, organizationId, limit?)` — add tenant filter
- `create()` — accept and persist `organizationId`
- `countByStatus(status, organizationId)` — add tenant filter

### Task 2.5 — Scope `MaterialRepository`
- `list(organizationId)` — add tenant filter
- `listBySupplier(supplierId, organizationId)` — add tenant filter
- `create()` — accept and persist `organizationId`
- `getSupplierConcentration(materialType, organizationId)` — add tenant filter

### Task 2.6 — Scope `CellBatchRepository`
- `listBatches(organizationId)` — add tenant filter
- `createBatch()` — accept and persist `organizationId`
- `createPack()` — accept and persist `organizationId`
- `listPacks(organizationId)` — add tenant filter

### Task 2.7 — Scope `SupplierRepository`
- `list(organizationId)` — add tenant filter
- `listByTier(tier, organizationId)` — add tenant filter
- `create()` — accept and persist `organizationId`
- `getSummary(organizationId)` — add tenant filter to aggregates

### Task 2.8 — Update `src/database/index.ts`
- Import and instantiate `OrganizationRepository`.
- Add `orgs: OrganizationRepository` to `DatabaseContext`.

---

## Phase 3: Auth & Middleware

### Task 3.1 — Update `src/services/AuthService.ts`
- `signup(input: { companyName, orgType, email, password })`:
  1. Check org name not `__demo__` and not already taken → `409` otherwise.
  2. `orgs.create(...)` → new organization.
  3. `users.create({ ..., organizationId: org.id, role: 'admin' })`.
  4. Call `issueTokenPair(user)` and return `{ tokens, user, organization }`.
- `issueTokenPair` — add `organizationId` to the JWT payload.
- `verifyToken` — return `{ userId, email, role, organizationId }`.

### Task 3.2 — Update `src/middleware/auth.ts`
- Extend `req.user` type to include `organizationId: string`.
- Destructure `organizationId` from `verifyToken` result and set on `req.user`.

### Task 3.3 — Update `src/api/routes/auth.routes.ts`
- Add `POST /signup` handler that calls `AuthService.signup()`.
- Update `POST /register` to require `organizationId` in body (internal use).

---

## Phase 4: Route Handlers (Tenant Scoping)

All handlers already call `getDatabaseContext()`. The only change is passing `req.user.organizationId` to every repository call that lists or counts rows.

### Task 4.1 — `src/api/routes/apm.routes.ts`
- `GET /assets` → `dbContext.assets.list(orgId)` / `listByStatus(status, orgId)`
- `GET /dashboard` → `getFleetSummary(orgId)`, `countByStatus(status, orgId)`
- `POST /assets` → include `organizationId` in create input

### Task 4.2 — `src/api/routes/supply-chain.routes.ts`
- `GET /suppliers` → `list(orgId)` / `listByTier(tier, orgId)`
- `GET /materials` → `list(orgId)` / `listBySupplier(id, orgId)`
- `POST /suppliers`, `POST /materials`, `POST /cell-batches`, `POST /battery-packs` → include `organizationId`
- `GET /dashboard` → scoped supplier summary + material count

### Task 4.3 — `src/api/routes/alerts.routes.ts`
- `GET /` → `alertService.getAlertFeed({ ..., organizationId: orgId })`
- `GET /stats/by-agent` → pass `orgId`

### Task 4.4 — `src/api/routes/correlation.routes.ts`
- Pass `organizationId` to `CorrelationService` constructor or individual methods so all internal `list()` calls are scoped.

---

## Phase 5: AI Layer Upgrades

### Task 5.1 — `src/services/apm/SohCalculationService.ts` — Linear Regression
- Add private `trainModel()` method:
  - Collect all assets with sufficient data.
  - Build feature matrix `X` and label vector `y` using 100-point sliding windows.
  - Compute `β = (XᵀX)⁻¹Xᵀy` (normal equation, pure TypeScript — no external ML library).
  - Hold out 20 % for RMSE validation; log `modelRmse`.
  - Store `β` in `this.weights`.
- Replace `computeSohFromTelemetry` rule-based formula with `β · x` prediction.
- Fall back to rule-based formula if `this.weights` is null (< 10 training assets).

### Task 5.2 — `src/services/correlation/CorrelationService.ts` — Z-Score
- Add private `computeFleetStats()` returning `{ mean, stddev }` across all entity degradation rates.
- In `generateBatchInsights()`: replace `deviationPercent > 20` check with `zScore > 2.0`.
- In `generateSupplierInsights()`: replace `deviationPercent > 15` check with `zScore > 2.0`.
- Store `zScore` in alert metadata alongside existing fields.
- Handle `stddev = 0` edge case (skip flagging).

---

## Phase 6: Frontend

### Task 6.1 — `frontend/src/types/index.ts`
Add:
```typescript
export type OrgType = 'fleet_operator' | 'ev_manufacturer' | 'both' | 'demo';

export interface Organization {
  id: string;
  name: string;
  orgType: OrgType;
  createdAt: string;
}
```
Add `organizationId: string` to `User`.

### Task 6.2 — `frontend/src/services/api.ts`
Add `authApi.signup()`:
```typescript
signup: async (companyName: string, orgType: OrgType, email: string, password: string) => {
  const { data } = await client.post('/auth/signup', { companyName, orgType, email, password });
  localStorage.setItem('cs_access_token', data.accessToken);
  localStorage.setItem('cs_refresh_token', data.refreshToken);
  localStorage.setItem('cs_user', JSON.stringify(data.user));
  return data as { accessToken: string; refreshToken: string; user: User; organization: Organization };
};
```

### Task 6.3 — `frontend/src/pages/SignUpPage.tsx` (new file)
Fields: company name, org type (select), work email, password, confirm password.
Style: identical Windows 2007 theme as `LoginPage.tsx`.
On success: redirect to `/fleet` or `/supply-chain` based on `orgType`.

### Task 6.4 — Update `frontend/src/pages/LoginPage.tsx`
Add a "Create account" link below the form → navigates to `/signup`.

### Task 6.5 — Update `frontend/src/App.tsx`
Add `<Route path="/signup" element={<SignUpPage />} />` as a public route (no auth required).

### Task 6.6 — Update `frontend/src/hooks/useAuth.tsx`
- Add `organization` state of type `Organization | null`.
- `login` and a new `signup` method populate both `user` and `organization`.
- Expose `organization` from context.

---

## Phase 7: Demo Data Generator

### Task 7.1 — Update `src/scripts/DemoDataGenerator.ts`
- On `generate()`, look up or create the `__demo__` organization.
- Pass `organizationId = DEMO_ORG_ID` to every `create()` call for users, suppliers, assets, material lots, cell batches, battery packs, and alerts.

---

## Phase 8: Verification

### Task 8.1 — TypeScript typecheck
```bash
npx tsc --noEmit
```
Fix all errors before committing.

### Task 8.2 — Demo seed smoke test
```bash
npm run seed:demo
node dist/index.js &
curl http://localhost:3000/api/health
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"fleet@cellsight.com","password":"demo123"}'
```
Confirm `organizationId` appears in the returned user object.

### Task 8.3 — Sign-up smoke test
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"companyName":"Test Co","orgType":"fleet_operator","email":"test@test.com","password":"Test1234!"}'
```
Confirm HTTP 201 with `organization.name = "Test Co"`.

### Task 8.4 — Tenant isolation test
Use the `fleet@cellsight.com` token to call `GET /api/apm/assets`.  
Use the `test@test.com` token (from Task 8.3) to call the same endpoint.  
Confirm the two responses contain disjoint asset sets.
