import axios, { AxiosError, AxiosInstance } from 'axios';
import type {
  AuthToken,
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

// ───────────────────────────────────────────────
// Axios client
// ───────────────────────────────────────────────

const client: AxiosInstance = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Attach token on every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('cs_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, clear token and redirect to login
client.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('cs_token');
      localStorage.removeItem('cs_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ───────────────────────────────────────────────
// Auth
// ───────────────────────────────────────────────

export const authApi = {
  login: async (email: string, password: string): Promise<AuthToken> => {
    const { data } = await client.post<AuthToken>('/auth/login', { email, password });
    return data;
  },
  me: async (): Promise<User> => {
    const { data } = await client.get<{ user: User }>('/auth/me');
    return data.user;
  },
};

// ───────────────────────────────────────────────
// Fleet APM
// ───────────────────────────────────────────────

export const apmApi = {
  getDashboard: async (): Promise<FleetSummary> => {
    const { data } = await client.get<FleetSummary>('/apm/dashboard');
    return data;
  },

  getAssets: async (params?: { status?: string; type?: string }): Promise<{ assets: Asset[]; summary: FleetSummary }> => {
    const { data } = await client.get('/apm/assets', { params });
    return data;
  },

  getAsset: async (id: string): Promise<{ asset: Asset; sohHistory: SohHistory[]; alerts: Alert[] }> => {
    const { data } = await client.get(`/apm/assets/${id}`);
    return data;
  },

  getTelemetry: async (assetId: string, limit = 200): Promise<TelemetryData[]> => {
    const { data } = await client.get(`/apm/assets/${assetId}/telemetry`, { params: { limit } });
    return data.telemetry;
  },

  ingestTelemetry: async (payload: {
    assetId: string;
    voltage: number;
    current: number;
    temperature: number;
    stateOfCharge: number;
    cycleCount: number;
  }): Promise<{ telemetryId: string }> => {
    const { data } = await client.post('/apm/telemetry', payload);
    return data;
  },
};

// ───────────────────────────────────────────────
// Supply Chain
// ───────────────────────────────────────────────

export const supplyChainApi = {
  getDashboard: async (): Promise<SupplyChainSummary> => {
    const { data } = await client.get<SupplyChainSummary>('/supply-chain/dashboard');
    return data;
  },

  getSuppliers: async (params?: { tier?: string; highRiskOnly?: boolean }): Promise<{ suppliers: Supplier[]; summary: { totalSuppliers: number; highRiskSuppliers: number; avgRiskScore: number } }> => {
    const { data } = await client.get('/supply-chain/suppliers', { params });
    return data;
  },

  getSupplier: async (id: string): Promise<{ supplier: Supplier; materialLots: MaterialLot[]; alerts: Alert[] }> => {
    const { data } = await client.get(`/supply-chain/suppliers/${id}`);
    return data;
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

// ───────────────────────────────────────────────
// Alerts
// ───────────────────────────────────────────────

export const alertsApi = {
  getAlerts: async (params?: {
    status?: AlertStatus;
    sourceAgent?: string;
    assetId?: string;
    supplierId?: string;
    limit?: number;
  }): Promise<{ alerts: Alert[]; counts: AlertCounts }> => {
    const { data } = await client.get('/alerts', { params });
    return data;
  },

  acknowledge: async (id: string): Promise<void> => {
    await client.put(`/alerts/${id}/acknowledge`);
  },

  resolve: async (id: string): Promise<void> => {
    await client.put(`/alerts/${id}/resolve`);
  },

  getStatsByAgent: async (): Promise<Record<string, { open: number; total: number }>> => {
    const { data } = await client.get('/alerts/stats/by-agent');
    return data.stats;
  },
};

// ───────────────────────────────────────────────
// Correlation
// ───────────────────────────────────────────────

export const correlationApi = {
  getBatchCorrelations: async (): Promise<BatchCorrelation[]> => {
    const { data } = await client.get('/correlation/batches');
    return data.correlations;
  },

  getSupplierCorrelations: async (): Promise<SupplierCorrelation[]> => {
    const { data } = await client.get('/correlation/suppliers');
    return data.correlations;
  },

  getBatchCorrelation: async (batchId: string): Promise<BatchCorrelation> => {
    const { data } = await client.get(`/correlation/batch/${batchId}`);
    return data.correlation;
  },

  getSupplierCorrelation: async (supplierId: string): Promise<SupplierCorrelation> => {
    const { data } = await client.get(`/correlation/supplier/${supplierId}`);
    return data.correlation;
  },

  runAnalysis: async (): Promise<{ batchesAnalyzed: number; suppliersAnalyzed: number; insightsGenerated: number }> => {
    const { data } = await client.post('/correlation/analyze');
    return data.results;
  },
};
