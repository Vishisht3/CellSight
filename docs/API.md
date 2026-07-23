# CellSight API Documentation

## Base URL

```
http://localhost:3000/api
```

## Authentication

Most endpoints require authentication using JWT Bearer tokens.

### Request Header
```
Authorization: Bearer <your-jwt-token>
```

---

## Authentication Endpoints

### Register User

**POST** `/auth/register`

Create a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "role": "fleet_manager"
}
```

**Roles:** `admin`, `fleet_manager`, `supply_chain_manager`

**Response:** `201 Created`
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "fleet_manager",
    "createdAt": "2026-07-22T10:00:00.000Z"
  }
}
```

### Login

**POST** `/auth/login`

Authenticate and receive JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:** `200 OK`
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "fleet_manager"
  }
}
```

### Get Current User

**GET** `/auth/me`

Get authenticated user information.

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "fleet_manager"
  }
}
```

---

## Fleet APM Endpoints

### List Assets

**GET** `/apm/assets`

List all assets with optional filtering.

**Query Parameters:**
- `status` (optional): Filter by status (`healthy`, `watch`, `critical`, `data_stale`, `insufficient_data`)
- `type` (optional): Filter by asset type

**Response:** `200 OK`
```json
{
  "assets": [
    {
      "id": "uuid",
      "name": "FreightLiner-001",
      "assetType": "freight_truck",
      "batteryPackId": "uuid",
      "status": "healthy",
      "currentSoh": 94.5,
      "sohConfidence": 0.85,
      "predictedRulDays": 450,
      "predictedRulCycles": 2200,
      "lastTelemetryAt": "2026-07-22T10:00:00.000Z",
      "totalCycles": 125
    }
  ],
  "summary": {
    "totalAssets": 50,
    "healthyAssets": 35,
    "watchAssets": 10,
    "criticalAssets": 3,
    "staleAssets": 2,
    "avgSoh": 92.3
  }
}
```

### Get Asset Details

**GET** `/apm/assets/:id`

Get detailed information for a specific asset.

**Response:** `200 OK`
```json
{
  "asset": { /* asset object */ },
  "sohHistory": [
    {
      "id": "uuid",
      "assetId": "uuid",
      "sohValue": 94.5,
      "confidence": 0.85,
      "modelVersion": "1.0.0",
      "computedAt": "2026-07-22T10:00:00.000Z",
      "dataPointsUsed": 150
    }
  ],
  "alerts": [ /* recent alerts */ ]
}
```

### Get Asset Telemetry

**GET** `/apm/assets/:id/telemetry`

Get telemetry history for an asset.

**Query Parameters:**
- `limit` (optional): Number of records to return (default: 100)

**Response:** `200 OK`
```json
{
  "telemetry": [
    {
      "id": "uuid",
      "assetId": "uuid",
      "timestamp": "2026-07-22T10:00:00.000Z",
      "voltage": 395.2,
      "current": -45.3,
      "temperature": 32.5,
      "stateOfCharge": 75.0,
      "cycleCount": 125
    }
  ]
}
```

### Ingest Telemetry

**POST** `/apm/telemetry`

Ingest new telemetry data for an asset.

**Request Body:**
```json
{
  "assetId": "uuid",
  "voltage": 395.2,
  "current": -45.3,
  "temperature": 32.5,
  "stateOfCharge": 75.0,
  "cycleCount": 125,
  "timestamp": "2026-07-22T10:00:00.000Z"
}
```

**Validation Rules:**
- `voltage`: 0-1000V
- `current`: -500 to 500A
- `temperature`: -50 to 100°C
- `stateOfCharge`: 0-100%
- `cycleCount`: non-negative integer

**Response:** `201 Created`
```json
{
  "message": "Telemetry ingested successfully",
  "telemetryId": "uuid"
}
```

### Batch Ingest Telemetry

**POST** `/apm/telemetry/batch`

Ingest multiple telemetry records at once.

**Request Body:**
```json
{
  "telemetry": [
    { /* telemetry object 1 */ },
    { /* telemetry object 2 */ }
  ]
}
```

**Response:** `200 OK`
```json
{
  "successCount": 98,
  "failureCount": 2,
  "errors": [
    {
      "index": 5,
      "error": "Validation failed: voltage exceeds maximum"
    }
  ]
}
```

### Get Fleet Dashboard

**GET** `/apm/dashboard`

Get fleet-wide summary statistics.

**Response:** `200 OK`
```json
{
  "totalAssets": 50,
  "healthyAssets": 35,
  "watchAssets": 10,
  "criticalAssets": 3,
  "staleAssets": 2,
  "avgSoh": 92.3,
  "openAlerts": 15
}
```

