import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import type {
  Asset,
  FleetSummary,
  TelemetryData,
  SohHistory,
  Supplier,
  SupplyChainSummary,
  MaterialLot,
  AssetTrace,
  Alert,
  AlertCounts,
  AlertStatus,
  BatchCorrelation,
  SupplierCorrelation,
  User,
  Organization,
} from '../types';

// ── Base URL ──────────────────────────────────────────────────────────────
// In production VITE_API_URL points to the hosted backend (e.g. Railway).
// In local dev it is empty so the Vite proxy at /api → localhost:3000 is used.
const API_BASE = ((import.meta as any).env?.VITE_API_URL ?? '') + '/api';

// ── In-memory access token (not persisted — survives only for session) ─────
let _accessToken: string | null = null;
let _user: User | null = null;

function setAccessToken(token: string | null) { _accessToken = token; }
function getAccessToken(): string | null { return _accessToken; }
function setUser(user: User | null) { _user = user; }
function getUser(): User | null { return _user; }

// ── Axios client ──────────────────────────────────────────────────────────
const client: AxiosInstance = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // sends httpOnly refresh token cookie on every request
});

// Attach access token on every request
client.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
  const token = getAccessToken();
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// On 401 attempt one silent refresh; if that also fails, force re-login
let _refreshing = false;
let _refreshQueue: Array<(token: string) => void> = [];

client.interceptors.response.use(
  res => res,
  async (err: AxiosError) => {
    const original = err.config as any;
    if (err.response?.status !== 401 || original._retry) {
      return Promise.reject(err);
    }

    if (_refreshing) {
      // Queue requests while a refresh is in flight
      return new Promise((resolve) => {
        _refreshQueue.push((newToken) => {
          original.headers.Authorization = `Bearer ${newToken}`;
          resolve(client(original));
        });
      });
    }

    _refreshing = true;
    original._retry = true;

    try {
      // Refresh endpoint will automatically receive the httpOnly cookie
      const { data } = await axios.post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true });
      const { accessToken, user } = data;
      setAccessToken(accessToken);
      setUser(user);

      _refreshQueue.forEach(cb => cb(accessToken));
      _refreshQueue = [];

      original.headers.Authorization = `Bearer ${accessToken}`;
      return client(original);
    } catch {
      clearSession();
      return Promise.reject(err);
    } finally {
      _refreshing = false;
    }
  }
);

// Called by the 401 interceptor when a token refresh fails mid-session.
// Does a hard redirect as a last resort — React state is already stale at
// this point and the user needs to re-authenticate from scratch.
function clearSession() {
  setAccessToken(null);
  setUser(null);
  window.location.href = '/login';
}

// ── Auth ──────────────────────────────────────────────────────────────────

export const authApi = {
  login: async (email: string, password: string) => {
    const { data } = await client.post('/auth/login', { email, password });
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data as { accessToken: string; user: User };
  },

  signup: async (companyName: string, orgType: string, email: string, password: string) => {
    const { data } = await client.post('/auth/signup', { companyName, orgType, email, password });
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data as { accessToken: string; user: User; organization: Organization };
  },

  /** Silent refresh using the httpOnly cookie — called on app mount.
   *  Times out after 5 s so a cold Railway start doesn't block the UI. */
  silentRefresh: async (): Promise<{ accessToken: string; user: User }> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const { data } = await axios.post(
        `${API_BASE}/auth/refresh`,
        {},
        { withCredentials: true, signal: controller.signal }
      );
      setAccessToken(data.accessToken);
      setUser(data.user);
      return data;
    } finally {
      clearTimeout(timer);
    }
  },

  logout: async () => {
    try { await client.post('/auth/logout'); } catch { /* ignore */ }
    // Only clear in-memory tokens here. Navigation is handled by the
    // React auth context so we avoid a hard reload that would re-trigger
    // silentRefresh before the logout cookie is invalidated.
    setAccessToken(null);
    setUser(null);
  },

  me: async (): Promise<User> => {
    const { data } = await client.get<{ user: User }>('/auth/me');
    setUser(data.user);
    return data.user;
  },

  getAccessToken,
  getUser,
  setAccessToken,
  setUser,
};

// ── Fleet APM ─────────────────────────────────────────────────────────────

