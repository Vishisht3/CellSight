# CellSight Online Portal — Implementation Tasks

---

## Phase 1: Schema and constants

### Task 1.1 — Add `OrgType` enum to `src/config/constants.ts`

Values: `fleet_operator`, `ev_manufacturer`, `both`, `demo`.

Add `DEMO_ORG_ID` and `DEMO_ORG_NAME` constants.

### Task 1.2 — Update `src/database/schema.ts`

Add the `organizations` table before the `users` table.

Add `organization_id TEXT NOT NULL` to: `users`, `assets`, `suppliers`, `material_lots`, `cell_batches`, `battery_packs`, `alerts`.

Use `execAsync` for all DDL in the Postgres path.

Insert the `__demo__` org row with `INSERT OR IGNORE` (SQLite) or `ON CONFLICT DO NOTHING` (Postgres).

---

## Phase 2: Repository layer

### Task 2.1 — Create `src/database/repositories/OrganizationRepository.ts`

Methods: `create(input)`, `findById(id)`, `findByName(name)`, `list()`.

### Task 2.2 — Update `src/database/repositories/UserRepository.ts`

Add `organization_id` to all SELECT projections.

`create()` accepts and stores `organizationId`.

### Task 2.3 — Scope `AssetRepository`

`list(organizationId)` — add `WHERE organization_id = ?`.

`listByStatus(status, organizationId)` — add tenant filter.

`getFleetSummary(organizationId)` — add tenant filter.

`create()` — accept and store `organizationId`.

### Task 2.4 — Scope `AlertRepository`

`list(organizationId, status?, limit?)` — add `WHERE organization_id = ?`.

`listByAsset(assetId, organizationId, limit?)` — add tenant filter.

`listBySupplier(supplierId, organizationId, limit?)` — add tenant filter.

`create()` — accept and store `organizationId`.

`countByStatus(status, organizationId)` — add tenant filter.

### Task 2.5 — Scope `MaterialRepository`

`list(organizationId)` — add tenant filter.

`listBySupplier(supplierId, organizationId)` — add tenant filter.

`create()` — accept and store `organizationId`.

### Task 2.6 — Scope `CellBatchRepository`

`listBatches(organizationId)` — add tenant filter.

`createBatch()` — accept and store `organizationId`.

`createPack()` — accept and store `organizationId`.

`listPacks(organizationId)` — add tenant filter.

### Task 2.7 — Scope `SupplierRepository`

`list(organizationId)` — add tenant filter.

`listByTier(tier, organizationId)` — add tenant filter.

`create()` — accept and store `organizationId`.

`getSummary(organizationId)` — add tenant filter.

### Task 2.8 — Update `src/database/index.ts`

Add `orgs: OrganizationRepository` to `DatabaseContext`.

---

## Phase 3: Authentication and middleware

### Task 3.1 — Update `src/services/AuthService.ts`

Add `signup(input)`:
1. Reject org name `__demo__`.
2. Check org name not already taken.
3. `orgs.create(...)`.
4. `users.create({ ..., organizationId: org.id, role: 'admin' })`.
5. Return tokens and organization.

Add lockout tracking: 10 failures locks the account for 15 minutes.

Add constant-time login: always run `bcrypt.compare` even when the email does not exist.

`issueTokenPair` — add `organizationId` to JWT payload.

`verifyToken` — return `{ userId, email, role, organizationId }`.

Add `getRefreshCookieOptions()` and `getClearRefreshCookieOptions()`.

### Task 3.2 — Update `src/middleware/auth.ts`

Add `organizationId: string` to `req.user`.

### Task 3.3 — Update `src/api/routes/auth.routes.ts`

Add `POST /signup`.

Login and signup routes set the refresh token as an httpOnly cookie.

Refresh route reads the token from the cookie.

Logout route clears the cookie.

---

## Phase 4: Route handlers

### Task 4.1 — `src/api/routes/apm.routes.ts`

Pass `req.user.organizationId` to all repository calls.

### Task 4.2 — `src/api/routes/supply-chain.routes.ts`

Pass `req.user.organizationId` to all repository calls.

### Task 4.3 — `src/api/routes/alerts.routes.ts`

Pass `req.user.organizationId` to all repository calls.

### Task 4.4 — `src/api/routes/correlation.routes.ts`

Pass `req.user.organizationId` to `CorrelationService` constructor.

---

## Phase 5: AI upgrades

### Task 5.1 — SoH linear regression

File: `src/services/apm/SohCalculationService.ts`.