### Create Asset

**POST** `/apm/assets`

Register a new asset.

**Request Body:**
```json
{
  "name": "FreightLiner-001",
  "assetType": "freight_truck",
  "batteryPackId": "uuid"
}
```

**Response:** `201 Created`

---

## Supply Chain Endpoints

### List Suppliers

**GET** `/supply-chain/suppliers`

List all suppliers with risk scores.

**Query Parameters:**
- `tier` (optional): Filter by tier (`tier_1`, `tier_2`, `tier_3`)
- `highRiskOnly` (optional): `true` to show only high-risk suppliers (risk score >= 60)

**Response:** `200 OK`
```json
{
  "suppliers": [
    {
      "id": "uuid",
      "name": "GlobalCells Manufacturing",
      "tier": "tier_2",
      "country": "KR",
      "riskScore": 42.5,
      "concentrationRisk": 0.35,
      "geopoliticalRisk": 0.0,
      "qualityRisk": 0.15,
      "complianceRisk": 0.0,
      "certificationExpiry": "2027-07-22T00:00:00.000Z"
    }
  ],
  "summary": {
    "totalSuppliers": 20,
    "highRiskSuppliers": 3,
    "avgRiskScore": 38.2
  }
}
```

### Get Supplier Details

**GET** `/supply-chain/suppliers/:id`

Get detailed supplier information.

**Response:** `200 OK`
```json
{
  "supplier": { /* supplier object */ },
  "materialLots": [ /* material lots from this supplier */ ],
  "alerts": [ /* recent alerts */ ]
}
```

### Create Supplier

**POST** `/supply-chain/suppliers`

Register a new supplier.

**Request Body:**
```json
{
  "name": "Battery Materials Inc",
  "tier": "tier_3",
  "country": "US",
  "certificationExpiry": "2027-12-31T00:00:00.000Z"
}
```

**Response:** `201 Created`

### List Materials

**GET** `/supply-chain/materials`

List material lots.

**Query Parameters:**
- `supplierId` (optional): Filter by supplier
- `materialType` (optional): Filter by type (`lithium`, `cobalt`, `nickel`, `graphite`, `manganese`)

**Response:** `200 OK`

### Register Material Lot

**POST** `/supply-chain/materials`

Register a new material lot.

**Request Body:**
```json
{
  "lotNumber": "LI-US-0001",
  "materialType": "lithium",
  "supplierId": "uuid",
  "quantity": 2500.0,
  "country": "US",
  "receivedAt": "2026-07-15T00:00:00.000Z",
  "qualityScore": 92.5,
  "specificationMin": 85.0,
  "specificationMax": 95.0
}
```

**Response:** `201 Created`

### Register Cell Batch

**POST** `/supply-chain/cell-batches`

Register a new cell batch.

**Request Body:**
```json
{
  "batchNumber": "BATCH-GCM-001",
  "manufacturerId": "uuid",
  "productionDate": "2026-06-01T00:00:00.000Z",
  "quantity": 5000,
  "materialLotIds": ["uuid1", "uuid2", "uuid3"]
}
```

**Response:** `201 Created`

### Register Battery Pack

**POST** `/supply-chain/battery-packs`

Register a new battery pack.

**Request Body:**
```json
{
  "packNumber": "PACK-001",
  "cellBatchId": "uuid",
  "assemblyDate": "2026-06-15T00:00:00.000Z",
  "capacity": 150.0
}
```

**Response:** `201 Created`

### Trace Asset to Source

**GET** `/supply-chain/trace/:assetId`

Trace an asset back to source materials and suppliers (completes within 3 seconds).

**Response:** `200 OK`
```json
{
  "trace": {
    "asset": { /* asset object */ },
    "batteryPack": { /* battery pack object */ },
    "cellBatch": { /* cell batch object */ },
    "manufacturer": { /* supplier object */ },
    "materialLots": [
      {
        "id": "uuid",
        "lotNumber": "LI-US-0001",
        "materialType": "lithium",
        "quantity": 2500.0,
        "supplier": { /* supplier object */ }
      }
    ]
  }
}
```

### Get Supply Chain Dashboard

**GET** `/supply-chain/dashboard`

Get supply chain summary statistics.

**Response:** `200 OK`
```json
{
  "totalSuppliers": 20,
  "highRiskSuppliers": 3,
  "avgRiskScore": 38.2,
  "totalMaterialLots": 150,
  "traceabilityStats": {
    "totalAssets": 50,
    "assetsWithFullTrace": 48,
    "totalBatches": 25,
    "totalMaterialLots": 150,
    "totalSuppliers": 20
  }
}
```

