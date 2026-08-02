# CellSight

Battery intelligence platform built for the industrial EV transition challenge.

## Overview

CellSight pairs two flagship agents:

1. **EV Asset Performance Management (APM) Agent** — monitors battery state-of-health, degradation, and maintenance needs for fleet operators
2. **EV Supply Chain Risk & Traceability Agent** — tracks battery-grade material sourcing, cell/pack traceability, and multi-tier supplier risk

The platform's core differentiator: **correlating field degradation back to the batch or supplier that produced it**.

## Live Demo

**Portal:** https://evcell.netlify.app  
**Architecture overview:** https://evcell.netlify.app/architecture *(no login required)*

### Demo credentials (password: `demo123`)

| Role | Email | Access |
|---|---|---|
| Maintenance Planner | `maintenance@cellsight.com` | Fleet APM, maintenance ops, EV readiness |
| Fleet Operations | `fleet@cellsight.com` | Fleet APM, maintenance ops, EV readiness |
| Supplier Quality | `supply@cellsight.com` | Supply chain, traceability, risk scores |

> The architecture diagram and platform overview are accessible without logging in at `/architecture`.

## Key Features

- Real-time battery telemetry ingestion with validation
- State-of-Health (SoH) calculation and degradation prediction
- Predictive maintenance triggers and charge optimization
- Multi-tier material and supplier traceability
- Supply chain risk scoring (concentration, geopolitical, quality, compliance)
- Field-to-source correlation engine
- Unified alerting across both agents
- Role-based access control
- Demo mode with synthetic data

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install
```

### Running in Demo Mode

```bash
# Seed demo data (creates users, suppliers, assets, telemetry)
npm run seed:demo

# Start the development server
npm run dev
```

The API will be available at `http://localhost:3000`

**Demo Credentials:**
- Admin: `admin@cellsight.com` / `demo123`
- Fleet Manager: `fleet@cellsight.com` / `demo123`
- Supply Chain Manager: `supply@cellsight.com` / `demo123`

### Running in Production Mode

```bash
# Build the project
npm run build

# Set NODE_ENV=production and DEMO_MODE=false in .env

# Start the server
npm start
```

## Testing the API

```bash
# Health check
curl http://localhost:3000/api/health

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@cellsight.com","password":"demo123"}'

# Get fleet dashboard (use token from login)
curl http://localhost:3000/api/apm/dashboard \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Project Structure

```
CellSight/
├── src/
│   ├── config/          # Configuration and environment
│   ├── models/          # Data models and types
│   ├── database/        # Database setup and migrations
│   ├── services/        # Core business logic
│   │   ├── apm/         # Asset Performance Management
│   │   ├── supply-chain/ # Supply chain traceability
│   │   └── correlation/ # Field-to-source correlation
│   ├── api/             # REST API routes and controllers
│   ├── middleware/      # Express middleware
│   ├── utils/           # Utility functions
│   ├── scripts/         # Data seeding and utilities
│   └── index.ts         # Application entry point
├── frontend/            # React dashboard (separate app)
└── docs/                # API documentation
```

## API Endpoints

Full API documentation is available in [`docs/API.md`](docs/API.md)

### Key Endpoints

#### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/me` - Get current user

#### Fleet APM
- `GET /api/apm/assets` - List all assets with health status
- `GET /api/apm/assets/:id` - Get detailed asset information
- `GET /api/apm/assets/:id/telemetry` - Get asset telemetry history
- `POST /api/apm/telemetry` - Ingest new telemetry data
- `POST /api/apm/telemetry/batch` - Batch ingest telemetry
- `GET /api/apm/dashboard` - Fleet dashboard summary

#### Supply Chain
- `GET /api/supply-chain/suppliers` - List suppliers with risk scores
- `GET /api/supply-chain/materials` - List material lots
- `GET /api/supply-chain/trace/:assetId` - Trace asset to source materials (< 3 seconds)
- `POST /api/supply-chain/materials` - Register new material lot
- `POST /api/supply-chain/cell-batches` - Register cell batch
- `POST /api/supply-chain/battery-packs` - Register battery pack
- `GET /api/supply-chain/dashboard` - Supply chain dashboard summary

#### Alerts
- `GET /api/alerts` - Get unified alert feed across all agents
- `GET /api/alerts/:id` - Get alert details
- `PUT /api/alerts/:id/acknowledge` - Acknowledge an alert
- `PUT /api/alerts/:id/resolve` - Resolve an alert

#### Cross-Linkage / Correlation
- `GET /api/correlation/batch/:batchId` - Get degradation correlation for batch
- `GET /api/correlation/supplier/:supplierId` - Get degradation correlation for supplier
- `GET /api/correlation/batches` - List all batch correlations
- `GET /api/correlation/suppliers` - List all supplier correlations
- `POST /api/correlation/analyze` - Run correlation analysis

## Configuration

Key environment variables:

- `DEMO_MODE` - Enable synthetic data generation (true/false)
- `TELEMETRY_STALE_THRESHOLD_MINUTES` - Mark asset stale after this period
- `SOH_THRESHOLD_CRITICAL` - SoH percentage for critical alerts
- `SUPPLIER_CONCENTRATION_THRESHOLD` - Trigger concentration risk above this share

See `.env.example` for full configuration options.

## Architecture

CellSight uses:
- **Express** for the REST API
- **Better-SQLite3** for the embedded database
- **WebSockets** for real-time telemetry streaming
- **JWT** for authentication
- **Zod** for runtime validation

The platform is designed with clear separation between:
1. **Ingestion layer** - accepts telemetry and supply chain data
2. **Analysis engines** - compute SoH, risk scores, and correlations
3. **API layer** - exposes data to dashboards
4. **Demo mode** - generates synthetic data using the same interfaces

## License

MIT