Add `trainModel()`. Build feature matrix from synthetic fleet data. Fit OLS coefficients with the normal equation. Hold out 20 percent for RMSE. Fall back to rule-based formula when fewer than 10 training assets exist. Log `modelRmse`.

### Task 5.2 — Correlation z-score

File: `src/services/correlation/CorrelationService.ts`.

Replace flat-threshold check with z-score: `z = (entity_rate - mean) / stddev`. Flag when z greater than 2.0. Skip when stddev equals 0. Store `zScore` in alert metadata.

---

## Phase 6: Frontend

### Task 6.1 — `frontend/src/types/index.ts`

Add `Organization` type and `OrgType`. Add `organizationId: string` to `User`.

### Task 6.2 — `frontend/src/services/api.ts`

Store access token in memory only. Do not use localStorage.

Set `withCredentials: true` on the Axios client.

Add `authApi.silentRefresh()` — calls `POST /auth/refresh`, receives new access token.

### Task 6.3 — `frontend/src/hooks/useAuth.tsx`

On mount, call `silentRefresh()` instead of reading from localStorage.

### Task 6.4 — `frontend/src/pages/SignUpPage.tsx` (new file)

Fields: company name, org type, work email, password, confirm password.

On success: redirect based on `orgType`.

### Task 6.5 — Update `frontend/src/App.tsx`

Add `/signup` as a public route.

### Task 6.6 — Update `frontend/src/components/layout/Sidebar.tsx`

Add Register Data and Profile nav items.

---

## Phase 7: Demo data generator

### Task 7.1 — Update `src/scripts/DemoDataGenerator.ts`

Pass `organizationId = DEMO_ORG_ID` to every `create()` call.

---

## Phase 8: Security hardening

### Task 8.1 — Password strength

File: `src/utils/validation.ts`.

Enforce minimum 8 characters and at least one digit or special character on all password fields.

### Task 8.2 — Account lockout

File: `src/services/AuthService.ts`.

Lock account for 15 minutes after 10 consecutive failed logins.

### Task 8.3 — User enumeration fix

File: `src/services/AuthService.ts`.

Always run `bcrypt.compare` even when the email does not exist. Use a dummy hash as the comparison target.

---

## Phase 9: Testing

### Task 9.1 — Two-org isolation test

File: `src/tests/tenant-isolation.test.ts`.

Create two organizations. Seed each with assets, suppliers, and alerts. Assert that list and lookup calls for org A never return data from org B. Run as part of CI.

### Task 9.2 — Typecheck

```bash
npx tsc --noEmit
```

Fix all errors before committing.

### Task 9.3 — Smoke test

```bash
npm run seed:demo
node dist/index.js &
curl http://localhost:3000/api/health
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"fleet@cellsight.com","password":"demo123"}'
```

Confirm `organizationId` appears in the returned user object.

---

## Phase 10: Secret scanning

### Task 10.1 — Add gitleaks secret-scan job to CI

File: `.github/workflows/ci.yml`.

Add a `secret-scan` job that runs before `backend-ci` and `frontend-ci`. Make both jobs depend on it via `needs: [secret-scan]`.

On pull requests, use `fetch-depth: 0` and scan only the PR diff using `--log-opts="origin/${{ github.base_ref }}..HEAD"`.

On pushes to main, scan the last commit only.

Add a separate `secret-scan-full-history` job with `workflow_dispatch` trigger for periodic audits.

### Task 10.2 — Add `.gitleaks.toml` configuration

File: `.gitleaks.toml` at repo root.

Set `title = "CellSight secret scan"`.

Add an `[allowlist]` section that allowlists placeholder values in `.env.example` by regex, so the scanner does not flag example values like `change-this-to-a-strong-random-secret`.

### Task 10.3 — Smoke test (do this before merging to main)

Create a throwaway branch:

```bash
git checkout -b test/secret-scan-smoke
```

Add a fake secret to a test file:

```bash
echo 'FAKE_AWS_KEY=AKIAIOSFODNN7EXAMPLE' >> /tmp/fake-secret.txt
git add /tmp/fake-secret.txt
git commit -m "test: fake secret for scanner smoke test"
git push origin test/secret-scan-smoke
```

Open a pull request from that branch. Confirm the `secret-scan` job fails.

Revert and close the PR before merging.

### Task 10.4 — Full-history audit (run once by hand before merging)

Install gitleaks locally and run:

```bash
gitleaks detect --source . --log-opts="--all" -v
```

Review any findings. Fix real secrets (rotate and remove). Add verified false positives to `.gitleaks.toml` allowlist.
