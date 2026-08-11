# CellSight Online Portal — Design

---

## 1. Data model

### 1.1 Organizations table

```sql
CREATE TABLE IF NOT EXISTS organizations (
  id         TEXT PRIMARY KEY,
  name       TEXT UNIQUE NOT NULL,
  org_type   TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

`org_type` values and their default landing pages:

| org_type | Default landing page |
|---|---|
| `fleet_operator` | `/fleet` |
| `ev_manufacturer` | `/supply-chain` |
| `both` | `/fleet` |
| `demo` | `/fleet` |

### 1.2 Schema changes to existing tables

Add `organization_id TEXT NOT NULL REFERENCES organizations(id)` to:

| Table | Note |
|---|---|
| `users` | FK to organizations |
| `assets` | FK to organizations |
| `suppliers` | FK to organizations |
| `material_lots` | FK to organizations |
| `cell_batches` | FK to organizations |
| `battery_packs` | FK to organizations |
| `alerts` | FK to organizations |

`refresh_tokens`, `soh_history`, `telemetry_data`, and `batch_material_links` are not tenant-owned directly. They inherit isolation through their parent entity.

### 1.3 Demo organization

The system seeds this row at startup:

```json
{ "id": "demo-org-00000000-0000-0000-0000-000000000000", "name": "__demo__", "org_type": "demo" }
```

All three demo users belong to this organization. Real sign-ups cannot use the name `__demo__`.

---

## 2. Entity relationships

```
organizations
    id (PK)
    name
    org_type
    |
    +-- users            (organization_id FK)
    +-- suppliers        (organization_id FK)
    |   +-- material_lots   (organization_id FK)
    |       +-- batch_material_links
    +-- cell_batches     (organization_id FK)
    |   +-- battery_packs   (organization_id FK)
    |       +-- assets  (organization_id FK)
    |           +-- telemetry_data
    |           +-- soh_history
    +-- alerts           (organization_id FK)
```

---

## 3. API changes

### 3.1 POST /api/auth/signup

Request body:
```json
{
  "companyName": "Acme Fleet Co.",
  "orgType": "fleet_operator",
  "email": "alice@acme.com",
  "password": "••••••••"
}
```

Response 201:
```json
{
  "accessToken": "<jwt>",
  "user": { "id": "...", "email": "alice@acme.com", "role": "admin", "organizationId": "..." },
  "organization": { "id": "...", "name": "Acme Fleet Co.", "orgType": "fleet_operator" }
}
```

The refresh token goes in an httpOnly cookie. It does not appear in the response body.

Error responses:
- `409 Conflict` — organization name already exists, or email already in use
- `400 Bad Request` — validation failure

### 3.2 Authentication flow

```
Browser                   API                     Cookie store
  |                         |                           |
  | POST /auth/signup        |                           |
  | or POST /auth/login      |                           |
  |------------------------->|                           |
  |                         | verify credentials        |
  |                         | issue access + refresh    |
  | accessToken in body     | Set-Cookie: refreshToken  |
  |<------------------------|-------------------------->|
  |                         |                           |
  | (on page reload)        |                           |
  | POST /auth/refresh      |                           |
  |------------------------>| Cookie: refreshToken -----+
  |                         | rotate token              |
  | new accessToken         | Set-Cookie: refreshToken  |
  |<------------------------|-------------------------->|
```

Access tokens are stored in memory only. They are not written to localStorage or sessionStorage.

### 3.3 JWT claims

```json
{ "userId": "...", "email": "...", "role": "fleet_manager", "organizationId": "..." }
```

### 3.4 Tenant-scoped queries

Every repository method that lists or counts rows takes `organizationId` as a required parameter and appends `WHERE organization_id = ?`.

Before:
```typescript
list(): Asset[] {
  return this.db.prepare('SELECT ... FROM assets').all() as Asset[];
}
```

After:
```typescript
list(organizationId: string): Asset[] {
  return this.db.prepare(
    'SELECT ... FROM assets WHERE organization_id = ? ORDER BY created_at DESC'
  ).all(organizationId) as Asset[];
}
```

---

## 4. Sign-up sequence

```
Browser                  API                    Database
  |                        |                        |
  | POST /auth/signup       |                        |
  |------------------------>|                        |
  |                        | validate body          |
  |                        | check org name unique ->| SELECT FROM organizations
  |                        |<-----------------------| (not found = OK)
  |                        |                        |
  |                        | INSERT organization -->| organizations row
  |                        | INSERT user (admin) -->| users row (org_id = new org)
  |                        | issue JWT + cookie     |
  |                        |                        |
  | 201 { tokens, user,    |                        |
  |       organization }   |                        |
  |<------------------------|                        |
  |                        |                        |
  | redirect to /fleet     |                        |
  | or /supply-chain       |                        |
```

---

## 5. AI layer

### 5.1 SoH: linear regression model

The system uses ordinary least squares (OLS) regression trained on the synthetic demo fleet. Training runs once at service startup and uses this feature vector per 100-point telemetry window:

```
[totalCycles, avgVoltage, avgTemperature, avgStateOfCharge, voltageStdDev, tempStdDev]
```

Target: SoH value from the rule-based formula (bootstrap ground truth).

The system falls back to the rule-based formula when fewer than 10 training assets are available. After fitting, the system holds out 20 percent of windows and computes RMSE. It logs `modelRmse` alongside each SoH calculation.

### 5.2 Correlation: z-score anomaly detection

The system computes the population z-score for each entity degradation rate against the fleet distribution:

```
z = (entity_avg_rate - mean) / stddev
```

Any entity with z greater than 2.0 is flagged as a statistical outlier. This threshold corresponds to the 95th percentile significance level. The system skips flagging when stddev equals 0.

---

## 6. Frontend pages

### 6.1 SignUpPage

Route: `/signup`

Fields: company name, organization type (select), work email, password, confirm password.

On success: stores access token in memory, redirects to `/fleet` or `/supply-chain` based on `orgType`.

### 6.2 LoginPage

Fields: email, password.

Admin Login button: pre-fills `fleet@cellsight.com` / `demo123`. Shows a Company field.

On success: stores access token in memory. Refresh token arrives as httpOnly cookie.

On page reload: the frontend calls `POST /auth/refresh` silently. If the cookie is valid, the session restores without a new login.

### 6.3 Token storage model

| Token | Storage location | Accessible to JS |
|---|---|---|
| Access token (15 min) | Module memory (`_accessToken` variable) | Yes (by design, short-lived) |
| Refresh token (7 days) | httpOnly cookie | No |

---

## 7. Backward compatibility

Existing demo accounts continue to work. They belong to the `__demo__` org.

The `POST /api/auth/register` endpoint is kept for internal use. It requires `organizationId` in the request body.

The database migration uses `ALTER TABLE ... ADD COLUMN IF NOT EXISTS organization_id` so existing rows are not orphaned. After migration, existing rows receive `organization_id = DEMO_ORG_ID`.
