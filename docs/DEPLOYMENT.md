# CellSight Deployment Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Demo Mode Setup](#demo-mode-setup)
5. [Production Deployment](#production-deployment)
6. [Background Tasks](#background-tasks)
7. [Monitoring](#monitoring)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

- **Node.js**: 18.0.0 or higher
- **npm**: 8.0.0 or higher (or yarn 1.22.0+)
- **Operating System**: Windows, macOS, or Linux
- **Memory**: Minimum 2GB RAM recommended
- **Storage**: Minimum 1GB free disk space

### Development Tools (Optional)

- Git for version control
- VS Code or preferred IDE
- Postman or similar API testing tool

---

## Installation

### 1. Clone or Extract Project

```bash
cd CellSight
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required packages including:
- Express (web framework)
- Better-SQLite3 (database)
- TypeScript (language)
- Zod (validation)
- bcryptjs (password hashing)
- jsonwebtoken (authentication)

### 3. Set Up Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your configuration (see [Configuration](#configuration) section).

---

## Configuration

### Environment Variables

Edit the `.env` file in the project root:

```env
# Server Configuration
NODE_ENV=development          # development | production
PORT=3000                     # Server port

# Database
DATABASE_PATH=./data/cellsight.db

# JWT Authentication
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=24h

# Demo Mode
DEMO_MODE=true               # Enable synthetic data generation
DEMO_ASSET_COUNT=50          # Number of demo assets
DEMO_SUPPLIER_COUNT=20       # Number of demo suppliers

# Telemetry Settings
TELEMETRY_STALE_THRESHOLD_MINUTES=30
TELEMETRY_MIN_HISTORY_POINTS=100

# SoH & Degradation
SOH_THRESHOLD_WARNING=85     # SoH percentage for warning alerts
SOH_THRESHOLD_CRITICAL=80    # SoH percentage for critical alerts
RUL_MIN_CONFIDENCE=0.7

# Risk Scoring
SUPPLIER_CONCENTRATION_THRESHOLD=0.35
QUALITY_DEVIATION_THRESHOLD=0.15
GEOPOLITICAL_RISK_REGIONS=CN,RU,VE

# Alert Settings
ALERT_RETENTION_DAYS=90

# CORS
CORS_ORIGIN=http://localhost:5173
```

### Production Configuration

For production deployment, ensure:

1. **Change JWT_SECRET** to a strong, random secret
2. **Set NODE_ENV** to `production`
3. **Configure DATABASE_PATH** to a persistent location
4. **Set DEMO_MODE** to `false` for real data
5. **Update CORS_ORIGIN** to your frontend domain

---

## Demo Mode Setup

Demo mode generates synthetic data for demonstration and testing.

### 1. Generate Demo Data

```bash
npm run seed:demo
```

This creates:
- 3 users (admin, fleet manager, supply chain manager)
- 12 suppliers across 3 tiers
- ~150 material lots with quality data
- ~25 cell batches
- ~50 battery packs
- 50 assets (configurable)
- ~10,000 telemetry records with realistic degradation

**Demo Credentials:**
```
Admin:
  Email: admin@cellsight.com
  Password: demo123

Fleet Manager:
  Email: fleet@cellsight.com
  Password: demo123

Supply Chain Manager:
  Email: supply@cellsight.com
  Password: demo123
```

### 2. Start Server

```bash
npm run dev
```

The server will start on `http://localhost:3000` with:
- Automatic restart on code changes
- TypeScript compilation
- Background tasks running

### 3. Test the API

```bash
# Health check
curl http://localhost:3000/api/health

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@cellsight.com","password":"demo123"}'

# Get assets (use token from login response)
curl http://localhost:3000/api/apm/assets \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## Production Deployment

### 1. Build for Production

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` folder.

### 2. Production Environment Setup

Create production `.env` file:

```env
NODE_ENV=production
PORT=3000
DATABASE_PATH=/var/lib/cellsight/cellsight.db
JWT_SECRET=<strong-random-secret>
DEMO_MODE=false
CORS_ORIGIN=https://your-frontend-domain.com
```

### 3. Start Production Server

```bash
npm start
```

Or using PM2 for process management:

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start dist/index.js --name cellsight

# View logs
pm2 logs cellsight

# Monitor
pm2 monit

# Restart
pm2 restart cellsight

# Stop
pm2 stop cellsight
```

### 4. Nginx Reverse Proxy (Optional)

Example Nginx configuration:

```nginx
server {
    listen 80;
    server_name api.cellsight.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

### 5. SSL/TLS Configuration

Use Let's Encrypt with Certbot:

```bash
sudo certbot --nginx -d api.cellsight.com
```

---

## Background Tasks

CellSight runs several background tasks automatically:

| Task | Interval | Purpose |
|------|----------|---------|
| Check Stale Assets | 5 minutes | Mark assets without recent telemetry |
| Calculate SoH | 10 minutes | Compute State of Health for all assets |
| Maintenance Checks | 5 minutes | Run predictive maintenance analysis |
| Update Risk Scores | 30 minutes | Recalculate supplier risk scores |
| Correlation Analysis | 60 minutes | Generate field-to-source insights |

These run automatically when the server starts.

---

## Monitoring

### Application Logs

Logs are written to stdout/stderr. In production, use a log aggregation service:

```bash
# View logs with PM2
pm2 logs cellsight

# Or with systemd
journalctl -u cellsight -f
```

### Health Monitoring

Implement health checks:

```bash
# Simple health check
curl http://localhost:3000/api/health

# Expected response:
# {"status":"ok","timestamp":"2026-07-22T10:00:00.000Z","version":"1.0.0"}
```

### Database Backup

Regular backups of SQLite database:

```bash
# Manual backup
cp ./data/cellsight.db ./backups/cellsight-$(date +%Y%m%d).db

# Automated backup (add to cron)
0 2 * * * cp /path/to/cellsight.db /path/to/backups/cellsight-$(date +\%Y\%m\%d).db
```

### Metrics to Monitor

- API response times
- Database size and query performance
- Memory usage
- Open alert count
- Asset telemetry ingestion rate
- Background task execution times

---

## Troubleshooting

### Common Issues

#### 1. Server won't start

**Error:** `EADDRINUSE: address already in use :::3000`

**Solution:** Change PORT in `.env` or kill process using port 3000:

```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -i :3000
kill -9 <PID>
```

#### 2. Database locked

**Error:** `database is locked`

**Solution:** Ensure only one instance is running:

```bash
pm2 stop cellsight
rm ./data/cellsight.db-shm
rm ./data/cellsight.db-wal
pm2 start cellsight
```

#### 3. Authentication fails

**Error:** `Invalid or expired token`

**Solution:**
1. Check JWT_SECRET is consistent
2. Token may have expired (default: 24h)
3. Log in again to get new token

#### 4. Telemetry validation errors

**Error:** `Validation failed: voltage exceeds maximum`

**Solution:** Check telemetry data against validation rules:
- Voltage: 0-1000V
- Current: -500 to 500A
- Temperature: -50 to 100°C
- SoC: 0-100%
- Cycle count: non-negative integer

#### 5. Demo data generation fails

**Error:** `FOREIGN KEY constraint failed`

**Solution:**
1. Delete existing database: `rm ./data/cellsight.db`
2. Run seed script again: `npm run seed:demo`

### Debug Mode

Enable debug logging:

```env
NODE_ENV=development
```

In development mode, detailed error messages are returned in API responses.

### Database Inspection

Inspect SQLite database directly:

```bash
sqlite3 ./data/cellsight.db

# Common queries:
SELECT COUNT(*) FROM assets;
SELECT COUNT(*) FROM telemetry_data;
SELECT * FROM alerts WHERE status = 'open';
SELECT * FROM suppliers ORDER BY risk_score DESC LIMIT 10;
```

---

## Performance Optimization

### 1. Database Optimization

SQLite is already configured with:
- WAL mode for better concurrency
- Indexes on frequently queried columns
- Foreign key constraints

For large datasets, consider:
- Archiving old telemetry data
- Implementing pagination on list endpoints
- Migrating to PostgreSQL or MySQL

### 2. API Response Caching

Consider implementing caching for:
- Dashboard summaries (5-minute cache)
- Correlation analysis (15-minute cache)
- Supplier risk scores (30-minute cache)

### 3. Rate Limiting

Implement rate limiting in production:

```bash
npm install express-rate-limit
```

Example configuration:

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

---

## Security Best Practices

1. **Change default JWT secret** before deployment
2. **Use HTTPS** in production (SSL/TLS)
3. **Implement rate limiting** to prevent abuse
4. **Sanitize user inputs** (already implemented with Zod)
5. **Regular security updates** - keep dependencies updated
6. **Secure database file** permissions (chmod 600)
7. **Don't expose error details** in production
8. **Use environment variables** for sensitive config

---

## Scaling Considerations

For high-traffic deployments:

1. **Load Balancing:** Deploy multiple instances behind a load balancer
2. **Database:** Migrate to PostgreSQL with connection pooling
3. **Caching:** Add Redis for session and response caching
4. **Message Queue:** Use RabbitMQ or Redis for background tasks
5. **Monitoring:** Implement APM tools (New Relic, Datadog)
6. **CDN:** Serve static assets via CDN

---

## Support

For issues or questions:

1. Check logs for error details
2. Review this documentation
3. Inspect API documentation in `docs/API.md`
4. Check environment configuration

---

## License

MIT License - see LICENSE file for details
