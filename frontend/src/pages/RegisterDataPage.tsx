import { useState, FormEvent, useEffect } from 'react';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { PackageSearch, Layers, Box, Battery, Truck, CheckCircle, AlertCircle } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import PageContainer from '../components/ui/PageContainer';
import { supplyChainApi, apmApi } from '../services/api';
import type { Supplier } from '../types';

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <tr>
      <td style={{ padding: '5px 12px 5px 0', fontSize: 12, color: '#4a4a4a', whiteSpace: 'nowrap', border: 'none', background: 'transparent', verticalAlign: 'middle', width: 160 }}>
        {label}{required && <span style={{ color: '#c00000' }}> *</span>}
      </td>
      <td style={{ padding: '4px 0', border: 'none', background: 'transparent' }}>
        {children}
      </td>
    </tr>
  );
}

function FormWrap({ children }: { children: React.ReactNode }) {
  return <table style={{ width: '100%', borderCollapse: 'collapse' }}><tbody>{children}</tbody></table>;
}

interface Msg { ok: boolean; text: string }

function MsgBanner({ msg }: { msg: Msg | null }) {
  if (!msg) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '6px 10px', marginBottom: 12, fontSize: 12, borderRadius: 2,
      background: msg.ok ? '#d4edda' : '#f8d7da',
      border: `1px solid ${msg.ok ? '#70c070' : '#e07070'}`,
      color: msg.ok ? '#155724' : '#721c24',
    }}>
      {msg.ok ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
      {msg.text}
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box' };
const selectStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '2px 4px' };

const COUNTRIES = ['US','GB','DE','FR','JP','KR','CN','CA','AU','SE','NO','IN','BR','MX','CD','ZA','NG'];
const TIERS = [{ v: 'tier_1', l: 'Tier 1 â€” Battery Pack Assembler' }, { v: 'tier_2', l: 'Tier 2 â€” Cell Manufacturer' }, { v: 'tier_3', l: 'Tier 3 â€” Raw Material Supplier' }];
const MATERIAL_TYPES = ['lithium','cobalt','nickel','graphite','manganese'];
const ASSET_TYPES = [{ v: 'freight_truck', l: 'Freight Truck' }, { v: 'mining_vehicle', l: 'Mining Vehicle' }, { v: 'forklift', l: 'Forklift' }, { v: 'construction_equipment', l: 'Construction Equipment' }];

// â”€â”€ Tabs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type Tab = 'supplier' | 'material' | 'batch' | 'pack' | 'asset';

const TABS: { id: Tab; label: string; icon: React.ReactNode; role: 'fleet' | 'supply' | 'both' }[] = [
  { id: 'supplier', label: 'Supplier',       icon: <PackageSearch size={12} />, role: 'supply' },
  { id: 'material', label: 'Material Lot',   icon: <Layers size={12} />,        role: 'supply' },
  { id: 'batch',    label: 'Cell Batch',     icon: <Box size={12} />,           role: 'supply' },
  { id: 'pack',     label: 'Battery Pack',   icon: <Battery size={12} />,       role: 'both'   },
  { id: 'asset',    label: 'Asset',          icon: <Truck size={12} />,         role: 'fleet'  },
];

// â”€â”€ Individual forms â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function AddSupplierForm() {
  const [name, setName]       = useState('');
  const [tier, setTier]       = useState('tier_1');
  const [country, setCountry] = useState('US');
  const [certExpiry, setCert] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState<Msg | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault(); setMsg(null); setLoading(true);
    try {
      const s = await supplyChainApi.createSupplier({ name, tier, country, certificationExpiry: certExpiry || undefined });
      setMsg({ ok: true, text: `Supplier "${s.name}" registered successfully.` });
      setName(''); setCert('');
    } catch (err: any) {
      setMsg({ ok: false, text: err?.response?.data?.error ?? 'Failed to register supplier.' });
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={submit}>
      <MsgBanner msg={msg} />
      <FormWrap>
        <Field label="Supplier name" required><input style={inputStyle} required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Acme Lithium Corp" /></Field>
        <Field label="Tier" required>
          <select style={selectStyle} value={tier} onChange={e => setTier(e.target.value)}>
            {TIERS.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
        </Field>
        <Field label="Country" required>
          <select style={selectStyle} value={country} onChange={e => setCountry(e.target.value)}>
            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Certification expiry">
          <input type="date" style={inputStyle} value={certExpiry} onChange={e => setCert(e.target.value)} />
        </Field>
      </FormWrap>
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
        <button type="submit" disabled={loading} className="win-btn win-btn-primary">{loading ? 'Registeringâ€¦' : 'Register Supplier'}</button>
      </div>
    </form>
  );
}