---

## Alert Endpoints

### Get Alert Feed

**GET** `/alerts`

Get unified alert feed across all agents.

**Query Parameters:**
- `status` (optional): Filter by status (`open`, `acknowledged`, `resolved`)
- `limit` (optional): Number of alerts (default: 100)
- `sourceAgent` (optional): Filter by agent (`apm`, `supply_chain`, `correlation`)
- `assetId` (optional): Filter by asset
- `supplierId` (optional): Filter by supplier

**Response:** `200 OK`
```json
{
  "alerts": [
    {
      "id": "uuid",
      "type": "thermal_event",
      "severity": "warning",
      "sourceAgent": "apm",
      "assetId": "uuid",
      "title": "THERMAL EVENT: FreightLiner-001",
      "description": "Temperature above safe maximum: 52.3°C...",
      "status": "open",
      "metadata": "{...}",
      "createdAt": "2026-07-22T10:00:00.000Z"
    }
  ],
  "counts": {
    "open": 15,
    "acknowledged": 8,
    "resolved": 120,
    "total": 143
  }
}
```

### Get Alert by ID

**GET** `/alerts/:id`

Get specific alert details.

**Response:** `200 OK`

### Acknowledge Alert

**PUT** `/alerts/:id/acknowledge`

Mark an alert as acknowledged.

**Response:** `200 OK`
```json
{
  "message": "Alert acknowledged successfully"
}
```

### Resolve Alert

**PUT** `/alerts/:id/resolve`

Mark an alert as resolved.

**Response:** `200 OK`
```json
{
  "message": "Alert resolved successfully"
}
```

### Get Alert Statistics

**GET** `/alerts/stats/by-agent`

Get alert statistics grouped by source agent.

**Response:** `200 OK`
```json
{
  "stats": {
    "apm": { "open": 8, "total": 65 },
    "supply_chain": { "open": 5, "total": 42 },
    "correlation": { "open": 2, "total": 36 }
  }
}
```

---

## Correlation Endpoints

### Get Batch Correlation

**GET** `/correlation/batch/:batchId`

Get degradation correlation analysis for a cell batch.

**Response:** `200 OK`
```json
{
  "correlation": {
    "cellBatchId": "uuid",
    "batchNumber": "BATCH-GCM-001",
    "assetCount": 8,
    "avgDegradationRate": 0.0452,
    "fleetAvgDegradationRate": 0.0380,
    "deviationPercent": 18.9,
    "sampleSize": 8,
    "confidence": 0.80
  }
}
```

### Get Supplier Correlation

**GET** `/correlation/supplier/:supplierId`

Get degradation correlation analysis for a supplier.

**Response:** `200 OK`
```json
{
  "correlation": {
    "supplierId": "uuid",
    "supplierName": "GlobalCells Manufacturing",
    "assetCount": 15,
    "avgDegradationRate": 0.0395,
    "fleetAvgDegradationRate": 0.0380,
    "deviationPercent": 3.9,
    "sampleSize": 15,
    "confidence": 1.0
  }
}
```

### Get All Batch Correlations

**GET** `/correlation/batches`

Get correlation analysis for all cell batches.

**Response:** `200 OK`

### Get All Supplier Correlations

**GET** `/correlation/suppliers`

Get correlation analysis for all suppliers.

**Response:** `200 OK`

### Run Correlation Analysis

**POST** `/correlation/analyze`

Trigger correlation analysis and generate insights.

**Response:** `200 OK`
```json
{
  "results": {
    "batchesAnalyzed": 25,
    "suppliersAnalyzed": 20,
    "insightsGenerated": 3
  }
}
```

---

## Health Check

### Health Status

**GET** `/health`

Check API health status (no authentication required).

**Response:** `200 OK`
```json
{
  "status": "ok",
  "timestamp": "2026-07-22T10:00:00.000Z",
  "version": "1.0.0"
}
```

---

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "error": "Validation error",
  "details": [
    {
      "field": "voltage",
      "message": "Voltage exceeds maximum"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "error": "No token provided"
}
```

### 403 Forbidden
```json
{
  "error": "Insufficient permissions"
}
```

### 404 Not Found
```json
{
  "error": "Asset not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

---

## Rate Limiting

Currently no rate limiting is implemented. For production deployment, consider adding rate limiting middleware.

## CORS

CORS is configured to allow requests from the origin specified in the `CORS_ORIGIN` environment variable (default: `http://localhost:5173`).
