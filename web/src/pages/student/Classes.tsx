import { useEffect, useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Search, Calendar, Clock, User, BookOpen, AlertCircle, Loader2 } from 'lucide-react';
import { classEnrollmentsService, classOccurrencesService, classesService } from '@/services/classes.service';
import type { OcorrenciaAula, InscricaoAula, Aula } from '@/types';
import { formatCurrency, formatDate, formatTime, getErrorMessage } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const StudentClasses = () => {
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [occurrences, setOccurrences] = useState<OcorrenciaAula[]>([]);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(''); // Data única selecionada
  
  // Estado do diálogo de confirmação
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    occurrence: OcorrenciaAula | null;
  }>({
    open: false,
    occurrence: null,
  });
  const [myEnrollments, setMyEnrollments] = useState<InscricaoAula[]>([]);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);
  const [cancelDialog, setCancelDialog] = useState<{
    open: boolean;
    enrollment: InscricaoAula | null;
  }>({
    open: false,
    enrollment: null,
  });
  const [cancellingEnrollment, setCancellingEnrollment] = useState(false);
  // Fallback: aulas base quando não há ocorrências geradas
  const [fallbackClasses, setFallbackClasses] = useState<Aula[]>([]);
  const [loadingFallback, setLoadingFallback] = useState(false);

  const loadMyEnrollments = useCallback(async () => {
    try {
      setLoadingEnrollments(true);
      const data = await classEnrollmentsService.myEnrollments({ apenas_futuras: true });
      setMyEnrollments(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar minhas inscrições',
        description: getErrorMessage(err),
        variant: 'destructive',
      });
    } finally {
      setLoadingEnrollments(false);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const filters: any = {};
        
        // Se data selecionada, filtrar aulas daquele dia específico
        if (selectedDate) {
          filters.data_inicio = selectedDate;
          filters.data_fim = selectedDate;
        }
        
        if (search.trim()) {
          filters.search = search.trim();
        }
        const { data } = await classOccurrencesService.listForStudent(filters);
        setOccurrences(data);
        // Se não há ocorrências e não há filtro de data, buscar aulas base públicas (ativas)
        if (!selectedDate && data.length === 0) {
          try {
            setLoadingFallback(true);
            const publicClasses = await classesService.list({ status: 'ativa', per_page: 100 });
            setFallbackClasses(publicClasses.data || []);
          } catch (e) {
            // Silenciar erro de fallback
          } finally {
            setLoadingFallback(false);
          }
        } else if (selectedDate) {
          // Limpa fallback se usuário filtra por data
          setFallbackClasses([]);
        }
      } catch (err: any) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedDate, search]);

  useEffect(() => {
    loadMyEnrollments();
  }, [loadMyEnrollments]);

  // Deduplicação adicional de salvaguarda (caso backend retorne duplicado em algum cenário)
  const dedupedOccurrences = useMemo(() => {
    const map = new Map<string, OcorrenciaAula>();
    occurrences.forEach(o => {
      if (!map.has(o.id_ocorrencia_aula)) {
        map.set(o.id_ocorrencia_aula, o);
      }
    });
    return Array.from(map.values());
  }, [occurrences]);

  const filteredOccurrences = useMemo(() => {
    if (!search.trim()) return dedupedOccurrences;
    const term = search.toLowerCase();
    return dedupedOccurrences.filter((o) => {
      const aulaNome = o.aula?.nome?.toLowerCase() || '';
      const esporte = o.aula?.esporte?.toLowerCase() || '';
      const instrutor = (o as any).instrutor?.nome?.toLowerCase?.() || '';
      const descricao = o.aula?.descricao?.toLowerCase() || '';
      return aulaNome.includes(term) || esporte.includes(term) || instrutor.includes(term) || descricao.includes(term);
    });
  }, [dedupedOccurrences, search]);

  const filteredFallbackClasses = useMemo(() => {
    if (!search.trim()) return fallbackClasses;
    const term = search.toLowerCase();
    return fallbackClasses.filter(a => (
      a.nome.toLowerCase().includes(term) ||
      a.esporte.toLowerCase().includes(term) ||
      (a.descricao?.toLowerCase() || '').includes(term)
    ))
  }, [fallbackClasses, search]);

  const enrollmentByOccurrence = useMemo(() => {
    const map: Record<string, InscricaoAula> = {};
    myEnrollments.forEach((enrollment) => {
      if (enrollment.id_ocorrencia_aula) {
        map[enrollment.id_ocorrencia_aula] = enrollment;
      }
    });
    return map;
  }, [myEnrollments]);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'kids': return 'border-purple-500 text-purple-500';
      case 'iniciante': return 'border-green-500 text-green-500';
      case 'intermediario': return 'border-yellow-500 text-yellow-500';
      case 'avancado': return 'border-red-500 text-red-500';
      default: return 'border-gray-500 text-gray-500';
    }
  };

  const getLevelText = (level: string) => {
    switch (level) {
      case 'kids': return 'Kids';
      case 'iniciante': return 'Iniciante';
      case 'intermediario': return 'Intermediário';
      case 'avancado': return 'Avançado';
      default: return level;
    }
  };

  const handleOpenConfirmDialog = (occ: OcorrenciaAula) => {
    setConfirmDialog({
      open: true,
      occurrence: occ,
    });
  };

  const handleCloseConfirmDialog = () => {
    setConfirmDialog({
      open: false,
      occurrence: null,
    });
  };

  const handleOpenCancelDialog = (enrollment: InscricaoAula) => {
    setCancelDialog({
      open: true,
      enrollment,
    });
  };

  const handleCloseCancelDialog = () => {
    setCancelDialog({
      open: false,
      enrollment: null,
    });
  };

  const handleConfirmEnroll = async () => {
    const occ = confirmDialog.occurrence;
    if (!occ) return;

    try {
      setEnrollingId(occ.id_ocorrencia_aula);
      handleCloseConfirmDialog();

      const { inscricao, cobranca } = await classEnrollmentsService.enroll({ id_ocorrencia_aula: occ.id_ocorrencia_aula });
      const valorCobranca = cobranca?.valor ?? cobranca?.valor_total;
      const vencimentoCobranca = cobranca?.vencimento;
      const cobrancaDescricao = [
        valorCobranca ? `Valor: ${formatCurrency(valorCobranca)}` : null,
        vencimentoCobranca ? `Vencimento: ${formatDate(vencimentoCobranca)}` : null,
      ]
        .filter(Boolean)
        .join(' | ');

      toast({
        title: 'Inscricao realizada com sucesso!',
        description: `${cobrancaDescricao || 'Uma cobranca foi gerada.'}

Acesse "Pagamentos" para concluir o pagamento.`,
      });

      setOccurrences(prev => prev.map(o =>
        o.id_ocorrencia_aula === occ.id_ocorrencia_aula
          ? { ...o, numero_inscritos: (o.numero_inscritos || 0) + 1 }
          : o
      ));

      setMyEnrollments(prev => {
        const filtered = prev.filter((enrollment) => enrollment.id_inscricao_aula !== inscricao.id_inscricao_aula);
        return [inscricao, ...filtered];
      });
      await loadMyEnrollments();
    } catch (err: any) {
      toast({
        title: 'Erro ao inscrever',
        description: getErrorMessage(err),
        variant: 'destructive'
      });
    } finally {
      setEnrollingId(null);
    }
  };

  const handleConfirmCancelEnrollment = async () => {
    const enrollment = cancelDialog.enrollment;
    if (!enrollment) return;

    try {
      setCancellingEnrollment(true);
      const response = await classEnrollmentsService.cancel(enrollment.id_inscricao_aula);

      // Se cobrança foi cancelada junto, mostrar mensagem diferente
      const description = response.data?.cobranca_cancelada 
        ? 'Inscrição e cobrança pendente canceladas com sucesso.'
        : 'Inscrição cancelada com sucesso.';

      toast({
        title: 'Sucesso!',
        description,
      });

      setOccurrences(prev => prev.map(o =>
        o.id_ocorrencia_aula === enrollment.id_ocorrencia_aula
          ? { ...o, numero_inscritos: Math.max((o.numero_inscritos || 1) - 1, 0) }
          : o
      ));

      handleCloseCancelDialog();
      await loadMyEnrollments();
    } catch (err: any) {
      toast({
        title: 'Erro ao cancelar inscrição',
        description: getErrorMessage(err),
        variant: 'destructive'
      });
    } finally {
      setCancellingEnrollment(false);
    }
  };

  return (
    <div className="min-h-screen bg-dashboard-bg text-dashboard-fg">
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Aulas Esportivas</h1>
          <p className="text-white/80">Participe das aulas em grupo do FITWAY</p>
        </div>

        {error && (
          <Card className="bg-dashboard-card border-dashboard-border mb-6">
            <CardContent className="text-red-400 py-4">{error}</CardContent>
          </Card>
        )}

        {/* Search and Filters */}
        <div className="mb-6 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
            <Input
              placeholder="Buscar aulas por esporte, nível ou instrutor..."
              className="pl-10 bg-dashboard-card border-dashboard-border text-white placeholder:text-white/50"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-white/50" />
              <Input
                type="date"
                placeholder="Selecionar data"
                className="w-44 bg-dashboard-card border-dashboard-border text-white"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>
            {selectedDate && (
              <Button
                variant="outline"
                size="sm"
                className="border-dashboard-border text-white hover:bg-dashboard-border"
                onClick={() => setSelectedDate('')}
              >
                Limpar
              </Button>
            )}
          </div>
        </div>

        {/* Available Classes */}
        <div>
          <h2 className="text-xl font-bold text-white mb-4">Aulas Disponíveis</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {loading && (
              <Card className="bg-dashboard-card border-dashboard-border">
                <CardContent className="text-white/70 py-8">Carregando aulas...</CardContent>
              </Card>
            )}
            {!loading && filteredOccurrences.map((occ) => {
              const enrollment = enrollmentByOccurrence[occ.id_ocorrencia_aula];
              const isEnrolled = enrollment?.status === 'inscrito';
              const isFull = (occ.numero_inscritos || 0) >= (occ.aula?.capacidade_max || 0);
              const isCurrentEnrolling = enrollingId === occ.id_ocorrencia_aula;
              const isCancelingThis = cancellingEnrollment && cancelDialog.enrollment?.id_ocorrencia_aula === occ.id_ocorrencia_aula;
              return (
              <Card key={occ.id_ocorrencia_aula} className="bg-dashboard-card border-dashboard-border">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-white text-lg">{occ.aula?.nome}</CardTitle>
                      <p className="text-white/60 mt-1">{occ.aula?.esporte}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isEnrolled && (
                        <Badge className="bg-fitway-green text-fitway-dark">Minha inscricao</Badge>
                      )}
                      {occ.aula?.nivel && (
                        <Badge variant="outline" className={`text-xs ${getLevelColor(occ.aula.nivel)}`}>
                          {getLevelText(occ.aula.nivel)}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {occ.aula?.descricao && (
                      <p className="text-white/80 text-sm">{occ.aula.descricao}</p>
                    )}

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-white/70">Instrutor:</span>
                        <div className="flex items-center gap-2 mt-1">
                          <User className="h-4 w-4 text-fitway-green" />
                          <span className="text-white">{(occ as any).instrutor?.nome || '-'}</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-white/70">Duração:</span>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="h-4 w-4 text-fitway-green" />
                          <span className="text-white">{occ.aula?.duracao_min} min</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-white/70 text-sm">Vagas:</span>
                        <span className="text-white text-sm">{occ.numero_inscritos || 0}/{occ.aula?.capacidade_max}</span>
                      </div>
                      <div className="w-full bg-dashboard-bg rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full transition-all duration-300 ${
                            (occ.numero_inscritos || 0) === (occ.aula?.capacidade_max || 0) ? 'bg-red-500' : 'bg-fitway-green'
                          }`}
                          style={{ width: `${(((occ.numero_inscritos || 0) / (occ.aula?.capacidade_max || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-white/70">Data:</span>
                        <div className="flex items-center gap-2 mt-1">
                          <Calendar className="h-4 w-4 text-fitway-green" />
                          <span className="text-white">{formatDate(occ.inicio)} às {formatTime(occ.inicio)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-dashboard-border">
                      <div>
                        {occ.aula?.preco_unitario ? (
                          <>
                            <span className="text-fitway-green font-bold text-lg">
                              {formatCurrency(occ.aula.preco_unitario)}
                            </span>
                            <span className="text-white/60 text-sm ml-1">/aula</span>
                          </>
                        ) : (
                          <span className="text-white/70 text-sm">Incluso no plano</span>
                        )}
                      </div>
                      <Button
                        className={isEnrolled
                          ? 'bg-red-600 hover:bg-red-700 text-white'
                          : 'bg-fitway-green hover:bg-fitway-green/90 text-white'}
                        disabled={isEnrolled ? isCancelingThis : isFull || isCurrentEnrolling}
                        onClick={() => {
                          if (isEnrolled && enrollment) {
                            handleOpenCancelDialog(enrollment);
                          } else {
                            handleOpenConfirmDialog(occ);
                          }
                        }}
                      >
                        {isEnrolled
                          ? (isCancelingThis ? 'Cancelando...' : 'Cancelar inscricao')
                          : isFull
                            ? 'Esgotado'
                            : (isCurrentEnrolling ? 'Inscrevendo...' : 'Inscrever-se')}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {/* Fallback: mostrar aulas base quando não existem ocorrências */}
          {!loading && filteredOccurrences.length === 0 && !selectedDate && !loadingFallback && filteredFallbackClasses.length > 0 && filteredFallbackClasses.map((aula) => (
            <Card key={`aula-${aula.id_aula}`} className="bg-dashboard-card border-dashboard-border opacity-80">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-white text-lg">{aula.nome}</CardTitle>
                    <p className="text-white/60 mt-1">{aula.esporte}</p>
                  </div>
                  {aula.nivel && (
                    <Badge variant="outline" className={`text-xs ${getLevelColor(aula.nivel)}`}>{getLevelText(aula.nivel)}</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {aula.descricao && <p className="text-white/80 text-sm">{aula.descricao}</p>}
                  <div className="p-3 border border-yellow-500/40 bg-yellow-500/10 rounded-md text-sm text-yellow-200">
                    Nenhuma ocorrência futura gerada ainda para esta aula.
                    <br /> Aguarde geração de agenda ou contate o administrador.
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <div>
                      {aula.preco_unitario ? (
                        <>
                          <span className="text-fitway-green font-bold text-lg">{formatCurrency(aula.preco_unitario)}</span>
                          <span className="text-white/60 text-sm ml-1">/aula</span>
                        </>
                      ) : (
                        <span className="text-white/70 text-sm">Incluso no plano</span>
                      )}
                    </div>
                    <Button disabled className="bg-fitway-green/40 cursor-not-allowed text-white/70">Inscrever-se</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          </div>
        </div>
        {!loading && filteredOccurrences.length === 0 && filteredFallbackClasses.length === 0 && (
          <Card className="bg-dashboard-card border-dashboard-border">
            <CardContent className="text-center py-12">
              <BookOpen className="h-16 w-16 text-white/50 mx-auto mb-4" />
              <p className="text-white/70 text-lg mb-2">Nenhuma aula disponível</p>
              <p className="text-white/50 text-sm">
                {selectedDate
                  ? 'Nenhuma aula encontrada para esta data. Tente outra data.'
                  : 'Novas aulas serão adicionadas em breve'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

        <div className="mt-10">
          <h2 className="text-xl font-bold text-white mb-4">Minhas Inscricoes</h2>
          {loadingEnrollments ? (
            <Card className="bg-dashboard-card border-dashboard-border">
              <CardContent className="py-8 text-center text-white/70">Carregando inscricoes...</CardContent>
            </Card>
          ) : myEnrollments.length > 0 ? (
            <div className="space-y-4">
              {myEnrollments.map((enrollment) => {
                const occ = enrollment.ocorrencia;
                const aula = enrollment.aula || occ?.aula;
                const dataInicio = occ?.inicio;
                const valor = aula?.preco_unitario ?? occ?.aula?.preco_unitario;
                const isCancelingThisEnrollment = cancellingEnrollment && cancelDialog.enrollment?.id_inscricao_aula === enrollment.id_inscricao_aula;

                return (
                  <Card key={enrollment.id_inscricao_aula} className="bg-dashboard-card border-dashboard-border">
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-white font-semibold text-lg">{aula?.nome || 'Aula'}</p>
                          <p className="text-white/60 text-sm">{aula?.esporte || occ?.aula?.esporte || '---'}</p>
                        </div>
                        <Badge className="bg-fitway-green text-fitway-dark capitalize">{enrollment.status}</Badge>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        <div className="text-white/70">
                          <p>Data</p>
                          <p className="flex items-center gap-2 text-white mt-1">
                            <Calendar className="h-4 w-4 text-fitway-green" />
                            {dataInicio ? `${formatDate(dataInicio)} as ${formatTime(dataInicio)}` : '--'}
                          </p>
                        </div>
                        <div className="text-white/70">
                          <p>Valor</p>
                          <p className="text-fitway-green font-semibold mt-1">
                            {valor ? formatCurrency(valor) : 'Incluso no plano'}
                          </p>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white"
                          onClick={() => handleOpenCancelDialog(enrollment)}
                          disabled={isCancelingThisEnrollment}
                        >
                          {isCancelingThisEnrollment ? 'Cancelando...' : 'Cancelar inscricao'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="bg-dashboard-card border-dashboard-border">
              <CardContent className="py-8 text-center text-white/70">
                Voce ainda nao possui inscricoes futuras.
              </CardContent>
            </Card>
          )}
        </div>

      {/* Diálogo de Confirmação */}
      <AlertDialog open={confirmDialog.open} onOpenChange={handleCloseConfirmDialog}>
        <AlertDialogContent className="bg-dashboard-card border-dashboard-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Confirmar Inscrição
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/80">
              {confirmDialog.occurrence && (
                <div className="space-y-3 pt-2">
                  <p className="font-medium text-white">
                    {confirmDialog.occurrence.aula?.nome}
                  </p>
                  <p>
                    Data: <span className="text-fitway-green">{formatDate(confirmDialog.occurrence.inicio)}</span> às{' '}
                    <span className="text-fitway-green">{formatTime(confirmDialog.occurrence.inicio)}</span>
                  </p>
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg mt-4">
                    <p className="text-yellow-200 font-medium mb-2">
                      ⚠️ Atenção: Esta ação gerará uma cobrança
                    </p>
                    {confirmDialog.occurrence.aula?.preco_unitario ? (
                      <p className="text-white/90">
                        Será gerada uma cobrança de{' '}
                        <span className="font-bold text-fitway-green">
                          {formatCurrency(confirmDialog.occurrence.aula.preco_unitario)}
                        </span>
                        {' '}que deverá ser paga para confirmar sua inscrição.
                      </p>
                    ) : (
                      <p className="text-white/90">
                        Esta aula está inclusa no seu plano, mas uma cobrança será gerada para controle.
                      </p>
                    )}
                  </div>
                  <p className="text-sm text-white/60 mt-3">
                    Após confirmar, você poderá pagar a cobrança na área de Pagamentos.
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-dashboard-border text-white hover:bg-dashboard-border">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              className="bg-fitway-green hover:bg-fitway-green/90 text-white"
              onClick={handleConfirmEnroll}
            >
              Confirmar e Gerar Cobrança
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={cancelDialog.open}
        onOpenChange={(open) => {
          if (!open && !cancellingEnrollment) {
            handleCloseCancelDialog();
          }
        }}
      >
        <AlertDialogContent className="bg-dashboard-card border-dashboard-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-400" />
              Cancelar Inscricao
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/80">
              Ao cancelar, sua vaga sera liberada e cobrancas pendentes serao anuladas automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {cancelDialog.enrollment && (
            <div className="space-y-3 bg-dashboard-bg/60 p-4 rounded-lg">
              <p className="text-white font-semibold text-lg">
                {cancelDialog.enrollment.aula?.nome || cancelDialog.enrollment.ocorrencia?.aula?.nome || 'Aula'}
              </p>
              <p className="text-white/70 text-sm">
                {cancelDialog.enrollment.ocorrencia?.inicio
                  ? `${formatDate(cancelDialog.enrollment.ocorrencia.inicio)} as ${formatTime(cancelDialog.enrollment.ocorrencia.inicio)}`
                  : 'Horario nao disponivel'}
              </p>
              <div className="flex justify-between text-sm text-white/70 border-t border-dashboard-border pt-2">
                <span>Valor previsto</span>
                <span className="text-fitway-green font-semibold">
                  {cancelDialog.enrollment.aula?.preco_unitario
                    ? formatCurrency(cancelDialog.enrollment.aula.preco_unitario)
                    : 'Incluso no plano'}
                </span>
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel
              className="bg-transparent border-dashboard-border text-white hover:bg-dashboard-border"
              disabled={cancellingEnrollment}
            >
              Manter inscricao
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={handleConfirmCancelEnrollment}
              disabled={cancellingEnrollment}
            >
              {cancellingEnrollment ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Cancelando...
                </>
              ) : (
                'Confirmar cancelamento'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StudentClasses;
