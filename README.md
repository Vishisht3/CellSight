# CellSight

Battery intelligence platform for industrial EV fleets.

## What CellSight does

CellSight has two agents:

1. **APM Agent** — monitors battery state-of-health (SoH), predicts remaining useful life (RUL), and generates maintenance triggers for fleet operators.
2. **Supply Chain Agent** — tracks material sourcing, cell batch traceability, and supplier risk across three tiers.

The correlation engine links field degradation data to the originating cell batch and supplier.

## Live portal

**URL:** https://cell-sight.vercel.app

**Backend API:** https://cellsight-api-production.up.railway.app/api/health

### Demo accounts (password: `demo123`)

| Role | Email | Access level |
|---|---|---|
| Fleet Operations | `fleet@cellsight.com` | Fleet APM, maintenance, EV readiness |
| Supplier Quality | `supply@cellsight.com` | Supply chain, traceability, risk scores |
| Maintenance Planner | `maintenance@cellsight.com` | Fleet APM, maintenance, EV readiness |

### Create an account

Go to the portal and click **Create your company account**. Enter a company name, organization type, work email, and password. The system creates an organization and an administrator account.

## Install and run

### Requirements

- Node.js 18 or later
- npm

### Local development

```bash
# Install backend dependencies
npm install

# Seed demo data
npm run seed:demo

# Start the API server (port 3000)
npm run dev
```

```bash
# In a second terminal: install and start the frontend
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:5173  
API health check: http://localhost:3000/api/health

### Production build

```bash
npm run build
node dist/index.js
```

Set these environment variables before you start the server in production:

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | Yes | Set to `production` |
| `JWT_SECRET` | Yes | Random string, minimum 64 characters |
| `DATABASE_URL` | No | Postgres connection string. Omit to use SQLite. |
| `DEMO_MODE` | No | Set to `true` to seed demo data on first start |
| `CORS_ORIGIN` | Yes (prod) | Frontend URL, for example `https://your-app.vercel.app` |

## Project structure

```
CellSight/
├── src/
│   ├── api/routes/        API route handlers
│   ├── config/            Environment configuration
│   ├── database/          Repository layer and schema
│   ├── middleware/         Authentication and rate limiting
│   ├── models/            TypeScript types
│   ├── scripts/           Seed and migration scripts
│   ├── services/          Business logic
│   │   ├── apm/           Asset performance management
│   │   ├── correlation/   Field-to-source correlation
│   │   └── supply-chain/  Traceability and risk scoring
│   └── index.ts           Server entry point
├── frontend/              React dashboard (Vite)
└── docs/                  API reference and specs
```

## API reference

See `docs/API.md` for full documentation.

### Authentication endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/signup` | Create organization and admin account |
| `POST` | `/api/auth/login` | Log in. Returns access token. Sets httpOnly refresh cookie. |
| `POST` | `/api/auth/refresh` | Get a new access token using the refresh cookie |
| `POST` | `/api/auth/logout` | Revoke refresh token and clear cookie |
| `GET` | `/api/auth/me` | Get current user |

### Fleet APM endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/apm/dashboard` | Fleet summary: asset counts, average SoH, open alerts |
| `GET` | `/api/apm/assets` | List assets. Filter by `status` or `type`. |
| `GET` | `/api/apm/assets/:id` | Asset detail: SoH history, alerts |
| `POST` | `/api/apm/assets` | Register a new asset |
| `GET` | `/api/apm/assets/:id/telemetry` | Telemetry history |
| `POST` | `/api/apm/telemetry` | Ingest one telemetry record |
| `POST` | `/api/apm/telemetry/batch` | Ingest multiple records |

### Supply chain endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/supply-chain/dashboard` | Supplier counts, risk summary, traceability coverage |
| `GET` | `/api/supply-chain/suppliers` | List suppliers with risk scores |
| `POST` | `/api/supply-chain/suppliers` | Register a supplier |
| `GET` | `/api/supply-chain/materials` | List material lots |
| `POST` | `/api/supply-chain/materials` | Register a material lot |
| `POST` | `/api/supply-chain/cell-batches` | Register a cell batch |
| `POST` | `/api/supply-chain/battery-packs` | Register a battery pack |
| `GET` | `/api/supply-chain/trace/:assetId` | Trace asset to raw material sources |

### Alert endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/alerts` | Unified alert feed. Filter by `status`, `sourceAgent`, `assetId`. |
| `PUT` | `/api/alerts/:id/acknowledge` | Acknowledge an alert |
| `PUT` | `/api/alerts/:id/resolve` | Resolve an alert |

### Correlation endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/correlation/batches` | Degradation correlation for all cell batches |
| `GET` | `/api/correlation/suppliers` | Degradation correlation for all suppliers |
| `POST` | `/api/correlation/analyze` | Run correlation analysis and generate insights |

## Security notes

- Passwords: bcrypt (12 rounds). Minimum 8 characters with at least one digit or special character.
- Access tokens: short-lived JWT (15 minutes), stored in memory only.
- Refresh tokens: long-lived (7 days), stored in an httpOnly Secure SameSite=Strict cookie. Not accessible to JavaScript.
- Refresh token rotation: each use issues a new token and revokes the old one. Token reuse revokes the entire session family.
- Tenant isolation: every query filters by `organization_id`. A user cannot access another organization's data.
- Rate limiting: auth endpoints have a separate tighter limit than the general API.
- Account lockout: 10 consecutive failures locks the account for 15 minutes.

## License

MIT