function AddMaterialLotForm() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [lotNum, setLotNum]       = useState('');
  const [matType, setMatType]     = useState('lithium');
  const [suppId, setSuppId]       = useState('');
  const [qty, setQty]             = useState('');
  const [country, setCountry]     = useState('US');
  const [qualScore, setQualScore] = useState('');
  const [loading, setLoading]     = useState(false);
  const [msg, setMsg]             = useState<Msg | null>(null);

  useEffect(() => {
    supplyChainApi.getSuppliers().then(d => {
      setSuppliers(d.suppliers.filter(s => s.tier === 'tier_3'));
      if (d.suppliers.length > 0) setSuppId(d.suppliers[0].id);
    }).catch(() => {});
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault(); setMsg(null); setLoading(true);
    try {
      await supplyChainApi.createMaterialLot({
        lotNumber: lotNum, materialType: matType, supplierId: suppId,
        quantity: parseFloat(qty), country,
        qualityScore: qualScore ? parseFloat(qualScore) : undefined,
        specificationMin: 85, specificationMax: 95,
      });
      setMsg({ ok: true, text: `Material lot "${lotNum}" registered.` });
      setLotNum(''); setQty(''); setQualScore('');
    } catch (err: any) {
      setMsg({ ok: false, text: err?.response?.data?.error ?? 'Failed to register material lot.' });
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={submit}>
      <MsgBanner msg={msg} />
      {suppliers.length === 0 && (
        <div style={{ fontSize: 11, color: '#b87000', marginBottom: 10, padding: '5px 8px', background: '#fff8e6', border: '1px solid #e0c060', borderRadius: 2 }}>
          âš  No Tier 3 suppliers found. Register a Tier 3 supplier first.
        </div>
      )}
      <FormWrap>
        <Field label="Lot number" required><input style={inputStyle} required value={lotNum} onChange={e => setLotNum(e.target.value)} placeholder="e.g. LITH-US-2026-00001" /></Field>
        <Field label="Material type" required>
          <select style={selectStyle} value={matType} onChange={e => setMatType(e.target.value)}>
            {MATERIAL_TYPES.map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
          </select>
        </Field>
        <Field label="Supplier" required>
          <select style={selectStyle} value={suppId} onChange={e => setSuppId(e.target.value)} disabled={suppliers.length === 0}>
            {suppliers.length === 0 ? <option>No suppliers available</option> : suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Quantity (kg)" required><input type="number" min="1" style={inputStyle} required value={qty} onChange={e => setQty(e.target.value)} placeholder="e.g. 2500" /></Field>
        <Field label="Country of origin" required>
          <select style={selectStyle} value={country} onChange={e => setCountry(e.target.value)}>
            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Quality score (0â€“100)"><input type="number" min="0" max="100" style={inputStyle} value={qualScore} onChange={e => setQualScore(e.target.value)} placeholder="Optional" /></Field>
      </FormWrap>
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
        <button type="submit" disabled={loading || suppliers.length === 0} className="win-btn win-btn-primary">{loading ? 'Registeringâ€¦' : 'Register Material Lot'}</button>
      </div>
    </form>
  );
}

function AddCellBatchForm() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [batchNum, setBatchNum]   = useState('');
  const [mfrId, setMfrId]         = useState('');
  const [qty, setQty]             = useState('');
  const [prodDate, setProdDate]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [msg, setMsg]             = useState<Msg | null>(null);

  useEffect(() => {
    supplyChainApi.getSuppliers().then(d => {
      const tier2 = d.suppliers.filter(s => s.tier === 'tier_2');
      setSuppliers(tier2);
      if (tier2.length > 0) setMfrId(tier2[0].id);
    }).catch(() => {});
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault(); setMsg(null); setLoading(true);
    try {
      await supplyChainApi.createCellBatch({
        batchNumber: batchNum, manufacturerId: mfrId,
        quantity: parseInt(qty), productionDate: prodDate || undefined,
      });
      setMsg({ ok: true, text: `Cell batch "${batchNum}" registered.` });
      setBatchNum(''); setQty(''); setProdDate('');
    } catch (err: any) {
      setMsg({ ok: false, text: err?.response?.data?.error ?? 'Failed to register cell batch.' });
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={submit}>
      <MsgBanner msg={msg} />
      {suppliers.length === 0 && (
        <div style={{ fontSize: 11, color: '#b87000', marginBottom: 10, padding: '5px 8px', background: '#fff8e6', border: '1px solid #e0c060', borderRadius: 2 }}>
          âš  No Tier 2 suppliers found. Register a cell manufacturer (Tier 2) supplier first.
        </div>
      )}
      <FormWrap>
        <Field label="Batch number" required><input style={inputStyle} required value={batchNum} onChange={e => setBatchNum(e.target.value)} placeholder="e.g. CELL-LGES-0001" /></Field>
        <Field label="Manufacturer (Tier 2)" required>
          <select style={selectStyle} value={mfrId} onChange={e => setMfrId(e.target.value)} disabled={suppliers.length === 0}>
            {suppliers.length === 0 ? <option>No manufacturers available</option> : suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Cell quantity" required><input type="number" min="1" style={inputStyle} required value={qty} onChange={e => setQty(e.target.value)} placeholder="e.g. 5000" /></Field>
        <Field label="Production date"><input type="date" style={inputStyle} value={prodDate} onChange={e => setProdDate(e.target.value)} /></Field>
      </FormWrap>
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
        <button type="submit" disabled={loading || suppliers.length === 0} className="win-btn win-btn-primary">{loading ? 'Registeringâ€¦' : 'Register Cell Batch'}</button>
      </div>
    </form>
  );
}

function AddBatteryPackForm() {
  const [packNum, setPackNum] = useState('');
  const [batchId, setBatchId] = useState('');
  const [capacity, setCapacity] = useState('');
  const [assemblyDate, setAssemblyDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg]         = useState<Msg | null>(null);

  useEffect(() => {
    // Fetch cell batches via materials endpoint workaround â€” use suppliers list
    // to populate. For now fetch from supply chain dashboard stats.
    fetch('/api/supply-chain/suppliers', { headers: { Authorization: `Bearer ${localStorage.getItem('cs_access_token')}` } })
      .then(r => r.json())
      .then(() => {
        // Cell batches don't have a direct list endpoint on the frontend yet
        // â€” we'll add a note for the user
      })
      .catch(() => {});
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault(); setMsg(null); setLoading(true);
    try {
      await supplyChainApi.createBatteryPack({
        packNumber: packNum, cellBatchId: batchId,
        capacity: parseFloat(capacity), assemblyDate: assemblyDate || undefined,
      });
      setMsg({ ok: true, text: `Battery pack "${packNum}" registered.` });
      setPackNum(''); setBatchId(''); setCapacity(''); setAssemblyDate('');
    } catch (err: any) {
      setMsg({ ok: false, text: err?.response?.data?.error ?? 'Failed to register battery pack.' });
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={submit}>
      <MsgBanner msg={msg} />
      <div style={{ fontSize: 11, color: '#6a6a6a', marginBottom: 10, padding: '5px 8px', background: '#e8f0fb', border: '1px solid #b0c8e8', borderRadius: 2 }}>
        â„¹ You will need the Cell Batch ID from a previously registered batch. Find it in the Supplier Portal â†’ cell batches list.
      </div>
      <FormWrap>
        <Field label="Pack number" required><input style={inputStyle} required value={packNum} onChange={e => setPackNum(e.target.value)} placeholder="e.g. PACK-CELL-LGES-0001-01" /></Field>
        <Field label="Cell batch ID" required><input style={inputStyle} required value={batchId} onChange={e => setBatchId(e.target.value)} placeholder="Paste the cell batch UUID" /></Field>
        <Field label="Capacity (kWh)" required><input type="number" min="1" step="0.1" style={inputStyle} required value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="e.g. 150" /></Field>
        <Field label="Assembly date"><input type="date" style={inputStyle} value={assemblyDate} onChange={e => setAssemblyDate(e.target.value)} /></Field>
      </FormWrap>
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
        <button type="submit" disabled={loading} className="win-btn win-btn-primary">{loading ? 'Registeringâ€¦' : 'Register Battery Pack'}</button>
      </div>
    </form>
  );
}

function AddAssetForm() {
  const [name, setName]         = useState('');
  const [assetType, setAssetType] = useState('freight_truck');
  const [packId, setPackId]     = useState('');
  const [loading, setLoading]   = useState(false);
  const [msg, setMsg]           = useState<Msg | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault(); setMsg(null); setLoading(true);
    try {
      const asset = await apmApi.createAsset({ name, assetType, batteryPackId: packId });
      setMsg({ ok: true, text: `Asset "${asset.name}" registered. It will appear in Fleet Health once telemetry is ingested.` });
      setName(''); setPackId('');
    } catch (err: any) {
      setMsg({ ok: false, text: err?.response?.data?.error ?? 'Failed to register asset.' });
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={submit}>
      <MsgBanner msg={msg} />
      <div style={{ fontSize: 11, color: '#6a6a6a', marginBottom: 10, padding: '5px 8px', background: '#e8f0fb', border: '1px solid #b0c8e8', borderRadius: 2 }}>
        â„¹ You will need a Battery Pack ID. Register a battery pack first, then paste its ID here.
      </div>
      <FormWrap>
        <Field label="Asset name" required><input style={inputStyle} required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. FreightLiner-001" /></Field>
        <Field label="Asset type" required>
          <select style={selectStyle} value={assetType} onChange={e => setAssetType(e.target.value)}>
            {ASSET_TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
        </Field>
        <Field label="Battery pack ID" required><input style={inputStyle} required value={packId} onChange={e => setPackId(e.target.value)} placeholder="Paste the battery pack UUID" /></Field>
      </FormWrap>
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
        <button type="submit" disabled={loading} className="win-btn win-btn-primary">{loading ? 'Registeringâ€¦' : 'Register Asset'}</button>
      </div>
    </form>
  );
}

// â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function RegisterDataPage() {
  useDocumentMeta({ title: 'Register Data' });
  const [activeTab, setActiveTab] = useState<Tab>('supplier');

  const formMap: Record<Tab, React.ReactNode> = {
    supplier: <AddSupplierForm />,
    material: <AddMaterialLotForm />,
    batch:    <AddCellBatchForm />,
    pack:     <AddBatteryPackForm />,
    asset:    <AddAssetForm />,
  };

  const descMap: Record<Tab, string> = {
    supplier: 'Register a raw material supplier, cell manufacturer, or battery pack assembler.',
    material: 'Register a material lot (lithium, cobalt, nickel, etc.) from a Tier 3 supplier.',
    batch:    'Register a cell batch produced by a Tier 2 cell manufacturer.',
    pack:     'Register a battery pack assembled from a cell batch.',
    asset:    'Register a fleet asset (vehicle, forklift, etc.) and link it to its battery pack.',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Navbar title="Register Data" subtitle="Add suppliers, materials, batches, packs and assets to your organization" />
      <PageContainer>
        <div style={{ maxWidth: 620 }}>
          <div style={{ fontSize: 12, color: '#4a4a4a', marginBottom: 14, padding: '8px 10px', background: '#e8f0fb', border: '1px solid #b0c8e8', borderRadius: 2 }}>
            <strong>Getting started:</strong> Register data in this order â€” <strong>Supplier â†’ Material Lot â†’ Cell Batch â†’ Battery Pack â†’ Asset</strong>.
            Each step depends on the previous one.
          </div>

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid #7f9db9', marginBottom: 0 }}>
            {TABS.map(tab => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="win-btn"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '4px 12px', fontSize: 11, borderRadius: '3px 3px 0 0',
                    borderBottom: active ? '1px solid #f0f4f8' : '1px solid #7f9db9',
                    background: active ? '#f0f4f8' : 'linear-gradient(to bottom,#e8f0fb,#c8d8ef)',
                    color: active ? '#0a246a' : '#4a4a4a',
                    fontWeight: active ? 'bold' : 'normal',
                    marginBottom: active ? -1 : 0, position: 'relative', zIndex: active ? 1 : 0,
                    boxShadow: 'none',
                  }}
                >
                  {tab.icon} {tab.label}
                </button>
              );
            })}
          </div>

          {/* Form panel */}
          <div className="win-panel" style={{ borderRadius: '0 4px 4px 4px', marginTop: 0 }}>
            <div style={{ padding: '4px 14px 8px', fontSize: 11, color: '#6a6a6a', borderBottom: '1px solid #d0dce8' }}>
              {descMap[activeTab]}
            </div>
            <div style={{ padding: '14px 16px' }}>
              {formMap[activeTab]}
            </div>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
