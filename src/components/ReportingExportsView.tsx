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
    a.download = `fieldshift-${activeReport.reportType}-${new Date().toISOString().slice(0, 10)}.csv`;
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
    doc.setTextColor(20, 51, 38);
    doc.text(`Field Shift — ${activeReport.reportTitle}`, margin, y);
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(74, 90, 80);
    doc.text(`Generated: ${new Date(activeReport.generatedAt).toLocaleString()} · By: ${activeReport.generatedBy}`, margin, y);
    y += 5;
    doc.text(`Scope: ${activeReport.farmLabel}`, margin, y);
    y += 6;

    const notices = [activeReport.privacyNotice, activeReport.estimationNotice];
    for (const notice of notices) {
      const wrapped = doc.splitTextToSize(notice, maxWidth);
      ensureSpace(wrapped.length * 4.5 + 3);
      doc.setFontSize(8.5);
      doc.setTextColor(53, 68, 59);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 4.2 + 2;
    }

    y += 3;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(20, 51, 38);
    doc.text('Key Summary Figures', margin, y);
    y += 6;

    for (const kpi of activeReport.kpis) {
      ensureSpace(6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(23, 32, 27);
      doc.text(`• ${kpi.label}: ${kpi.value} [${kpi.dataClassification}]`, margin + 2, y);
      y += 5.5;
    }

    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(20, 51, 38);
    ensureSpace(10);
    doc.text(`Detailed Records (${activeReport.rows.length})`, margin, y);
    y += 6;

    if (activeReport.rows.length === 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
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
        doc.setTextColor(23, 32, 27);
        doc.text(wrapped, margin, y);
        y += wrapped.length * 4.3 + 2.5;
        doc.setDrawColor(226, 230, 223);
        doc.line(margin, y - 1, pageWidth - margin, y - 1);
      });
    }

    doc.save(`fieldshift-${activeReport.reportType}-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const selectedMeta = reportTypes.find((rt) => rt.code === selectedType);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#143326] text-white rounded-2xl p-6 sm:p-8 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5">
          <p className="text-xs font-mono uppercase tracking-wider text-[#B7DEC4]">
            Reporting & Data Export Suite
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold">
            Agricultural Reports, PDF Statements & CSV Exports
          </h1>
          <p className="text-sm text-[#DCE8DF]">
            Generate verifiable farm reports from live database records with clearly labelled estimated values and privacy protection.
          </p>
        </div>
        {isOrgManager && (
          <div className="px-4 py-2.5 rounded-xl bg-[#1B4332] border border-[#40916C] text-xs text-[#E4F0E7] flex items-center gap-2 max-w-xs">
            <ShieldCheck className="w-4 h-4 shrink-0 text-[#B7DEC4]" />
            <span>Organisation privacy protection automatically redacts personal farmer PII on portfolio aggregates.</span>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-[#FDF2F2] border border-[#E8B4B4] text-[#8E2424] rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {statusMessage && (
        <div className="bg-[#EDF5EF] border border-[#BFD6C5] text-[#143326] rounded-xl px-4 py-3 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#1B4332] shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Configuration & Filters */}
      <section className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#1B4332]" />
            <h2 className="font-display text-lg font-bold text-[#143326]">
              Configure & Generate Report
            </h2>
          </div>
          {selectedMeta && (
            <span className="text-xs font-medium text-[#4A5A50]">
              {selectedMeta.containsEstimates
                ? 'Contains clearly labelled Estimated Values alongside database records'
                : 'Database Records Only'}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-[#143326] mb-1">
              Report Type
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as ReportTypeCode)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DDD2] bg-white text-sm font-medium"
            >
              {reportTypes.map((rt) => (
                <option key={rt.code} value={rt.code}>
                  {rt.label}
                </option>
              ))}
            </select>
            {selectedMeta && (
              <p className="text-xs text-[#4A5A50] mt-1">{selectedMeta.description}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#143326] mb-1">
              Farm Scope
            </label>
            <select
              value={farmFilter}
              onChange={(e) => setFarmFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DDD2] bg-white text-sm"
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
            <label className="block text-xs font-semibold text-[#143326] mb-1">
              From Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DDD2] bg-white text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#143326] mb-1">
              To Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#D4DDD2] bg-white text-sm"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-[#E2E6DF]">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-[#143326]">Category Filter:</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-[#D4DDD2] bg-white text-xs"
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
              <label className="inline-flex items-center gap-2 text-xs font-medium text-[#143326] cursor-pointer">
                <input
                  type="checkbox"
                  checked={aggregateOrg}
                  onChange={(e) => setAggregateOrg(e.target.checked)}
                  className="rounded border-[#D4DDD2] accent-[#1B4332]"
                />
                <span>Organisation Aggregated Mode (Redact Personal Farmer Details)</span>
              </label>
            )}
          </div>

          <button
            type="button"
            disabled={generating}
            onClick={() => runGenerate()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1B4332] hover:bg-[#143326] text-white text-sm font-semibold cursor-pointer disabled:opacity-60 whitespace-nowrap"
          >
            <Play className="w-4 h-4" />
            <span>{generating ? 'Generating...' : 'Generate Report'}</span>
          </button>
        </div>
      </section>

      {/* Active Report Output & Download Controls */}
      {activeReport && (
        <section className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E2E6DF] pb-4">
            <div className="space-y-1">
              <p className="text-xs font-mono text-[#2D6A4F]">
                Report ID: {activeReport.reportId.slice(0, 14)} · {new Date(activeReport.generatedAt).toLocaleString()}
              </p>
              <h2 className="font-display text-xl font-bold text-[#143326]">
                {activeReport.reportTitle}
              </h2>
              <p className="text-xs text-[#4A5A50]">
                Scope: {activeReport.farmLabel} · Generated by {activeReport.generatedBy}
              </p>
            </div>

            {canExport && (
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#143326] hover:bg-[#1B4332] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  <FileText className="w-4 h-4" />
                  <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#1B4332] text-[#143326] hover:bg-[#EDF5EF] text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-4 h-4" />
                  <span>Export CSV</span>
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="bg-[#EDF5EF] border border-[#BFD6C5] rounded-xl p-3 text-[#143326] flex items-start gap-2">
              <Lock className="w-4 h-4 shrink-0 mt-0.5 text-[#1B4332]" />
              <span>{activeReport.privacyNotice}</span>
            </div>
            <div className="bg-[#F6F7F4] border border-[#D4DDD2] rounded-xl p-3 text-[#35443B]">
              {activeReport.estimationNotice}
            </div>
          </div>

          {/* KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {activeReport.kpis.map((kpi) => (
              <div key={kpi.label} className="border border-[#E2E6DF] rounded-xl p-3.5">
                <p className="text-xs text-[#4A5A50]">{kpi.label}</p>
                <p className="font-mono text-lg font-bold tabular-nums text-[#143326] mt-1">
                  {kpi.value}
                </p>
                <p
                  className={`text-[11px] font-semibold mt-0.5 ${
                    kpi.dataClassification === 'Estimated Value'
                      ? 'text-[#9A5B13]'
                      : kpi.dataClassification === 'AI Advisory'
                      ? 'text-[#2D6A4F]'
                      : 'text-[#4A5A50]'
                  }`}
                >
                  {kpi.dataClassification}
                </p>
              </div>
            ))}
          </div>

          {/* Report Table */}
          {activeReport.rows.length === 0 ? (
            <p className="text-sm text-[#4A5A50] py-4">
              No records matched the selected report filters. Adjust the farm, category, or date range and regenerate.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E2E6DF] text-[#4A5A50]">
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
                <tbody className="divide-y divide-[#E2E6DF]">
                  {activeReport.rows.map((row, idx) => (
                    <tr key={idx}>
                      {activeReport.columns.map((col) => (
                        <td
                          key={col.key}
                          className={`py-2.5 pr-4 text-[#17201B] ${
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
      <section className="bg-white border border-[#E2E6DF] rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-[#1B4332]" />
          <h2 className="font-display text-lg font-bold text-[#143326]">
            Report Generation History ({history.length})
          </h2>
        </div>

        {history.length === 0 ? (
          <p className="text-sm text-[#4A5A50]">
            No reports generated yet. Select a report type above and click Generate Report.
          </p>
        ) : (
          <div className="divide-y divide-[#E2E6DF]">
            {history.map((item) => (
              <div
                key={item.id}
                className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div>
                  <p className="font-semibold text-[#143326] text-sm">{item.reportTitle}</p>
                  <p className="text-[#4A5A50] mt-0.5">
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
                  className="px-3 py-1.5 rounded-lg bg-[#EDF5EF] hover:bg-[#DCEBDD] text-[#143326] font-semibold cursor-pointer whitespace-nowrap"
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
