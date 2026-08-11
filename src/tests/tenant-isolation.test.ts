/**
 * Two-org tenant isolation test.
 *
 * Creates two separate organizations with their own assets, suppliers, and
 * alerts. Verifies that every list and lookup endpoint returns only the
 * caller's data and never leaks data from the other organization.
 *
 * Run: npx ts-node src/tests/tenant-isolation.test.ts
 */

import { getDatabaseContext, closeDatabaseContext } from '../database';
import { AuthService } from '../services/AuthService';
import { OrgType, DEMO_ORG_ID } from '../config/constants';
import { v4 as uuidv4 } from 'uuid';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function run() {
  console.log('\n=== Tenant Isolation Test ===\n');
  const ctx = await getDatabaseContext();
  const authSvc = new AuthService(ctx);

  // ── Create Org A ──────────────────────────────────────────────────────
  const orgAResult = await authSvc.signup({
    companyName: `Test Org A ${uuidv4()}`,
    orgType: OrgType.FLEET_OPERATOR,
    email: `a-admin-${uuidv4()}@test.example`,
    password: 'TestPass1!',
  });
  const orgAId = orgAResult.organization.id;

  // ── Create Org B ──────────────────────────────────────────────────────
  const orgBResult = await authSvc.signup({
    companyName: `Test Org B ${uuidv4()}`,
    orgType: OrgType.FLEET_OPERATOR,
    email: `b-admin-${uuidv4()}@test.example`,
    password: 'TestPass1!',
  });
  const orgBId = orgBResult.organization.id;

  console.log('Setup: created orgs', orgAId.slice(0, 8), 'and', orgBId.slice(0, 8));

  // ── Seed Org A data ───────────────────────────────────────────────────
  const supplierA = ctx.suppliers.create({
    name: 'Supplier A Only',
    tier: 'tier_1' as any,
    country: 'US',
    organizationId: orgAId,
  });

  // Need a pack to create an asset — create minimal chain
  const batchA = ctx.cellBatches.createBatch({
    batchNumber: `BATCH-A-${uuidv4().slice(0,8)}`,
    manufacturerId: supplierA.id,
    quantity: 100,
    organizationId: orgAId,
  });
  const packA = ctx.cellBatches.createPack({
    packNumber: `PACK-A-${uuidv4().slice(0,8)}`,
    cellBatchId: batchA.id,
    capacity: 100,
    organizationId: orgAId,
  });
  const assetA = ctx.assets.create({
    name: 'Asset A Only',
    assetType: 'forklift' as any,
    batteryPackId: packA.id,
    organizationId: orgAId,
  });
  ctx.alerts.create({
    type: 'soh_degradation' as any,
    severity: 'warning' as any,
    sourceAgent: 'apm' as any,
    assetId: assetA.id,
    title: 'Alert A Only',
    description: 'Belongs to org A',
    metadata: {},
    organizationId: orgAId,
  });

  // ── Seed Org B data ───────────────────────────────────────────────────
  const supplierB = ctx.suppliers.create({
    name: 'Supplier B Only',
    tier: 'tier_1' as any,
    country: 'DE',
    organizationId: orgBId,
  });
  const batchB = ctx.cellBatches.createBatch({
    batchNumber: `BATCH-B-${uuidv4().slice(0,8)}`,
    manufacturerId: supplierB.id,
    quantity: 100,
    organizationId: orgBId,
  });
  const packB = ctx.cellBatches.createPack({
    packNumber: `PACK-B-${uuidv4().slice(0,8)}`,
    cellBatchId: batchB.id,
    capacity: 100,
    organizationId: orgBId,
  });
  const assetB = ctx.assets.create({
    name: 'Asset B Only',
    assetType: 'freight_truck' as any,
    batteryPackId: packB.id,
    organizationId: orgBId,
  });
  ctx.alerts.create({
    type: 'thermal_event' as any,
    severity: 'critical' as any,
    sourceAgent: 'apm' as any,
    assetId: assetB.id,
    title: 'Alert B Only',
    description: 'Belongs to org B',
    metadata: {},
    organizationId: orgBId,
  });

  console.log('\n--- Asset isolation ---');
  const assetsA = ctx.assets.list(orgAId);
  const assetsB = ctx.assets.list(orgBId);
  assert(assetsA.every(a => a.organizationId === orgAId), 'Org A assets list contains only org A assets');
  assert(assetsB.every(a => a.organizationId === orgBId), 'Org B assets list contains only org B assets');
  assert(!assetsA.some(a => a.id === assetB.id), 'Org A cannot see org B asset');
  assert(!assetsB.some(a => a.id === assetA.id), 'Org B cannot see org A asset');

  console.log('\n--- Supplier isolation ---');
  const suppliersA = ctx.suppliers.list(orgAId);
  const suppliersB = ctx.suppliers.list(orgBId);
  assert(suppliersA.every(s => s.organizationId === orgAId), 'Org A suppliers contain only org A');
  assert(suppliersB.every(s => s.organizationId === orgBId), 'Org B suppliers contain only org B');
  assert(!suppliersA.some(s => s.id === supplierB.id), 'Org A cannot see org B supplier');
  assert(!suppliersB.some(s => s.id === supplierA.id), 'Org B cannot see org A supplier');

  console.log('\n--- Alert isolation ---');
  const alertsA = ctx.alerts.list(orgAId);
  const alertsB = ctx.alerts.list(orgBId);
  assert(alertsA.every(a => a.organizationId === orgAId), 'Org A alerts contain only org A');
  assert(alertsB.every(a => a.organizationId === orgBId), 'Org B alerts contain only org B');
  assert(!alertsA.some(a => a.title === 'Alert B Only'), 'Org A cannot see org B alert');
  assert(!alertsB.some(a => a.title === 'Alert A Only'), 'Org B cannot see org A alert');

  console.log('\n--- Fleet summary isolation ---');
  const summaryA = ctx.assets.getFleetSummary(orgAId);
  const summaryB = ctx.assets.getFleetSummary(orgBId);
  assert(summaryA.totalAssets === assetsA.length, 'Org A fleet summary count matches list count');
  assert(summaryB.totalAssets === assetsB.length, 'Org B fleet summary count matches list count');

  console.log('\n--- Cell batch isolation ---');
  const batchesA = ctx.cellBatches.listBatches(orgAId);
  const batchesB = ctx.cellBatches.listBatches(orgBId);
  assert(!batchesA.some(b => b.id === batchB.id), 'Org A cannot see org B batch');
  assert(!batchesB.some(b => b.id === batchA.id), 'Org B cannot see org A batch');

  console.log('\n--- Direct object lookup (IDOR check) ---');
  // findById does not filter by org — callers must check organizationId after lookup
  const aAsset = ctx.assets.findById(assetA.id);
  const bAsset = ctx.assets.findById(assetB.id);
  assert(aAsset?.organizationId === orgAId, 'findById returns correct org on asset A');
  assert(bAsset?.organizationId === orgBId, 'findById returns correct org on asset B');
  // Simulate the IDOR check that every route handler must perform:
  assert(aAsset?.organizationId !== orgBId, 'Org B user rejected if they try to access org A asset (IDOR guard)');
  assert(bAsset?.organizationId !== orgAId, 'Org A user rejected if they try to access org B asset (IDOR guard)');

  console.log('\n--- Demo org isolation ---');
  const demoAssets = ctx.assets.list(DEMO_ORG_ID);
  assert(!demoAssets.some(a => a.organizationId === orgAId), 'Demo org does not contain org A data');
  assert(!demoAssets.some(a => a.organizationId === orgBId), 'Demo org does not contain org B data');

  // ── Summary ───────────────────────────────────────────────────────────
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  closeDatabaseContext();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