export const apmApi = {
  getDashboard: async (): Promise<FleetSummary> => {
    const { data } = await client.get<FleetSummary>('/apm/dashboard');
    return data;
  },

  getAssets: async (params?: { status?: string; type?: string }) => {
    const { data } = await client.get('/apm/assets', { params });
    return data as { assets: Asset[]; summary: FleetSummary };
  },

  getAsset: async (id: string) => {
    const { data } = await client.get(`/apm/assets/${id}`);
    return data as { asset: Asset; sohHistory: SohHistory[]; alerts: Alert[] };
  },

  getTelemetry: async (assetId: string, limit = 200): Promise<TelemetryData[]> => {
    const { data } = await client.get(`/apm/assets/${assetId}/telemetry`, { params: { limit } });
    return data.telemetry;
  },

  ingestTelemetry: async (payload: {
    assetId: string; voltage: number; current: number;
    temperature: number; stateOfCharge: number; cycleCount: number;
  }) => {
    const { data } = await client.post('/apm/telemetry', payload);
    return data as { telemetryId: string };
  },

  createAsset: async (payload: {
    name: string; assetType: string; batteryPackId: string;
  }) => {
    const { data } = await client.post('/apm/assets', payload);
    return data.asset as import('../types').Asset;
  },
};

// ── Supply Chain ──────────────────────────────────────────────────────────

export const supplyChainApi = {
  getDashboard: async (): Promise<SupplyChainSummary> => {
    const { data } = await client.get<SupplyChainSummary>('/supply-chain/dashboard');
    return data;
  },

  getSuppliers: async (params?: { tier?: string; highRiskOnly?: boolean }) => {
    const { data } = await client.get('/supply-chain/suppliers', { params });
    return data as { suppliers: Supplier[]; summary: { totalSuppliers: number; highRiskSuppliers: number; avgRiskScore: number } };
  },

  getSupplier: async (id: string) => {
    const { data } = await client.get(`/supply-chain/suppliers/${id}`);
    return data as { supplier: Supplier; materialLots: MaterialLot[]; alerts: Alert[] };
  },

  getMaterials: async (params?: { supplierId?: string; materialType?: string }): Promise<MaterialLot[]> => {
    const { data } = await client.get('/supply-chain/materials', { params });
    return data.materials;
  },

  traceAsset: async (assetId: string): Promise<AssetTrace> => {
    const { data } = await client.get(`/supply-chain/trace/${assetId}`);
    return data.trace;
  },

  createSupplier: async (payload: {
    name: string; tier: string; country: string; certificationExpiry?: string;
  }) => {
    const { data } = await client.post('/supply-chain/suppliers', payload);
    return data.supplier as Supplier;
  },

  createMaterialLot: async (payload: {
    lotNumber: string; materialType: string; supplierId: string;
    quantity: number; country: string; qualityScore?: number;
    specificationMin?: number; specificationMax?: number;
  }) => {
    const { data } = await client.post('/supply-chain/materials', payload);
    return data.materialLot as MaterialLot;
  },

  createCellBatch: async (payload: {
    batchNumber: string; manufacturerId: string; quantity: number; productionDate?: string;
  }) => {
    const { data } = await client.post('/supply-chain/cell-batches', payload);
    return data.cellBatch;
  },

  createBatteryPack: async (payload: {
    packNumber: string; cellBatchId: string; capacity: number; assemblyDate?: string;
  }) => {
    const { data } = await client.post('/supply-chain/battery-packs', payload);
    return data.batteryPack;
  },
};

// ── Alerts ────────────────────────────────────────────────────────────────

export const alertsApi = {
  getAlerts: async (params?: {
    status?: AlertStatus; sourceAgent?: string;
    assetId?: string; supplierId?: string; limit?: number;
  }) => {
    const { data } = await client.get('/alerts', { params });
    return data as { alerts: Alert[]; counts: AlertCounts };
  },

  acknowledge: async (id: string): Promise<void> => { await client.put(`/alerts/${id}/acknowledge`); },
  resolve:     async (id: string): Promise<void> => { await client.put(`/alerts/${id}/resolve`); },

  getStatsByAgent: async () => {
    const { data } = await client.get('/alerts/stats/by-agent');
    return data.stats as Record<string, { open: number; total: number }>;
  },
};

// ── Correlation ───────────────────────────────────────────────────────────

export const correlationApi = {
  getBatchCorrelations:    async (): Promise<BatchCorrelation[]>    => { const { data } = await client.get('/correlation/batches');    return data.correlations; },
  getSupplierCorrelations: async (): Promise<SupplierCorrelation[]> => { const { data } = await client.get('/correlation/suppliers');  return data.correlations; },
  getBatchCorrelation:     async (id: string): Promise<BatchCorrelation>    => { const { data } = await client.get(`/correlation/batch/${id}`);    return data.correlation; },
  getSupplierCorrelation:  async (id: string): Promise<SupplierCorrelation> => { const { data } = await client.get(`/correlation/supplier/${id}`);  return data.correlation; },
  runAnalysis: async () => {
    const { data } = await client.post('/correlation/analyze');
    return data.results as { batchesAnalyzed: number; suppliersAnalyzed: number; insightsGenerated: number };
  },
};