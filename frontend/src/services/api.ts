import axios, { AxiosError, AxiosInstance } from 'axios';
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
} from '../types';

// ── Base URL ──────────────────────────────────────────────────────────────
// In production VITE_API_URL points to the hosted backend (e.g. Render).
// In local dev it is empty so the Vite proxy at /api → localhost:3000 is used.
const API_BASE = ((import.meta as any).env?.VITE_API_URL ?? '') + '/api';

// ── Axios client ──────────────────────────────────────────────────────────

const client: AxiosInstance = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
});

// Attach access token on every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('cs_access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
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

    const refreshToken = localStorage.getItem('cs_refresh_token');
    if (!refreshToken) {
      _clearSession();
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
      const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken });
      const { accessToken, refreshToken: newRefresh } = data;
      localStorage.setItem('cs_access_token',  accessToken);
      localStorage.setItem('cs_refresh_token', newRefresh);

      _refreshQueue.forEach(cb => cb(accessToken));
      _refreshQueue = [];

      original.headers.Authorization = `Bearer ${accessToken}`;
      return client(original);
    } catch {
      _clearSession();
      return Promise.reject(err);
    } finally {
      _refreshing = false;
    }
  }
);

function _clearSession() {
  localStorage.removeItem('cs_access_token');
  localStorage.removeItem('cs_refresh_token');
  localStorage.removeItem('cs_user');
  window.location.href = '/login';
}

// ── Auth ──────────────────────────────────────────────────────────────────

export const authApi = {
  login: async (email: string, password: string) => {
    const { data } = await client.post('/auth/login', { email, password });
    // Store both tokens
    localStorage.setItem('cs_access_token',  data.accessToken);
    localStorage.setItem('cs_refresh_token', data.refreshToken);
    localStorage.setItem('cs_user', JSON.stringify(data.user));
    return data as { accessToken: string; refreshToken: string; user: User };
  },
  logout: async () => {
    const refreshToken = localStorage.getItem('cs_refresh_token');
    try { await client.post('/auth/logout', { refreshToken }); } catch { /* ignore */ }
    _clearSession();
  },
  me: async (): Promise<User> => {
    const { data } = await client.get<{ user: User }>('/auth/me');
    return data.user;
  },
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
