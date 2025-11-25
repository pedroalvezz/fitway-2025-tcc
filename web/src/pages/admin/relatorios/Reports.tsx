import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { reportsService, type ReportsFilters } from '@/services/reports.service';
import { exportToCsv, exportToXlsx, exportToPdf, pickColumns } from '@/lib/export-utils';
import { Loader2, FileSpreadsheet, FileDown, FileText, BarChart2 } from 'lucide-react';

type DatasetKey = 'aulas' | 'ocorrencias' | 'inscricoes' | 'cobrancas';

const Reports = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ReportsFilters>({
    data_inicio: undefined,
    data_fim: undefined,
    esporte: 'all',
    id_instrutor: undefined,
    status_aula: 'all',
    status_pagamento: 'all',
  });
  const [metrics, setMetrics] = useState<any>({});
  const [data, setData] = useState<{ [k in DatasetKey]: any[] }>({
    aulas: [],
    ocorrencias: [],
    inscricoes: [],
    cobrancas: [],
  });
  const [activeDataset, setActiveDataset] = useState<DatasetKey>('aulas');

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.data_inicio, filters.data_fim, filters.esporte, filters.id_instrutor, filters.status_aula, filters.status_pagamento]);

  const load = async () => {
    try {
      setLoading(true);
      const resp = await reportsService.fetchAll(filters);
      setMetrics(resp.metrics);
      setData(resp.datasets as any);
    } catch (e: any) {
      toast({ title: 'Erro ao carregar relatórios', description: e?.message || 'Tente novamente', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  function isEndBeforeStart(start?: string, end?: string) {
    if (!start || !end) return false;
    try {
      const s = new Date(start);
      const e = new Date(end);
      return e.getTime() < s.getTime();
    } catch (err) {
      return false;
    }
  }

  const handleExportCsv = () => {
    const rows = data[activeDataset] || [];
    exportToCsv(rows, `relatorio_${activeDataset}`);
  };

  const handleExportXlsx = () => {
    const rows = data[activeDataset] || [];
    exportToXlsx([{ name: activeDataset, rows }], `relatorio_${activeDataset}`);
  };

  const handleExportPdf = () => {
    const rows = data[activeDataset] || [];
    const keys = Object.keys(rows[0] || {}).slice(0, 8);
    const trimmed = pickColumns(rows, keys);
    exportToPdf(`Relatório - ${activeDataset}`, keys, trimmed, `relatorio_${activeDataset}`);
  };

  const datasetColumns = useMemo(() => {
    const sample = data[activeDataset]?.[0] || {};
    return Object.keys(sample).slice(0, 8);
  }, [activeDataset, data]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white">Relatórios</h1>
        <div className="flex gap-2">
          <Button variant="outline" className="border-blue-500 text-blue-400 hover:bg-blue-500/10" onClick={handleExportCsv}>
            <FileDown className="h-4 w-4 mr-2" /> CSV
          </Button>
          <Button variant="outline" className="border-green-500 text-green-400 hover:bg-green-500/10" onClick={handleExportXlsx}>
            <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel
          </Button>
          <Button variant="outline" className="border-purple-500 text-purple-400 hover:bg-purple-500/10" onClick={handleExportPdf}>
            <FileText className="h-4 w-4 mr-2" /> PDF
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card className="bg-dashboard-card border-dashboard-border">
        <CardHeader>
          <CardTitle className="text-dashboard-fg text-sm flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-fitway-green" /> Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label className="text-xs text-white/70">Data Início</label>
              <Input type="date" className="bg-dashboard-card border-dashboard-border text-white" value={filters.data_inicio || ''}
                onChange={(e) => {
                  const newStart = e.target.value || undefined;
                  // If end exists and would be before the new start, block and show error
                  if (isEndBeforeStart(newStart, filters.data_fim)) {
                    toast({ title: 'Data inválida', description: 'A data fim não pode ser anterior à data início.', variant: 'destructive' });
                    return;
                  }
                  setFilters(f => ({ ...f, data_inicio: newStart }));
                }} />
            </div>
            <div>
              <label className="text-xs text-white/70">Data Fim</label>
              <Input type="date" className="bg-dashboard-card border-dashboard-border text-white" value={filters.data_fim || ''}
                onChange={(e) => {
                  const newEnd = e.target.value || undefined;
                  // If start exists and new end is before start, block and show error
                  if (isEndBeforeStart(filters.data_inicio, newEnd)) {
                    toast({ title: 'Data inválida', description: 'A data fim não pode ser anterior à data início.', variant: 'destructive' });
                    return;
                  }
                  setFilters(f => ({ ...f, data_fim: newEnd }));
                }} />
            </div>
            <div>
              <label className="text-xs text-white/70">Esporte</label>
              <Select value={filters.esporte || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, esporte: v }))}>
                <SelectTrigger className="bg-dashboard-card border-dashboard-border text-white"><SelectValue placeholder="Esporte" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="beach_tennis">Beach Tennis</SelectItem>
                  <SelectItem value="funcional">Funcional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-white/70">Status (Aula)</label>
              <Select value={filters.status_aula || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, status_aula: v }))}>
                <SelectTrigger className="bg-dashboard-card border-dashboard-border text-white"><SelectValue placeholder="Status Aula" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="ativa">Ativa</SelectItem>
                  <SelectItem value="inativa">Inativa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-white/70">Status (Pagamento)</label>
              <Select value={filters.status_pagamento || 'all'} onValueChange={(v) => setFilters(f => ({ ...f, status_pagamento: v }))}>
                <SelectTrigger className="bg-dashboard-card border-dashboard-border text-white"><SelectValue placeholder="Status Pagamento" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-dashboard-card border-dashboard-border">
          <CardHeader><CardTitle className="text-dashboard-fg text-sm">Aulas</CardTitle></CardHeader>
          <CardContent>
            <div className="text-white">Total: <strong>{metrics.totalAulas ?? 0}</strong></div>
            <div className="text-white/80">Ativas: <strong>{metrics.aulasAtivas ?? 0}</strong></div>
            <div className="text-white/80">Horários/semana: <strong>{metrics.totalHorariosSemana ?? 0}</strong></div>
          </CardContent>
        </Card>
        <Card className="bg-dashboard-card border-dashboard-border">
          <CardHeader><CardTitle className="text-dashboard-fg text-sm">Agenda</CardTitle></CardHeader>
          <CardContent>
            <div className="text-white">Ocorrências: <strong>{metrics.totalOcorrencias ?? 0}</strong></div>
            <div className="text-white/80">Inscrições: <strong>{metrics.totalInscricoes ?? 0}</strong></div>
          </CardContent>
        </Card>
        <Card className="bg-dashboard-card border-dashboard-border">
          <CardHeader><CardTitle className="text-dashboard-fg text-sm">Receita</CardTitle></CardHeader>
          <CardContent>
            <div className="text-white">Paga: <strong>R$ {(metrics.receitaPaga ?? 0).toFixed(2)}</strong></div>
            <div className="text-white/80">Pendente: <strong>R$ {(metrics.receitaPendente ?? 0).toFixed(2)}</strong></div>
          </CardContent>
        </Card>
      </div>

      {/* Dataset selector + Tabela simples */}
      <Card className="bg-dashboard-card border-dashboard-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-dashboard-fg text-sm">Dados</CardTitle>
          <div className="flex gap-2 items-center">
            <Select value={activeDataset} onValueChange={(v) => setActiveDataset(v as DatasetKey)}>
              <SelectTrigger className="w-56 bg-dashboard-card border-dashboard-border text-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aulas">Aulas</SelectItem>
                <SelectItem value="ocorrencias">Ocorrências</SelectItem>
                <SelectItem value="inscricoes">Inscrições</SelectItem>
                <SelectItem value="cobrancas">Pagamentos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-6 w-6 animate-spin text-fitway-green" />
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {datasetColumns.map((c) => (
                          <th key={c} className="text-left text-white/70 px-2 py-1 border-b border-dashboard-border">{String(c).replace(/_/g, ' ').toUpperCase()}</th>
                        ))}
                  </tr>
                </thead>
                <tbody>
                  {(data[activeDataset] || []).slice(0, 50).map((row, idx) => (
                    <tr key={idx} className="hover:bg-white/5">
                      {datasetColumns.map((c) => (
                        <td key={c} className="text-white/90 px-2 py-1 border-b border-dashboard-border break-words max-w-[240px]">{String(row[c] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {(data[activeDataset] || []).length > 50 && (
                <div className="text-xs text-white/50 mt-2">Mostrando 50 primeiras linhas.</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;
