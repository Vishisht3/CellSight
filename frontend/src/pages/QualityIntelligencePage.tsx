import { useState, useEffect } from 'react';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { Activity, AlertTriangle, CheckCircle, TrendingDown } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import axios from 'axios';
import Navbar from '../components/layout/Navbar';
import PageContainer from '../components/ui/PageContainer';
import StatCard from '../components/ui/StatCard';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import ErrorBanner from '../components/ui/ErrorBanner';
import EmptyState from '../components/ui/EmptyState';

interface ProductionBatch {
  id: string;
  batchNumber: string;
  cellBatchId: string;
  productionLine: string;
  startTime: string;
  endTime: string | null;
  targetQuantity: number;
  producedQuantity: number;
  passedQuantity: number;
  failedQuantity: number;
  status: string;
}

interface SpcStatus {
  parameterName: string;
  currentValue: number;
  centerLine: number;
  ucl: number;
  lcl: number;
  status: 'in_control' | 'warning' | 'out_of_control';
  deviation: number;
  measurementTime: string;
}

interface QualityCorrelation {
  productionBatchId: string;
  batchNumber: string;
  defectRate: number;
  defectTypes: string[];
  correlatedParameters: Array<{
    parameterName: string;
    averageValue: number;
    deviation: number;
    controlStatus: string;
  }>;
  rootCauseLikelihood: 'high' | 'medium' | 'low';
}

