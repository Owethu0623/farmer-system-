import React, { useCallback, useEffect, useState } from 'react';
import { jsPDF } from 'jspdf';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  History,
  Lock,
  Play,
  ShieldCheck,
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { getSastDateString } from '../lib/saTime';
import {
  AuthUser,
  FarmItem,
  GeneratedReportHistoryItem,
  GeneratedReportResult,
  ReportTypeCode,
  ReportTypeMeta,
} from '../types';

interface ReportingExportsViewProps {
  user: AuthUser;
  farms: FarmItem[];
  selectedFarmId: string | null;
}

export const ReportingExportsView: React.FC<ReportingExportsViewProps> = ({
  user,
  farms,
  selectedFarmId,
}) => {
  const [reportTypes, setReportTypes] = useState<ReportTypeMeta[]>([]);
  const [history, setHistory] = useState<GeneratedReportHistoryItem[]>([]);
  const [selectedType, setSelectedType] = useState<ReportTypeCode>('farm_performance');
  const [farmFilter, setFarmFilter] = useState<string>(selectedFarmId || 'all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [aggregateOrg, setAggregateOrg] = useState<boolean>(
    user.roleCode === 'organisation_manager'
  );

  const [generating, setGenerating] = useState(false);
  const [activeReport, setActiveReport] = useState<GeneratedReportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const canExport = user.permissions.includes('reports:export') || user.permissions.includes('reports:generate');
  const isOrgManager =
    user.roleCode === 'organisation_manager' ||
    user.permissions.includes('reports:organisation_aggregate');

  const loadMetadata = useCallback(async () => {
    try {
      const [typesRes, histRes] = await Promise.all([
        apiRequest<ReportTypeMeta[]>('/api/reports/types'),
        apiRequest<GeneratedReportHistoryItem[]>('/api/reports/history'),
      ]);
      setReportTypes(typesRes);
      setHistory(histRes);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load reporting options.');
    }
  }, []);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  const runGenerate = async (overrideParams?: {
    reportType: ReportTypeCode;
    farmId: string;
    startDate: string;
    endDate: string;
    farmingCategory: string;
    aggregateOrganisation: boolean;
  }) => {
    setGenerating(true);
    setError(null);
    setStatusMessage(null);
    const payload = overrideParams || {
      reportType: selectedType,
      farmId: farmFilter,
      startDate,
      endDate,
      farmingCategory: categoryFilter,
      aggregateOrganisation: isOrgManager ? aggregateOrg : false,
    };

    try {
      const report = await apiRequest<GeneratedReportResult>('/api/reports/generate', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setActiveReport(report);
      setStatusMessage(`Generated ${report.reportTitle} (${report.rows.length} record row(s)).`);
      await loadMetadata();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate report.');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadCsv = () => {
    if (!activeReport) return;
    const escapeCsv = (val: unknown): string => {
      const str = String(val ?? '');
      if (str.includes('"') || str.includes(',') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const metaLines = [
      `Field Shift Agricultural Report,${escapeCsv(activeReport.reportTitle)}`,
      `Generated At,${escapeCsv(activeReport.generatedAt)}`,
      `Scope,${escapeCsv(activeReport.farmLabel)}`,
      `Privacy Notice,${escapeCsv(activeReport.privacyNotice)}`,
      `Data Classification,${escapeCsv(activeReport.estimationNotice)}`,
      '',
    ];

    const headerRow = activeReport.columns.map((c) => escapeCsv(c.label)).join(',');
    const dataRows = activeReport.rows.map((row) =>
      activeReport.columns.map((c) => escapeCsv(row[c.key] ?? '')).join(',')
    );

    const csvContent = [...metaLines, headerRow, ...dataRows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fieldshift-${activeReport.reportType}-${getSastDateString()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = () => {
    if (!activeReport) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const maxWidth = pageWidth - margin * 2;
    let y = 18;

    const ensureSpace = (neededMm: number) => {
      if (y + neededMm > 278) {
        doc.addPage();
        y = 18;
      }
    };

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(11, 31, 58);
    doc.text(`Field Shift — ${activeReport.reportTitle}`, margin, y);
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Generated: ${new Date(activeReport.generatedAt).toLocaleString()} · By: ${activeReport.generatedBy}`, margin, y);
    y += 5;
    doc.text(`Scope: ${activeReport.farmLabel}`, margin, y);
    y += 6;

    const notices = [activeReport.privacyNotice, activeReport.estimationNotice];
    for (const notice of notices) {
      const wrapped = doc.splitTextToSize(notice, maxWidth);
      ensureSpace(wrapped.length * 4.5 + 3);
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 4.2 + 2;
    }

    y += 3;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(11, 61, 145);
    doc.text('Key Summary Figures', margin, y);
    y += 6;

    for (const kpi of activeReport.kpis) {
      ensureSpace(6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`• ${kpi.label}: ${kpi.value} [${kpi.dataClassification}]`, margin + 2, y);
      y += 5.5;
    }

    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(11, 61, 145);
    ensureSpace(10);
    doc.text(`Detailed Records (${activeReport.rows.length})`, margin, y);
    y += 6;

    if (activeReport.rows.length === 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(71, 85, 105);
      doc.text('No database records matched the selected report filters.', margin, y);
    } else {
      activeReport.rows.forEach((row, idx) => {
        const lineText = activeReport.columns
          .map((c) => `${c.label}: ${row[c.key] ?? ''}`)
          .join('  |  ');
        const wrapped = doc.splitTextToSize(`${idx + 1}. ${lineText}`, maxWidth);
        ensureSpace(wrapped.length * 4.5 + 4);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text(wrapped, margin, y);
        y += wrapped.length * 4.3 + 2.5;
        doc.setDrawColor(203, 213, 225);
        doc.line(margin, y - 1, pageWidth - margin, y - 1);
      });
    }

    doc.save(`fieldshift-${activeReport.reportType}-${getSastDateString()}.pdf`);
  };

  const selectedMeta = reportTypes.find((rt) => rt.code === selectedType);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#0B1F3A] text-white rounded-2xl p-6 sm:p-8 flex flex-wrap items-center justify-between gap-4 border border-[#163055]">
        <div className="space-y-1.5">
          <p className="text-xs font-mono uppercase tracking-wider text-[#93C5FD]">
            Reporting & Data Export Suite
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold">
            Agricultural Reports, PDF Statements & CSV Exports
          </h1>
          <p className="text-sm text-[#CBD5E1]">
            Generate verifiable farm reports from live database records with clearly labelled estimated values and privacy protection.
          </p>
        </div>
        {isOrgManager && (
          <div className="px-4 py-2.5 rounded-xl bg-[#163055] border border-[#3B82F6]/40 text-xs text-[#E2E8F0] flex items-center gap-2 max-w-xs">
            <ShieldCheck className="w-4 h-4 shrink-0 text-[#93C5FD]" />
            <span>Organisation privacy protection automatically redacts personal farmer PII on portfolio aggregates.</span>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] text-[#B91C1C] rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {statusMessage && (
        <div className="bg-[#ECF5F2] border border-[#A7D7C5] text-[#174C3C] rounded-xl px-4 py-3 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#174C3C] shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Configuration & Filters */}
      <section className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#0B3D91]" />
            <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
              Configure & Generate Report
            </h2>
          </div>
          {selectedMeta && (
            <span className="text-xs font-medium text-[#475569]">
              {selectedMeta.containsEstimates
                ? 'Contains clearly labelled Estimated Values alongside database records'
                : 'Database Records Only'}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-[#0B1F3A] mb-1">
              Report Type
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as ReportTypeCode)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-sm font-medium text-[#0F172A] min-h-[42px]"
            >
              {reportTypes.map((rt) => (
                <option key={rt.code} value={rt.code}>
                  {rt.label}
                </option>
              ))}
            </select>
            {selectedMeta && (
              <p className="text-xs text-[#475569] mt-1">{selectedMeta.description}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0B1F3A] mb-1">
              Farm Scope
            </label>
            <select
              value={farmFilter}
              onChange={(e) => setFarmFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-sm text-[#0F172A] min-h-[42px]"
            >
              <option value="all">
                {farms.length > 0 ? `All Accessible Farms (${farms.length})` : 'General / Prospective'}
              </option>
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0B1F3A] mb-1">
              From Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-sm text-[#0F172A] min-h-[42px]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0B1F3A] mb-1">
              To Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#CBD5E1] bg-white text-sm text-[#0F172A] min-h-[42px]"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-[#E2E8F0]">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-[#0B1F3A]">Category Filter:</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 rounded-lg border border-[#CBD5E1] bg-white text-xs text-[#0F172A] min-h-[40px]"
              >
                <option value="all">All Farming Categories</option>
                <option value="crops">Crops</option>
                <option value="livestock">Livestock</option>
                <option value="mixed">Mixed Farming</option>
                <option value="weather">Weather</option>
                <option value="incidents">Incidents</option>
              </select>
            </div>

            {isOrgManager && (
              <label className="inline-flex items-center gap-2 text-xs font-medium text-[#0B1F3A] cursor-pointer">
                <input
                  type="checkbox"
                  checked={aggregateOrg}
                  onChange={(e) => setAggregateOrg(e.target.checked)}
                  className="rounded border-[#CBD5E1] accent-[#0B3D91]"
                />
                <span>Organisation Aggregated Mode (Redact Personal Farmer Details)</span>
              </label>
            )}
          </div>

          <button
            type="button"
            disabled={generating}
            onClick={() => runGenerate()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B3D91] hover:bg-[#082E70] text-white text-sm font-semibold cursor-pointer disabled:opacity-60 whitespace-nowrap min-h-[42px]"
          >
            <Play className="w-4 h-4" />
            <span>{generating ? 'Generating...' : 'Generate Report'}</span>
          </button>
        </div>
      </section>

      {/* Active Report Output & Download Controls */}
      {activeReport && (
        <section className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E2E8F0] pb-4">
            <div className="space-y-1">
              <p className="text-xs font-mono text-[#0B3D91]">
                Report ID: {activeReport.reportId.slice(0, 14)} · {new Date(activeReport.generatedAt).toLocaleString()}
              </p>
              <h2 className="font-display text-xl font-bold text-[#0B1F3A]">
                {activeReport.reportTitle}
              </h2>
              <p className="text-xs text-[#475569]">
                Scope: {activeReport.farmLabel} · Generated by {activeReport.generatedBy}
              </p>
            </div>

            {canExport && (
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0B3D91] hover:bg-[#082E70] text-white text-xs font-semibold cursor-pointer whitespace-nowrap min-h-[40px]"
                >
                  <FileText className="w-4 h-4" />
                  <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#CBD5E1] text-[#0B1F3A] hover:bg-[#F8FAFC] text-xs font-semibold cursor-pointer whitespace-nowrap min-h-[40px]"
                >
                  <Download className="w-4 h-4 text-[#0B3D91]" />
                  <span>Export CSV</span>
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="bg-[#ECF5F2] border border-[#A7D7C5] rounded-xl p-3 text-[#174C3C] flex items-start gap-2">
              <Lock className="w-4 h-4 shrink-0 mt-0.5 text-[#174C3C]" />
              <span>{activeReport.privacyNotice}</span>
            </div>
            <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-xl p-3 text-[#0B1F3A]">
              {activeReport.estimationNotice}
            </div>
          </div>

          {/* KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {activeReport.kpis.map((kpi) => (
              <div key={kpi.label} className="border border-[#E2E8F0] bg-[#F8FAFC] rounded-xl p-3.5">
                <p className="text-xs text-[#475569]">{kpi.label}</p>
                <p className="font-mono text-lg font-bold tabular-nums text-[#0B1F3A] mt-1">
                  {kpi.value}
                </p>
                <p
                  className={`text-[11px] font-semibold mt-0.5 ${
                    kpi.dataClassification === 'Estimated Value'
                      ? 'text-[#B45309]'
                      : kpi.dataClassification === 'AI Advisory'
                      ? 'text-[#0B3D91]'
                      : 'text-[#174C3C]'
                  }`}
                >
                  {kpi.dataClassification}
                </p>
              </div>
            ))}
          </div>

          {/* Report Table */}
          {activeReport.rows.length === 0 ? (
            <p className="text-sm text-[#475569] py-4">
              No records matched the selected report filters. Adjust the farm, category, or date range and regenerate.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[#475569]">
                    {activeReport.columns.map((col) => (
                      <th
                        key={col.key}
                        className={`py-2.5 pr-4 font-semibold ${
                          col.align === 'right' ? 'text-right' : 'text-left'
                        }`}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {activeReport.rows.map((row, idx) => (
                    <tr key={idx}>
                      {activeReport.columns.map((col) => (
                        <td
                          key={col.key}
                          className={`py-2.5 pr-4 text-[#0F172A] ${
                            col.align === 'right' ? 'text-right font-mono tabular-nums' : ''
                          }`}
                        >
                          {String(row[col.key] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Report History */}
      <section className="bg-white border border-[#CBD5E1] rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-[#0B3D91]" />
          <h2 className="font-display text-lg font-bold text-[#0B1F3A]">
            Report Generation History ({history.length})
          </h2>
        </div>

        {history.length === 0 ? (
          <p className="text-sm text-[#475569]">
            No reports generated yet. Select a report type above and click Generate Report.
          </p>
        ) : (
          <div className="divide-y divide-[#E2E8F0]">
            {history.map((item) => (
              <div
                key={item.id}
                className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div>
                  <p className="font-semibold text-[#0B1F3A] text-sm">{item.reportTitle}</p>
                  <p className="text-[#475569] mt-0.5">
                    {item.farmLabel} · {item.rowCount} row(s) ·{' '}
                    {item.containsEstimatedValues ? 'Includes Estimates' : 'Database Only'} ·{' '}
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedType(item.reportType);
                    setFarmFilter(item.farmId);
                    setStartDate(item.startDate);
                    setEndDate(item.endDate);
                    setCategoryFilter(item.farmingCategory);
                    setAggregateOrg(item.isAggregatedOrganisationReport);
                    runGenerate({
                      reportType: item.reportType,
                      farmId: item.farmId,
                      startDate: item.startDate,
                      endDate: item.endDate,
                      farmingCategory: item.farmingCategory,
                      aggregateOrganisation: item.isAggregatedOrganisationReport,
                    });
                  }}
                  className="px-3.5 py-2 rounded-lg bg-[#EFF6FF] hover:bg-[#DBEAFE] border border-[#BFDBFE] text-[#0B3D91] font-semibold cursor-pointer whitespace-nowrap min-h-[40px]"
                >
                  Open / Re-Export
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
