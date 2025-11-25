import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { classesService, classOccurrencesService } from '@/services/classes.service';
import { ApiError } from '@/lib/api-client';
import type { Aula } from '@/types';
import { ArrowLeft, Calendar, Loader2, AlertCircle, CheckCircle2, XCircle, HelpCircle, BookOpen, Zap, Users } from 'lucide-react';

const GenerateOccurrences = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const [aula, setAula] = useState<Aula | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [formData, setFormData] = useState({
    data_inicio: new Date().toISOString().split('T')[0],
    data_fim: '',
  });

  const [result, setResult] = useState<{
    criadas: number;
    puladas: number;
    detalhes?: string;
  } | null>(null);

  useEffect(() => {
    if (id) {
      loadAula();
    }
  }, [id]);

  const loadAula = async () => {
    try {
      setLoading(true);
      const aulaData = await classesService.get(id!);
      setAula(aulaData);

      // Sugerir data fim: 3 meses a partir de hoje
      const hoje = new Date();
      const tresMeses = new Date(hoje);
      tresMeses.setMonth(tresMeses.getMonth() + 3);
      setFormData((prev) => ({
        ...prev,
        data_fim: tresMeses.toISOString().split('T')[0],
      }));
    } catch (error) {
      if (error instanceof ApiError) {
        toast({
          title: 'Erro ao carregar aula',
          description: error.message,
          variant: 'destructive',
        });
      }
      navigate('/admin/aulas');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.data_inicio || !formData.data_fim) {
      toast({
        title: 'Erro de validação',
        description: 'Datas de início e fim são obrigatórias',
        variant: 'destructive',
      });
      return;
    }

    if (formData.data_fim <= formData.data_inicio) {
      toast({
        title: 'Erro de validação',
        description: 'Data fim deve ser posterior à data início',
        variant: 'destructive',
      });
      return;
    }

    try {
      setGenerating(true);
      setResult(null);

      const response = await classOccurrencesService.gerar({
        id_aula: id!,
        data_inicio: formData.data_inicio,
        data_fim: formData.data_fim,
      });

      setResult({
        criadas: response.criadas || 0,
        puladas: response.puladas || 0,
        detalhes: response.message,
      });

      toast({
        title: 'Ocorrências geradas!',
        description: `${response.criadas} ocorrências criadas, ${response.puladas} puladas por conflito.`,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        toast({
          title: 'Erro ao gerar ocorrências',
          description: error.message,
          variant: 'destructive',
        });
      }
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-fitway-green" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => navigate('/admin/aulas')}
            className="border-dashboard-border text-white hover:bg-dashboard-border"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-white">Gerar Ocorrências</h1>
            <p className="text-white/80">
              Gerar calendário de ocorrências para: <span className="font-semibold">{aula?.nome}</span>
            </p>
          </div>
        </div>

        {/* Botão de Ajuda */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              className="border-blue-500 text-blue-400 hover:bg-blue-500/10"
            >
              <HelpCircle className="mr-2 h-4 w-4" />
              Como Funciona?
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-dashboard-card border-dashboard-border max-w-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-400" />
                Como Gerar Ocorrências Automaticamente
              </AlertDialogTitle>
              <AlertDialogDescription className="text-white/80 space-y-4 text-left">
                <div className="space-y-3">
                  <p className="font-semibold text-white">🎯 O que são Ocorrências?</p>
                  <p>
                    Ocorrências são as <strong className="text-fitway-green">aulas reais no calendário</strong>.
                    Você configura os horários semanais, e o sistema gera automaticamente as datas específicas.
                  </p>
                  
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 space-y-2">
                    <p className="font-semibold text-blue-200 flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Exemplo Prático:
                    </p>
                    <p className="text-sm">
                      Você configurou: <strong>"Toda Terça-feira às 19:00"</strong>
                    </p>
                    <p className="text-sm">
                      Período: <strong>01/11/2025 até 30/11/2025</strong>
                    </p>
                    <p className="text-sm mt-2 text-fitway-green">
                      ✅ Sistema vai criar automaticamente:
                    </p>
                    <ul className="text-sm space-y-1 ml-4">
                      <li>• <strong>05/11/2025 às 19:00</strong> (Terça)</li>
                      <li>• <strong>12/11/2025 às 19:00</strong> (Terça)</li>
                      <li>• <strong>19/11/2025 às 19:00</strong> (Terça)</li>
                      <li>• <strong>26/11/2025 às 19:00</strong> (Terça)</li>
                    </ul>
                    <p className="text-sm mt-2">
                      Total: <strong className="text-fitway-green">4 ocorrências criadas!</strong>
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="font-semibold text-white">🔄 Como o Sistema Funciona?</p>
                    <ol className="text-sm space-y-2 ml-4">
                      <li><strong>1. Busca os horários semanais</strong> - Pega todas as configurações (Seg, Ter, Qua...)</li>
                      <li><strong>2. Calcula as datas</strong> - Para cada horário, calcula as próximas ocorrências no período</li>
                      <li><strong>3. Valida conflitos</strong> - Verifica se instrutor/quadra estão livres</li>
                      <li><strong>4. Cria as ocorrências</strong> - Salva no banco de dados para alunos se inscreverem</li>
                    </ol>
                  </div>

                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                    <p className="text-sm text-green-200">
                      <strong>✅ Inteligente:</strong> O sistema detecta automaticamente conflitos! Se o instrutor ou quadra
                      já tiverem outro compromisso no mesmo horário, a ocorrência é pulada e você é notificado.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="font-semibold text-white">📝 O que preencher?</p>
                    <ul className="text-sm space-y-1 ml-4">
                      <li><strong>Data de Início:</strong> Quando começa o período (ex: 01/11/2025)</li>
                      <li><strong>Data de Fim:</strong> Quando termina o período (ex: 30/11/2025)</li>
                    </ul>
                    <p className="text-sm mt-2 text-yellow-200">
                      💡 <strong>Dica:</strong> Gere ocorrências para 2-3 meses de cada vez. Depois você pode gerar mais!
                    </p>
                  </div>

                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                    <p className="text-sm text-yellow-200">
                      <strong>⚠️ Pré-requisito:</strong> Você precisa ter configurado pelo menos 1 horário semanal antes
                      de gerar ocorrências. Sem horários, não há o que gerar!
                    </p>
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction className="bg-fitway-green hover:bg-fitway-green/90">
                Entendi! Vamos Gerar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="max-w-2xl">
        <Card className="bg-dashboard-card border-dashboard-border mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Período de Geração
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert className="mb-6 bg-blue-500/10 border-blue-500/30 text-blue-200">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                As ocorrências serão criadas com base nos horários semanais configurados. Ocorrências que conflitarem
                com outros agendamentos serão automaticamente puladas.
              </AlertDescription>
            </Alert>

            {/* Alerta caso a aula não tenha horários configurados */}
            {aula && ((aula.horarios_count !== undefined && aula.horarios_count === 0) || (!aula.horarios || aula.horarios.length === 0)) && (
              <Alert className="mb-6 bg-yellow-500/10 border-yellow-500/30 text-yellow-200">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Atenção:</strong> Esta aula não possui horários semanais configurados. Configure os horários
                  primeiro antes de gerar ocorrências.
                  <Button
                    variant="link"
                    className="p-0 h-auto text-yellow-200 underline ml-2"
                    onClick={() => navigate(`/admin/aulas/${id}/horarios`)}
                  >
                    Configurar Horários
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="data_inicio" className="text-white">
                    Data de Início
                  </Label>
                  <Input
                    id="data_inicio"
                    type="date"
                    value={formData.data_inicio}
                    onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                    className="bg-dashboard-bg border-dashboard-border text-white"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="data_fim" className="text-white">
                    Data de Fim
                  </Label>
                  <Input
                    id="data_fim"
                    type="date"
                    value={formData.data_fim}
                    onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
                    className="bg-dashboard-bg border-dashboard-border text-white"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/admin/aulas')}
                  className="border-dashboard-border text-white hover:bg-dashboard-border"
                  disabled={generating}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-fitway-green hover:bg-fitway-green/90 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={
                    generating ||
                    !aula ||
                    ((aula.horarios_count !== undefined && aula.horarios_count === 0) || (!aula.horarios || aula.horarios.length === 0))
                  }
                  title={
                    (aula && (aula.horarios_count === 0 || !aula.horarios || aula.horarios.length === 0))
                      ? 'Configure ao menos um horário semanal antes de gerar ocorrências.'
                      : undefined
                  }
                >
                  {generating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <Calendar className="mr-2 h-4 w-4" />
                      Gerar Ocorrências
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Resultado da geração */}
        {result && (
          <Card className="bg-dashboard-card border-dashboard-border">
            <CardHeader>
              <CardTitle className="text-white">Resultado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-green-500/10 border-green-500/30">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-8 w-8 text-green-400" />
                      <div>
                        <p className="text-2xl font-bold text-green-400">{result.criadas}</p>
                        <p className="text-sm text-green-200">Ocorrências Criadas</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-yellow-500/10 border-yellow-500/30">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <XCircle className="h-8 w-8 text-yellow-400" />
                      <div>
                        <p className="text-2xl font-bold text-yellow-400">{result.puladas}</p>
                        <p className="text-sm text-yellow-200">Conflitos Detectados</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {result.detalhes && (
                <Alert className="bg-blue-500/10 border-blue-500/30 text-blue-200">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{result.detalhes}</AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col sm:flex-row justify-between gap-3">
                <Button
                  variant="outline"
                  onClick={() => navigate('/admin/aulas')}
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar para Aulas
                </Button>
                
                {result.criadas > 0 && (
                  <Button
                    onClick={() => navigate(`/admin/aulas/${id}/ocorrencias`)}
                    className="bg-purple-500 hover:bg-purple-600 text-white"
                  >
                    <Users className="mr-2 h-4 w-4" />
                    Ver Todas as Ocorrências
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default GenerateOccurrences;
