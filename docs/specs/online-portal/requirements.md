# CellSight Online Portal — Requirements

All requirements use EARS (Easy Approach to Requirements Syntax) notation.

---

## REQ-1: Telemetry Ingestion

**WHEN** a BMS or IoT device submits a telemetry record to `POST /api/apm/telemetry`,  
**THE SYSTEM SHALL** validate the payload against the schema (voltage, current, temperature, stateOfCharge, cycleCount), persist it, and return the generated telemetryId within 500 ms.

**WHILE** demo mode is active,  
**THE SYSTEM SHALL** accept synthetic telemetry through the same endpoint without modification.

---

## REQ-2: State-of-Health Calculation

**WHEN** an asset has at least `TELEMETRY_MIN_HISTORY_POINTS` telemetry records,  
**THE SYSTEM SHALL** compute a State-of-Health (SoH) percentage using a regression model trained on the synthetic fleet, record the result in `soh_history`, update the asset row, and emit a confidence score between 0 and 1.

**WHEN** the computed SoH falls below `SOH_THRESHOLD_WARNING`,  
**THE SYSTEM SHALL** set the asset status to `watch`.

**WHEN** the computed SoH falls below `SOH_THRESHOLD_CRITICAL`,  
**THE SYSTEM SHALL** set the asset status to `critical` and create a `soh_degradation` alert.

---

## REQ-3: Remaining Useful Life Prediction

**WHEN** an asset has at least two SoH history entries,  
**THE SYSTEM SHALL** project Remaining Useful Life (RUL) in days and cycles by linearly extrapolating the degradation rate to the critical threshold.

**WHEN** the predicted RUL drops below 30 days or 500 cycles,  
**THE SYSTEM SHALL** create a `rul_threshold` alert with severity `warning`.

---

## REQ-4: Predictive Maintenance

**WHEN** a telemetry record shows battery temperature above 45 °C,  
**THE SYSTEM SHALL** create a `thermal_event` alert with severity `critical` within 60 seconds of ingestion.

**WHEN** average State of Charge during the last 50 cycles is outside the 20–80 % optimal band,  
**THE SYSTEM SHALL** create a `charge_pattern` alert with severity `warning`.

---

## REQ-5: Supply Chain Traceability

**WHEN** a user calls `GET /api/supply-chain/trace/:assetId`,  
**THE SYSTEM SHALL** resolve the full provenance chain — asset → battery pack → cell batch → material lots → Tier-1/2/3 suppliers — and return the result in under 3 seconds.

**WHILE** traceability coverage is below 100 %,  
**THE SYSTEM SHALL** include a `coverageGap` field in the dashboard response indicating the number of assets without a complete trace.

---

## REQ-6: Supplier Risk Scoring

**WHEN** the `update-risk-scores` scheduler task fires,  
**THE SYSTEM SHALL** recompute a composite 0–100 risk score for every supplier using four equally-weighted dimensions: concentration risk, geopolitical risk, quality deviation, and compliance/certification gap.

**WHEN** a supplier's concentration share for any single material type exceeds `SUPPLIER_CONCENTRATION_THRESHOLD`,  
**THE SYSTEM SHALL** create a `concentration_risk` alert with severity `warning`.

---

## REQ-7: Field-to-Source Correlation

**WHEN** the `correlation-analysis` scheduler task fires,  
**THE SYSTEM SHALL** compute a degradation z-score for every cell batch and supplier relative to the fleet distribution, flag any entity whose z-score exceeds 2.0 as a statistical outlier, and create a `field_to_source_correlation` alert with severity `warning`.

**WHEN** a batch or supplier is flagged,  
**THE SYSTEM SHALL** make the correlation result visible to both `fleet_manager` and `supply_chain_manager` roles simultaneously.

---

## REQ-8: Role-Based Access Control

**WHEN** a request reaches any protected endpoint,  
**THE SYSTEM SHALL** require a valid JWT access token and reject unauthenticated requests with HTTP 401.

**WHEN** a user's role does not permit access to a route,  
**THE SYSTEM SHALL** return HTTP 403 without exposing data.

