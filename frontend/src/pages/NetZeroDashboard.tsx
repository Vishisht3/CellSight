import { useState, useEffect } from 'react';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { Leaf, TrendingDown, Target, Zap } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import axios from 'axios';
import Navbar from '../components/layout/Navbar';
import PageContainer from '../components/ui/PageContainer';
import StatCard from '../components/ui/StatCard';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorBanner from '../components/ui/ErrorBanner';

interface NetZeroProgress {
  targetYear: number;
  baseline: {
    year: number;
    scope1Tonnes: number;
    scope3Tonnes: number;
    totalTonnes: number;
  };
  target: {
    scope1Tonnes: number;
    scope3Tonnes: number;
    totalTonnes: number;
  };
  current: {
    scope1Tonnes: number;
    scope3Tonnes: number;
    totalTonnes: number;
  };
  progress: {
    scope1PercentReduction: number;
    scope3PercentReduction: number;
    totalPercentReduction: number;
    scope1RemainingTonnes: number;
    scope3RemainingTonnes: number;
    totalRemainingTonnes: number;
  };
}

interface ElectrificationPriority {
  assetId: string;
  assetName: string;
  assetType: string;
  currentAnnualCo2Tonnes: number;
  potentialAnnualReduction: number;
  readinessScore: number;
  evRecommendation: string | null;
  estimatedCostSaving: number | null;
  priority: 'high' | 'medium' | 'low';
  route: string | null;
}

interface RouteEmissionAnalysis {
  route: string;
  totalDistanceKm: number;
  totalCo2Tonnes: number;
  co2PerKm: number;
  assetCount: number;
  evCount: number;
  iceCount: number;
  potentialReduction: number;
}

