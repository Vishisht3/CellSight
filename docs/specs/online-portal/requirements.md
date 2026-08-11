# CellSight Online Portal — Requirements

This document uses EARS (Easy Approach to Requirements Syntax) notation.

---

## REQ-1: Telemetry ingestion

WHEN a BMS or IoT device sends a telemetry record to `POST /api/apm/telemetry`,  
THE SYSTEM SHALL validate the payload against the schema (voltage, current, temperature, stateOfCharge, cycleCount), store it, and return the generated telemetryId in less than 500 ms.

WHILE demo mode is active,  
THE SYSTEM SHALL accept synthetic telemetry through the same endpoint without changes.

---

## REQ-2: State-of-health calculation

WHEN an asset has at least `TELEMETRY_MIN_HISTORY_POINTS` telemetry records,  
THE SYSTEM SHALL compute a state-of-health (SoH) percentage, store the result in `soh_history`, update the asset row, and return a confidence score between 0 and 1.

WHEN the SoH falls below `SOH_THRESHOLD_WARNING`,  
THE SYSTEM SHALL set the asset status to `watch`.

WHEN the SoH falls below `SOH_THRESHOLD_CRITICAL`,  
THE SYSTEM SHALL set the asset status to `critical` and create a `soh_degradation` alert.

---

## REQ-3: Remaining useful life prediction

WHEN an asset has at least two SoH history entries,  
THE SYSTEM SHALL project remaining useful life (RUL) in days and cycles by extrapolating the degradation rate to the critical threshold.

WHEN the predicted RUL falls below 30 days or 500 cycles,  
THE SYSTEM SHALL create a `rul_threshold` alert with severity `warning`.

---

## REQ-4: Predictive maintenance

WHEN a telemetry record shows battery temperature above 45 degrees Celsius,  
THE SYSTEM SHALL create a `thermal_event` alert with severity `critical` within 60 seconds of ingestion.

WHEN the average state of charge during the last 50 cycles is outside 20 to 80 percent,  
THE SYSTEM SHALL create a `charge_pattern` alert with severity `warning`.

---

## REQ-5: Supply chain traceability

WHEN a user calls `GET /api/supply-chain/trace/:assetId`,  
THE SYSTEM SHALL resolve the full chain (asset, battery pack, cell batch, material lots, Tier 1/2/3 suppliers) and return the result in less than 3 seconds.

WHILE traceability coverage is below 100 percent,  
THE SYSTEM SHALL include a `coverageGap` field in the dashboard response.

---

## REQ-6: Supplier risk scoring

WHEN the `update-risk-scores` scheduler task runs,  
THE SYSTEM SHALL recompute a composite 0 to 100 risk score for each supplier using four dimensions: concentration risk, geopolitical risk, quality deviation, and compliance status.

WHEN a supplier concentration share for any single material type exceeds `SUPPLIER_CONCENTRATION_THRESHOLD`,  
THE SYSTEM SHALL create a `concentration_risk` alert with severity `warning`.

---

## REQ-7: Field-to-source correlation

WHEN the `correlation-analysis` scheduler task runs,  
THE SYSTEM SHALL compute a degradation z-score for each cell batch and supplier relative to the fleet distribution, flag any entity with a z-score above 2.0 as a statistical outlier, and create a `field_to_source_correlation` alert with severity `warning`.

WHEN a batch or supplier is flagged,  
THE SYSTEM SHALL make the correlation result visible to both `fleet_manager` and `supply_chain_manager` roles at the same time.

---

## REQ-8: Role-based access control

WHEN a request reaches any protected endpoint,  
THE SYSTEM SHALL require a valid JWT access token and reject unauthenticated requests with HTTP 401.

WHEN a user role does not permit access to a route,  
THE SYSTEM SHALL return HTTP 403 without exposing data.

Role access:

| Feature area | fleet_manager | supply_chain_manager | admin |
|---|---|---|---|
| Fleet APM, readiness, maintenance | Yes | No | Yes |
| Supply chain, traceability | No | Yes | Yes |
| Alerts, correlation | Yes | Yes | Yes |
| Organization management | No | No | Yes |