The following role mapping shall be enforced:

| Feature area | fleet_manager | supply_chain_manager | admin |
|---|---|---|---|
| Fleet APM, readiness, maintenance | ✓ | — | ✓ |
| Supply chain, traceability | — | ✓ | ✓ |
| Alerts, correlation | ✓ | ✓ | ✓ |
| Organization management | — | — | ✓ |

---

## REQ-9: Demo Mode

**WHILE** `DEMO_MODE=true`,  
**THE SYSTEM SHALL** seed a synthetic fleet of `DEMO_ASSET_COUNT` assets with realistic degradation curves, injected thermal anomalies, and intentional risk-scenario suppliers into the **demo organization** on first startup, without modifying any real customer organization's data.

**WHEN** demo mode is active,  
**THE SYSTEM SHALL** expose pre-seeded credentials (`maintenance@cellsight.com`, `fleet@cellsight.com`, `supply@cellsight.com`) that belong exclusively to the demo organization.

---

## REQ-10: Real-Time Alert Feed

**WHEN** an alert is created, acknowledged, or resolved,  
**THE SYSTEM SHALL** push the updated alert over the SSE stream at `/api/sse/alerts` to all connected clients belonging to the same organization.

**WHEN** a client connects to the SSE endpoint,  
**THE SYSTEM SHALL** immediately send the current open-alert count as the first event.

---

## REQ-11: Multi-Tenancy & Company Sign-Up

### 11.1 Organization Entity

**THE SYSTEM SHALL** maintain an `organizations` table with the columns:  
`id TEXT PRIMARY KEY`, `name TEXT NOT NULL`, `org_type TEXT NOT NULL`, `created_at TEXT NOT NULL`.

**THE SYSTEM SHALL** add an `organization_id TEXT NOT NULL` foreign key to the following tables:  
`users`, `assets`, `suppliers`, `material_lots`, `cell_batches`, `battery_packs`, `alerts`.

Every user **SHALL** belong to exactly one organization via `organization_id`; the constraint shall be enforced at the database level.

### 11.2 Company Sign-Up Flow

**WHEN** a visitor submits `POST /api/auth/signup` with `{ companyName, orgType, email, password }`,  
**THE SYSTEM SHALL**:
1. Validate that no organization with the same name already exists.
2. Create a new row in `organizations`.
3. Create the first user in that organization with role `admin`.
4. Issue a JWT access token and refresh token pair.
5. Return `{ accessToken, refreshToken, user, organization }` with HTTP 201.

`orgType` **SHALL** be one of `fleet_operator`, `ev_manufacturer`, or `both`.

**WHEN** `orgType` is `fleet_operator` or `both`,  
**THE SYSTEM SHALL** set the organization's default landing page to `/fleet`.

**WHEN** `orgType` is `ev_manufacturer`,  
**THE SYSTEM SHALL** set the organization's default landing page to `/supply-chain`.

### 11.3 Tenant Isolation

**WHEN** an authenticated user calls any list or dashboard endpoint,  
**THE SYSTEM SHALL** filter all query results by the caller's `organization_id` so that no cross-tenant data is returned.

**WHEN** a user attempts to access a resource (asset, supplier, alert) that belongs to a different organization,  
**THE SYSTEM SHALL** return HTTP 404 as if the resource does not exist.

### 11.4 JWT Claims

**WHEN** the system issues a JWT access token,  
**THE SYSTEM SHALL** embed `{ userId, email, role, organizationId }` as claims so that every downstream handler can enforce tenant isolation without an additional database lookup.

### 11.5 Demo Organization Isolation

**THE SYSTEM SHALL** assign all seeded demo accounts to a reserved organization named `__demo__` with `org_type = 'demo'`.

**THE SYSTEM SHALL NOT** allow real customer sign-ups to use the organization name `__demo__`.

**WHEN** `DEMO_MODE=true` and the `__demo__` organization does not yet exist,  
**THE SYSTEM SHALL** create it automatically during the seed step.