export default function NetZeroDashboard() {
  useDocumentMeta({ title: 'Net Zero Progress' });

  const [progress, setProgress] = useState<NetZeroProgress | null>(null);
  const [priorities, setPriorities] = useState<ElectrificationPriority[]>([]);
  const [routes, setRoutes] = useState<RouteEmissionAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [progressRes, prioritiesRes, routesRes] = await Promise.all([
        axios.get('/api/net-zero/progress'),
        axios.get('/api/net-zero/priorities'),
        axios.get('/api/net-zero/routes'),
      ]);

      setProgress(progressRes.data.progress);
      setPriorities(prioritiesRes.data.priorities || []);
      setRoutes(routesRes.data.routes || []);
      setError('');
    } catch (err) {
      setError('Failed to load Net Zero data');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  if (!progress) {
    return (
      <>
        <Navbar title="Net Zero Progress Dashboard" subtitle="Track fleet electrification and emission reductions" />
        <PageContainer>
          <ErrorBanner message="No net-zero target configured for this organization" />
        </PageContainer>
      </>
    );
  }

  // Prepare progress chart data
  const progressChartData = [
    {
      category: 'Scope 1',
      baseline: progress.baseline.scope1Tonnes,
      current: progress.current.scope1Tonnes,
      target: progress.target.scope1Tonnes,
    },
    {
      category: 'Scope 3',
      baseline: progress.baseline.scope3Tonnes,
      current: progress.current.scope3Tonnes,
      target: progress.target.scope3Tonnes,
    },
  ];

  // Prepare priorities chart data (top 10 by CO2 impact)
  const prioritiesChartData = priorities
    .sort((a, b) => b.currentAnnualCo2Tonnes - a.currentAnnualCo2Tonnes)
    .slice(0, 10)
    .map((p) => ({
      name: p.assetName,
      current: p.currentAnnualCo2Tonnes,
      potential: p.potentialAnnualReduction,
      priority: p.priority,
    }));

  const highPriorityCount = priorities.filter((p) => p.priority === 'high').length;
  const totalPotentialReduction = priorities.reduce((sum, p) => sum + p.potentialAnnualReduction, 0);

  const topRoutes = routes.slice(0, 5);

  return (
    <>
      <Navbar
        title="Net Zero Progress & Carbon Intelligence"
        subtitle="Track fleet electrification against organizational net-zero commitments"
      />
      <PageContainer>
        {error && <ErrorBanner message={error} />}

        {/* KPI Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          <StatCard
            label="Total Reduction Achieved"
            value={`${(progress.baseline.totalTonnes - progress.current.totalTonnes).toFixed(0)} t`}
            icon={<Leaf size={16} />}
            variant="success"
            subValue={`${progress.progress.totalPercentReduction.toFixed(1)}% of baseline`}
          />
          <StatCard
            label="Remaining to Target"
            value={`${progress.progress.totalRemainingTonnes.toFixed(0)} t`}
            icon={<Target size={16} />}
            variant={progress.progress.totalRemainingTonnes > 500 ? 'danger' : 'warning'}
            subValue={`Target: ${progress.targetYear}`}
          />
          <StatCard
            label="High-Priority Assets"
            value={highPriorityCount}
            icon={<Zap size={16} />}
            variant={highPriorityCount > 0 ? 'warning' : 'success'}
            subValue="Electrification candidates"
          />
          <StatCard
            label="Potential Annual Reduction"
            value={`${totalPotentialReduction.toFixed(0)} t`}
            icon={<TrendingDown size={16} />}
            variant="info"
            subValue="If all priorities electrified"
          />
        </div>

        {/* Progress Chart */}
        <div className="win-panel" style={{ overflow: 'hidden' }}>
          <div className="win-section-header">
            Net Zero Progress: Baseline ({progress.baseline.year}) → Current (2026) → Target ({progress.targetYear})
          </div>
          <div style={{ padding: 12 }}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={progressChartData} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d0dce8" vertical={false} />
                <XAxis
                  dataKey="category"
                  tick={{ fontSize: 11, fill: '#4a4a4a' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#4a4a4a' }}
                  tickLine={false}
                  axisLine={false}
                  label={{ value: 'CO₂ (tonnes/year)', angle: -90, position: 'insideLeft', fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{
                    background: '#fff',
                    border: '1px solid #c0cfe0',
                    borderRadius: 3,
                    fontSize: 11,
                    padding: '6px 10px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
                <Bar dataKey="baseline" fill="#888" name={`Baseline (${progress.baseline.year})`} />
                <Bar dataKey="current" fill="#316ac5" name="Current (2026)" />
                <Bar dataKey="target" fill="#2a8a2a" name={`Target (${progress.targetYear})`} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Electrification Priorities */}
        {priorities.length > 0 && (
          <div className="win-panel" style={{ overflow: 'hidden' }}>
            <div className="win-section-header">
              Electrification Priorities — Top 10 Assets by Annual CO₂ Impact
            </div>
            <div style={{ padding: 12 }}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={prioritiesChartData} margin={{ top: 8, right: 24, bottom: 44, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d0dce8" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 9, fill: '#4a4a4a' }}
                    tickLine={false}
                    axisLine={false}
                    angle={-35}
                    textAnchor="end"
                    interval={0}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#4a4a4a' }}
                    tickLine={false}
                    axisLine={false}
                    label={{ value: 'CO₂ (tonnes/year)', angle: -90, position: 'insideLeft', fontSize: 10 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: '#fff',
                      border: '1px solid #c0cfe0',
                      borderRadius: 3,
                      fontSize: 11,
                      padding: '6px 10px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
                  <Bar dataKey="current" fill="#c00000" name="Current Annual Emissions" />
                  <Bar dataKey="potential" fill="#2a8a2a" name="Potential Reduction (90%)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Priorities Table */}
        {priorities.length > 0 && (
          <div className="win-panel" style={{ overflow: 'hidden' }}>
            <div className="win-section-header">Electrification Priority Queue — Ranked by Carbon Impact</div>
            <div style={{ overflowX: 'auto' }}>
              <table className="win-table">
                <thead>
                  <tr>
                    <th>Asset Name</th>
                    <th>Type</th>
                    <th>Current CO₂/yr</th>
                    <th>Potential Reduction</th>
                    <th>Readiness Score</th>
                    <th>EV Recommendation</th>
                    <th>Est. Saving/yr</th>
                    <th>Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {priorities.slice(0, 15).map((p) => (
                    <tr key={p.assetId}>
                      <td style={{ fontWeight: 600 }}>{p.assetName}</td>
                      <td style={{ fontSize: 10 }}>{p.assetType}</td>
                      <td style={{ textAlign: 'right', color: '#721c24', fontWeight: 600 }}>
                        {p.currentAnnualCo2Tonnes.toFixed(1)} t
                      </td>
                      <td style={{ textAlign: 'right', color: '#155724', fontWeight: 600 }}>
                        {p.potentialAnnualReduction.toFixed(1)} t
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          className={`win-badge ${
                            p.readinessScore >= 85
                              ? 'win-badge-success'
                              : p.readinessScore >= 70
                              ? 'win-badge-warning'
                              : ''
                          }`}
                        >
                          {p.readinessScore}
                        </span>
                      </td>
                      <td style={{ fontSize: 10 }}>{p.evRecommendation || '—'}</td>
                      <td style={{ textAlign: 'right', color: '#155724' }}>
                        {p.estimatedCostSaving ? `£${(p.estimatedCostSaving / 1000).toFixed(0)}k` : '—'}
                      </td>
                      <td>
                        <span
                          className={`win-badge ${
                            p.priority === 'high'
                              ? 'win-badge-danger'
                              : p.priority === 'medium'
                              ? 'win-badge-warning'
                              : ''
                          }`}
                        >
                          {p.priority.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Route Emission Analysis */}
        {topRoutes.length > 0 && (
          <div className="win-panel" style={{ overflow: 'hidden' }}>
            <div className="win-section-header">Route-Level Carbon Analysis — Top 5 Routes by CO₂</div>
            <div style={{ overflowX: 'auto' }}>
              <table className="win-table">
                <thead>
                  <tr>
                    <th>Route</th>
                    <th>Total CO₂/yr</th>
                    <th>Total Distance</th>
                    <th>CO₂ per km</th>
                    <th>Assets</th>
                    <th>EV Count</th>
                    <th>ICE Count</th>
                    <th>Potential Reduction</th>
                  </tr>
                </thead>
                <tbody>
                  {topRoutes.map((r, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{r.route}</td>
                      <td style={{ textAlign: 'right', color: '#721c24', fontWeight: 600 }}>
                        {r.totalCo2Tonnes.toFixed(1)} t
                      </td>
                      <td style={{ textAlign: 'right' }}>{r.totalDistanceKm.toLocaleString()} km</td>
                      <td style={{ textAlign: 'right' }}>{r.co2PerKm.toFixed(3)} kg/km</td>
                      <td style={{ textAlign: 'center' }}>{r.assetCount}</td>
                      <td style={{ textAlign: 'center', color: '#155724' }}>{r.evCount}</td>
                      <td style={{ textAlign: 'center', color: '#856404' }}>{r.iceCount}</td>
                      <td style={{ textAlign: 'right', color: '#155724', fontWeight: 600 }}>
                        {r.potentialReduction.toFixed(1)} t
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Technical Note */}
        <div
          style={{
            background: '#1e1e1e',
            color: '#e0e0e0',
            padding: 12,
            borderRadius: 3,
            fontSize: 11,
            lineHeight: 1.7,
            borderLeft: '3px solid #555',
          }}
        >
          <strong style={{ color: '#f0c040' }}>India EV transition context:</strong> With FAME-II disbursing Rs
          10,000+ crore and TCO parity approaching for many commercial use cases, the barrier to 30% penetration
          by 2030 is no longer financial — it's operational. CellSight provides the asset intelligence layer
          industrial fleet operators need to manage EV procurement and battery lifecycle with the same rigour as
          conventional equipment. Electrification priorities are ranked by both carbon impact and operational
          readiness, ensuring realistic transition planning.
        </div>
      </PageContainer>
    </>
  );
}