---

## REQ-9: Demo mode

WHILE `DEMO_MODE=true`,  
THE SYSTEM SHALL seed a synthetic fleet of `DEMO_ASSET_COUNT` assets with realistic degradation curves, thermal anomalies, and intentional risk-scenario suppliers into the demo organization on first start. The system shall not modify any real customer organization data.

WHEN demo mode is active,  
THE SYSTEM SHALL expose pre-seeded accounts (`maintenance@cellsight.com`, `fleet@cellsight.com`, `supply@cellsight.com`) that belong only to the demo organization.

---

## REQ-10: Real-time alert feed

WHEN an alert is created, acknowledged, or resolved,  
THE SYSTEM SHALL push the updated alert over the SSE stream at `/api/sse/alerts` to all connected clients in the same organization.

WHEN a client connects to the SSE endpoint,  
THE SYSTEM SHALL send the current open-alert count as the first event.

---

## REQ-11: Multi-tenancy and company sign-up

### REQ-11.1: Organization entity

THE SYSTEM SHALL maintain an `organizations` table with the columns: `id`, `name`, `org_type`, `created_at`.

THE SYSTEM SHALL add an `organization_id` foreign key to these tables: `users`, `assets`, `suppliers`, `material_lots`, `cell_batches`, `battery_packs`, `alerts`.

Each user SHALL belong to exactly one organization. The database SHALL enforce this constraint.

### REQ-11.2: Company sign-up flow

WHEN a visitor submits `POST /api/auth/signup` with `companyName`, `orgType`, `email`, and `password`,  
THE SYSTEM SHALL:
1. Verify that no organization with the same name exists.
2. Create a new row in `organizations`.
3. Create the first user in that organization with role `admin`.
4. Issue a JWT access token and refresh token pair.
5. Return `{ accessToken, user, organization }` with HTTP 201. The refresh token goes in an httpOnly cookie.

`orgType` SHALL be one of `fleet_operator`, `ev_manufacturer`, or `both`.

WHEN `orgType` is `fleet_operator` or `both`,  
THE SYSTEM SHALL set the default landing page to `/fleet`.

WHEN `orgType` is `ev_manufacturer`,  
THE SYSTEM SHALL set the default landing page to `/supply-chain`.

### REQ-11.3: Tenant isolation

WHEN an authenticated user calls any list or dashboard endpoint,  
THE SYSTEM SHALL filter all query results by the caller `organization_id`. No cross-tenant data shall be returned.

WHEN a user tries to access a resource that belongs to a different organization,  
THE SYSTEM SHALL return HTTP 404.

### REQ-11.4: JWT claims

WHEN the system issues a JWT access token,  
THE SYSTEM SHALL embed `{ userId, email, role, organizationId }` as claims.

---

## REQ-12: Secret scanning in CI

### REQ-12.1: PR and push scan

WHEN a commit or pull request is pushed to any branch,  
THE SYSTEM SHALL run gitleaks against the changed files before `backend-ci` or `frontend-ci` are allowed to pass.

IF gitleaks detects a pattern that matches a known secret type (API key, private key, password, or token),  
THEN THE SYSTEM SHALL fail CI and block merge and deploy.

### REQ-12.2: PR diff scope

WHEN the check runs on a pull request,  
THE SYSTEM SHALL scan only the diff introduced by that PR. The system shall not scan full history on every PR, to keep CI fast.

### REQ-12.3: Full-history audit job

THE SYSTEM SHALL provide a separate, manually-triggered job that scans the full git history. This job exists because diff-only scanning does not detect secrets committed before the check existed.

WHEN a maintainer triggers the full-history scan manually,  
THE SYSTEM SHALL run gitleaks with `--no-git` against the entire repository history and report any findings.

### REQ-12.4: Allowlist for example values

THE SYSTEM SHALL maintain a `.gitleaks.toml` configuration file that allowlists known-safe placeholder values in `.env.example` so the scanner does not flag its own example file.