export default function QualityIntelligencePage() {
  useDocumentMeta({ title: 'Quality Intelligence (QMS)' });

  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [spcStatus, setSpcStatus] = useState<SpcStatus[]>([]);
  const [correlations, setCorrelations] = useState<QualityCorrelation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [batchRes, spcRes, corrRes] = await Promise.all([
        axios.get('/api/qms/batches?defective_only=true'),
        axios.get('/api/qms/spc-status'),
        axios.get('/api/qms/correlations'),
      ]);

      setBatches(batchRes.data.batches || []);
      setSpcStatus(spcRes.data.spcStatus || []);
      setCorrelations(corrRes.data.correlations || []);
      setError('');
    } catch (err) {
      setError('Failed to load QMS data');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  // Calculate summary stats
  const totalDefectiveBatches = batches.length;
  const avgDefectRate =
    batches.length > 0
      ? batches.reduce((sum, b) => sum + (b.failedQuantity / b.producedQuantity) * 100, 0) / batches.length
      : 0;

  const spcInControl = spcStatus.filter((s) => s.status === 'in_control').length;
  const spcWarning = spcStatus.filter((s) => s.status === 'warning').length;
  const spcOutOfControl = spcStatus.filter((s) => s.status === 'out_of_control').length;

  const highLikelihoodCorr = correlations.filter((c) => c.rootCauseLikelihood === 'high').length;

  // Prepare SPC chart data (show only parameters not in control)
  const spcChartData = spcStatus
    .filter((s) => s.status !== 'in_control')
    .map((s) => ({
      name: s.parameterName,
      value: s.currentValue,
      centerLine: s.centerLine,
      ucl: s.ucl,
      lcl: s.lcl,
    }));

  return (
    <>
      <Navbar
        title="Manufacturing Quality Intelligence (QMS)"
        subtitle="Real-time defect detection, SPC monitoring, and root-cause correlation for battery production"
      />
      <PageContainer>
        {error && <ErrorBanner message={error} />}

        {/* KPI Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
          <StatCard
            label="Defective Batches"
            value={totalDefectiveBatches}
            icon={<AlertTriangle size={16} />}
            variant={totalDefectiveBatches > 0 ? 'danger' : 'success'}
            subValue="> 3% defect rate"
          />
          <StatCard
            label="Avg Defect Rate"
            value={`${avgDefectRate.toFixed(1)}%`}
            icon={<TrendingDown size={16} />}
            variant={avgDefectRate > 5 ? 'danger' : avgDefectRate > 3 ? 'warning' : 'success'}
          />
          <StatCard
            label="SPC Out of Control"
            value={spcOutOfControl}
            icon={<Activity size={16} />}
            variant={spcOutOfControl > 0 ? 'danger' : 'success'}
            subValue={`${spcWarning} warning`}
          />
          <StatCard
            label="High-Likelihood Root Causes"
            value={highLikelihoodCorr}
            icon={<CheckCircle size={16} />}
            variant={highLikelihoodCorr > 0 ? 'warning' : 'success'}
          />
        </div>

        {/* SPC Control Chart */}
        {spcChartData.length > 0 && (
          <div className="win-panel" style={{ overflow: 'hidden' }}>
            <div className="win-section-header">
              Statistical Process Control (SPC) — Parameters Outside Control Limits
            </div>
            <div style={{ padding: 12 }}>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={spcChartData} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d0dce8" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 9, fill: '#4a4a4a' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis tick={{ fontSize: 9, fill: '#4a4a4a' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: '#fff',
                      border: '1px solid #c0cfe0',
                      borderRadius: 3,
                      fontSize: 11,
                      padding: '6px 10px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 10, paddingTop: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="ucl"
                    stroke="#c00000"
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    dot={false}
                    name="Upper Control Limit"
                  />
                  <Line
                    type="monotone"
                    dataKey="lcl"
                    stroke="#c00000"
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    dot={false}
                    name="Lower Control Limit"
                  />
                  <Line
                    type="monotone"
                    dataKey="centerLine"
                    stroke="#316ac5"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    dot={false}
                    name="Center Line"
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#c00000"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#c00000' }}
                    name="Current Value"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Defective Batches Table */}
        {batches.length > 0 ? (
          <div className="win-panel" style={{ overflow: 'hidden' }}>
            <div className="win-section-header">Production Batches with Quality Issues (Defect Rate > 3%)</div>
            <div style={{ overflowX: 'auto' }}>
              <table className="win-table">
                <thead>
                  <tr>
                    <th>Batch Number</th>
                    <th>Production Line</th>
                    <th>Produced</th>
                    <th>Passed</th>
                    <th>Failed</th>
                    <th>Defect Rate</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => {
                    const defectRate = (batch.failedQuantity / batch.producedQuantity) * 100;
                    return (
                      <tr key={batch.id}>
                        <td style={{ fontWeight: 600 }}>{batch.batchNumber}</td>
                        <td>{batch.productionLine}</td>
                        <td style={{ textAlign: 'right' }}>{batch.producedQuantity}</td>
                        <td style={{ textAlign: 'right', color: '#155724' }}>{batch.passedQuantity}</td>
                        <td style={{ textAlign: 'right', color: '#721c24', fontWeight: 600 }}>
                          {batch.failedQuantity}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span
                            className={`win-badge ${
                              defectRate >= 10 ? 'win-badge-danger' : defectRate >= 5 ? 'win-badge-warning' : ''
                            }`}
                          >
                            {defectRate.toFixed(1)}%
                          </span>
                        </td>
                        <td>
                          <span className="win-badge">{batch.status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState
            title="No Quality Issues Detected"
            message="All production batches are within acceptable defect rate thresholds (< 3%)"
          />
        )}

        {/* Root-Cause Correlation Table */}
        {correlations.length > 0 && (
          <div className="win-panel" style={{ overflow: 'hidden' }}>
            <div className="win-section-header">Root-Cause Correlation Analysis</div>
            <div style={{ overflowX: 'auto' }}>
              <table className="win-table">
                <thead>
                  <tr>
                    <th>Batch Number</th>
                    <th>Defect Rate</th>
                    <th>Defect Types</th>
                    <th>Correlated Parameters</th>
                    <th>Root-Cause Likelihood</th>
                  </tr>
                </thead>
                <tbody>
                  {correlations.map((corr) => (
                    <tr key={corr.productionBatchId}>
                      <td style={{ fontWeight: 600 }}>{corr.batchNumber}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span
                          className={`win-badge ${
                            corr.defectRate >= 10
                              ? 'win-badge-danger'
                              : corr.defectRate >= 5
                              ? 'win-badge-warning'
                              : ''
                          }`}
                        >
                          {corr.defectRate.toFixed(1)}%
                        </span>
                      </td>
                      <td style={{ fontSize: 10 }}>{corr.defectTypes.join(', ') || 'N/A'}</td>
                      <td style={{ fontSize: 10 }}>
                        {corr.correlatedParameters.length > 0 ? (
                          <ul style={{ margin: 0, paddingLeft: 16 }}>
                            {corr.correlatedParameters.map((p, idx) => (
                              <li key={idx}>
                                <strong>{p.parameterName}</strong>: {p.averageValue.toFixed(2)} (
                                {p.controlStatus})
                              </li>
                            ))}
                          </ul>
                        ) : (
                          'No correlation detected'
                        )}
                      </td>
                      <td>
                        <span
                          className={`win-badge ${
                            corr.rootCauseLikelihood === 'high'
                              ? 'win-badge-danger'
                              : corr.rootCauseLikelihood === 'medium'
                              ? 'win-badge-warning'
                              : ''
                          }`}
                        >
                          {corr.rootCauseLikelihood.toUpperCase()}
                        </span>
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
          <strong style={{ color: '#f0c040' }}>How it works:</strong> The QMS agent monitors production
          batches, quality inspections, and process parameters in real time. Defect detection flags batches
          with failure rates exceeding 3%. SPC monitoring identifies process parameters outside statistical
          control limits (UCL/LCL). Root-cause correlation uses z-score analysis to link quality failures to
          specific process deviations, enabling predictive intervention before defective product reaches
          assembly.
        </div>
      </PageContainer>
    </>
  );
}
