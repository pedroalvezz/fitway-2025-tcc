import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { EmptyState } from '@/components/EmptyState';
import { formatCurrency, debounce } from '@/lib/utils';
import { classesService, classOccurrencesService } from '@/services/classes.service';
import { ApiError } from '@/lib/api-client';
import type { Aula } from '@/types';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Users,
  Calendar,
  Clock,
  BookOpen,
  Loader2,
  TrendingUp,
  HelpCircle,
  ArrowRight,
  AlertCircle,
  Sparkles,
  Zap
} from 'lucide-react';

const AdminClasses = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // State
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ativa');
  const [esporteFilter, setEsporteFilter] = useState('all');
  const [nivelFilter, setNivelFilter] = useState('all');

  // Load aulas
  useEffect(() => {
    loadAulas();
  }, [statusFilter, esporteFilter, nivelFilter, searchTerm]);

  const loadAulas = async (overrideSearch?: string) => {
    try {
      setLoading(true);
      const filters: any = {};
      
      // Sempre enviar status=all para permitir exibição de ativas + inativas
      if (statusFilter === 'all') {
        filters.status = 'all';
      } else {
        filters.status = statusFilter;
      }
      if (esporteFilter !== 'all') filters.esporte = esporteFilter;
      if (nivelFilter !== 'all') filters.nivel = nivelFilter;
      const termToUse = overrideSearch !== undefined ? overrideSearch : searchTerm;
      if (termToUse) filters.search = termToUse;

      const response = await classesService.list(filters);
      setAulas(response.data);
    } catch (error) {
      if (error instanceof ApiError) {
        toast({
          title: 'Erro ao carregar aulas',
          description: error.message,
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // Debounced search
  const handleSearch = debounce((term: string) => {
    setSearchTerm(term);
    // Passar termo diretamente para evitar uso de estado ainda não atualizado
    loadAulas(term);
  }, 500);

  const handleDelete = async (id: string, nome: string) => {
    try {
      await classesService.delete(id);
      toast({
        title: "Aula inativada!",
        description: `${nome} foi inativada com sucesso.`,
      });
      loadAulas();
    } catch (error) {
      if (error instanceof ApiError) {
        toast({
          title: "Erro ao inativar aula",
          description: error.message,
          variant: "destructive",
        });
      }
    }
  };

  // Stats
  const totalAulas = aulas.length;
  const aulasAtivas = aulas.filter(a => a.status === 'ativa').length;
  const totalHorarios = aulas.reduce((sum, a) => sum + (a.horarios_count || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-fitway-green" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Gestão de Aulas</h1>
          <p className="text-white/80">Gerencie as aulas em grupo do FITWAY</p>
        </div>
        
        <div className="flex items-center gap-3">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-blue-500 text-blue-400 hover:bg-blue-500/10"
              >
                <HelpCircle className="h-4 w-4 mr-2" />
                Ajuda
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-[#1a1a1a] border-white/10">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-2xl font-bold text-white flex items-center gap-2">
                  <BookOpen className="h-6 w-6 text-fitway-green" />
                  Gerenciamento de Aulas em Grupo - Guia Completo
                </AlertDialogTitle>
              </AlertDialogHeader>
              
              <div className="space-y-6 text-white/90">
                {/* Seção 1: O que são Aulas? */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    🎯 O que são Aulas em Grupo?
                  </h3>
                  <p className="leading-relaxed">
                    Aulas em Grupo são atividades esportivas com <strong>horários fixos semanais</strong> que se repetem 
                    ao longo do tempo. Por exemplo: Beach Tennis toda Terça 19h, Funcional toda Segunda 7h, etc.
                  </p>
                  <p className="leading-relaxed">
                    Diferente de <strong>Sessões Personal</strong> (1 instrutor + 1 aluno, horário flexível), as Aulas têm 
                    <strong> capacidade máxima</strong> e <strong>calendário recorrente</strong>.
                  </p>
                </div>

                {/* Seção 2: Fluxo de Trabalho */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    🔄 Fluxo de Trabalho Completo
                  </h3>
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-fitway-green rounded-full flex items-center justify-center text-xs font-bold">1</span>
                      <div>
                        <strong className="text-fitway-green">Criar Aula</strong>
                        <p className="text-sm text-white/70 mt-1">
                          Defina nome, esporte, duração, capacidade máxima. Exemplo: "Beach Tennis Iniciante" com 10 alunos, 90min.
                        </p>
                      </div>
                    </div>
                    
                    <ArrowRight className="h-5 w-5 text-fitway-green mx-auto" />
                    
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-blue-400 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                      <div>
                        <strong className="text-blue-400">Configurar Horários Semanais</strong>
                        <p className="text-sm text-white/70 mt-1">
                          Defina os dias da semana + horários + instrutor + quadra. Exemplo: Terça 19h com Carlos na Quadra 1.
                          <br />
                          <span className="text-yellow-400">🔔 Clique no botão verde "Horários" ao lado de cada aula!</span>
                        </p>
                      </div>
                    </div>
                    
                    <ArrowRight className="h-5 w-5 text-fitway-green mx-auto" />
                    
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-purple-400 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                      <div>
                        <strong className="text-purple-400">Gerar Ocorrências (Datas)</strong>
                        <p className="text-sm text-white/70 mt-1">
                          O sistema cria automaticamente as datas específicas no calendário. Exemplo: "Terça 19h" vira 05/11, 12/11, 19/11, 26/11...
                          <br />
                          <span className="text-yellow-400">🔔 Clique no botão azul "Gerar" para escolher o período!</span>
                        </p>
                      </div>
                    </div>
                    
                    <ArrowRight className="h-5 w-5 text-fitway-green mx-auto" />
                    
                    <div className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-fitway-green rounded-full flex items-center justify-center text-xs font-bold">4</span>
                      <div>
                        <strong className="text-fitway-green">Alunos se Inscrevem</strong>
                        <p className="text-sm text-white/70 mt-1">
                          Com ocorrências criadas, alunos podem ver o calendário e se inscrever nas datas específicas.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Seção 3: Botões e Ações */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    🎨 Botões e Ações (Grid 2×2)
                  </h3>
                  <p className="text-sm text-white/70 mb-3">
                    Os botões estão organizados em um <strong>grid 2×2</strong> para melhor visualização:
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-2 mb-3 p-3 bg-white/5 rounded-lg border border-white/10">
                      <div className="text-center p-2 border border-green-500/30 rounded bg-green-500/5">
                        <Calendar className="h-4 w-4 text-green-400 mx-auto mb-1" />
                        <div className="text-xs font-semibold text-green-400">Horários</div>
                      </div>
                      <div className="text-center p-2 border border-blue-500/30 rounded bg-blue-500/5">
                        <Zap className="h-4 w-4 text-blue-400 mx-auto mb-1" />
                        <div className="text-xs font-semibold text-blue-400">Gerar</div>
                      </div>
                      <div className="text-center p-2 border border-purple-500/30 rounded bg-purple-500/5">
                        <Users className="h-4 w-4 text-purple-400 mx-auto mb-1" />
                        <div className="text-xs font-semibold text-purple-400">Ocorrências</div>
                      </div>
                      <div className="text-center p-2 border border-white/30 rounded bg-white/5">
                        <Edit className="h-4 w-4 text-white/60 mx-auto mb-1" />
                        <div className="text-xs font-semibold text-white/80">Editar</div>
                      </div>
                      <div className="col-span-2 text-center p-2 border border-red-500/30 rounded bg-red-500/5">
                        <Trash2 className="h-4 w-4 text-red-400 mx-auto mb-1" />
                        <div className="text-xs font-semibold text-red-400">Remover Aula</div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-start gap-3 p-2 bg-white/5 rounded">
                        <Calendar className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-green-400">Horários (Verde)</strong> - Configurar horários semanais recorrentes
                          <p className="text-xs text-white/60 mt-1">Ex: Segunda 7h, Terça 19h</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-2 bg-white/5 rounded">
                        <Zap className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-blue-400">Gerar (Azul)</strong> - Gerar ocorrências no calendário
                          <p className="text-xs text-white/60 mt-1">Cria datas específicas (ex: 05/11, 12/11, 19/11...)</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-2 bg-white/5 rounded">
                        <Users className="h-4 w-4 text-purple-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-purple-400">Ocorrências (Roxo)</strong> - Ver todas as datas geradas e gerenciar inscrições
                          <p className="text-xs text-white/60 mt-1">
                            ✨ <strong>NOVO!</strong> Acesso a gerenciamento individual por data OU inscrição em lote
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-2 bg-white/5 rounded">
                        <Edit className="h-4 w-4 text-white/60 flex-shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-white/80">Editar (Cinza)</strong> - Alterar informações da aula
                          <p className="text-xs text-white/60 mt-1">Nome, duração, capacidade, preço, etc</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-2 bg-white/5 rounded">
                        <Trash2 className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-red-400">Remover Aula (Vermelho)</strong> - Marcar como excluída
                          <p className="text-xs text-white/60 mt-1">Soft delete: dados são preservados no histórico</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Seção 3.5: Novo - Gerenciamento de Inscrições */}
                <div className="space-y-3 bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    ✨ NOVO: Gerenciamento de Inscrições (2 Formas)
                  </h3>
                  <p className="text-sm text-white/80 leading-relaxed">
                    Após clicar no botão <strong className="text-purple-400">Ocorrências</strong>, você terá acesso a:
                  </p>
                  
                  <div className="space-y-3 mt-3">
                    <div className="bg-white/5 rounded-lg p-3 border-l-4 border-purple-500">
                      <strong className="text-purple-300">📅 Gerenciamento Individual</strong>
                      <p className="text-sm text-white/70 mt-1">
                        Lista de todas as datas geradas (ex: 27 ocorrências). Clique em "Gerenciar Inscrições" em cada data 
                        para adicionar/remover alunos <strong>naquela data específica</strong>.
                      </p>
                      <p className="text-xs text-purple-300 mt-2">
                        💡 Use quando: Turmas variam de semana a semana (alunos diferentes por data)
                      </p>
                    </div>
                    
                    <div className="bg-white/5 rounded-lg p-3 border-l-4 border-orange-500">
                      <strong className="text-orange-300">🚀 Inscrição em Lote</strong>
                      <p className="text-sm text-white/70 mt-1">
                        Selecione <strong>múltiplas datas</strong> + <strong>múltiplos alunos</strong> de uma vez. 
                        Exemplo: Inscrever 5 alunos em 10 datas diferentes = 50 inscrições em 1 clique!
                      </p>
                      <p className="text-xs text-orange-300 mt-2">
                        💡 Use quando: Mesmos alunos frequentam várias/todas as datas (turma fixa)
                      </p>
                      <p className="text-xs text-yellow-400 mt-2">
                        ⚠️ Validação automática: Datas sem vagas suficientes ficam desabilitadas
                      </p>
                    </div>
                  </div>
                </div>

                {/* Seção 4: Primeiro Uso */}
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    🚀 Criando sua Primeira Aula (Passo a Passo)
                  </h3>
                  <ol className="list-decimal list-inside space-y-2 text-sm">
                    <li>
                      <strong>Clique em "Nova Aula"</strong> (botão verde no topo)
                    </li>
                    <li>
                      <strong>Preencha o formulário:</strong> Nome ("Beach Tennis Intermediário"), Esporte (Beach Tennis), 
                      Duração (90min), Capacidade (12 alunos), Preço (R$ 80,00 por aula)
                    </li>
                    <li>
                      <strong>Salve</strong> e volte para esta tela
                    </li>
                    <li>
                      <strong>Clique no botão verde "Horários"</strong> na linha da aula criada
                    </li>
                    <li>
                      <strong>Adicione um horário semanal:</strong> Terça-feira, 19:00, Instrutor Carlos, Quadra 1
                    </li>
                    <li>
                      <strong>Volte e clique no botão azul "Gerar"</strong>
                    </li>
                    <li>
                      <strong>Escolha o período:</strong> 01/12/2024 até 31/12/2024 (gera ~4 ocorrências)
                    </li>
                    <li>
                      <strong>Pronto!</strong> Alunos agora podem se inscrever nas datas específicas (05/12, 12/12, 19/12, 26/12)
                    </li>
                  </ol>
                </div>

                {/* Warning Box */}
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div className="space-y-2 text-sm">
                      <p className="text-yellow-400 font-semibold">⚠️ Importante: Complete os 3 Passos!</p>
                      <p className="text-white/80">
                        Para que uma aula funcione completamente, você <strong>DEVE</strong>:
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-white/70 ml-2">
                        <li>✅ Criar a aula (passo 1)</li>
                        <li>✅ Configurar pelo menos 1 horário semanal (passo 2)</li>
                        <li>✅ Gerar ocorrências para um período (passo 3)</li>
                      </ul>
                      <p className="text-white/70 mt-2">
                        Sem horários configurados → não consegue gerar ocorrências<br />
                        Sem ocorrências geradas → alunos não conseguem se inscrever
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tips Box */}
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <div className="space-y-2 text-sm">
                      <p className="text-green-400 font-semibold">💡 Dicas para Gestão Eficiente</p>
                      <ul className="list-disc list-inside space-y-1 text-white/70 ml-2">
                        <li>Gere ocorrências em lotes de 2-3 meses para facilitar inscrições</li>
                        <li>Use filtros (esporte, instrutor, status) para encontrar aulas rapidamente</li>
                        <li>Aulas "inativas" ficam ocultas para alunos mas preservam histórico</li>
                        <li>O sistema detecta conflitos automaticamente (mesmo instrutor/quadra no mesmo horário)</li>
                        <li>Use a busca para encontrar aulas por nome rapidamente</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              
              <AlertDialogFooter>
                <AlertDialogAction className="bg-fitway-green hover:bg-fitway-green/90">
                  Entendi! Vamos começar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button 
            className="bg-fitway-green hover:bg-fitway-green/90 text-white"
            onClick={() => navigate('/admin/aulas/novo')}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova Aula
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="bg-dashboard-card border-dashboard-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-dashboard-fg">Total de Aulas</CardTitle>
            <BookOpen className="h-4 w-4 text-fitway-green" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{totalAulas}</div>
            <p className="text-xs text-white/70">{aulasAtivas} ativas</p>
          </CardContent>
        </Card>

        <Card className="bg-dashboard-card border-dashboard-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-dashboard-fg">Horários Configurados</CardTitle>
            <Calendar className="h-4 w-4 text-fitway-green" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{totalHorarios}</div>
            <p className="text-xs text-white/70">horários semanais</p>
          </CardContent>
        </Card>

        <Card className="bg-dashboard-card border-dashboard-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-dashboard-fg">Esportes</CardTitle>
            <TrendingUp className="h-4 w-4 text-fitway-green" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {new Set(aulas.map(a => a.esporte)).size}
            </div>
            <p className="text-xs text-white/70">modalidades</p>
          </CardContent>
        </Card>

        <Card className="bg-dashboard-card border-dashboard-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-dashboard-fg">Próxima Aula</CardTitle>
            <Clock className="h-4 w-4 text-fitway-green" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">--:--</div>
            <p className="text-xs text-white/70">sem ocorrências</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-white/50" />
          <Input
            placeholder="Buscar aulas..."
            className="pl-10 bg-dashboard-card border-dashboard-border text-white placeholder:text-white/50"
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-48 bg-dashboard-card border-dashboard-border text-white">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Status</SelectItem>
            <SelectItem value="ativa">Ativas</SelectItem>
            <SelectItem value="inativa">Inativas</SelectItem>
          </SelectContent>
        </Select>

        <Select value={nivelFilter} onValueChange={setNivelFilter}>
          <SelectTrigger className="w-full md:w-48 bg-dashboard-card border-dashboard-border text-white">
            <SelectValue placeholder="Nível" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Níveis</SelectItem>
            <SelectItem value="iniciante">Iniciante</SelectItem>
            <SelectItem value="intermediario">Intermediário</SelectItem>
            <SelectItem value="avancado">Avançado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Classes Grid */}
      {aulas.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Nenhuma aula encontrada"
          description="Comece criando sua primeira aula em grupo para organizar turmas de alunos."
          action={{
            label: "Nova Aula",
            onClick: () => navigate('/admin/aulas/novo')
          }}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {aulas.map((aula) => (
            <Card key={aula.id_aula} className="bg-dashboard-card border-dashboard-border hover:border-fitway-green/50 transition-colors">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-white text-lg mb-1">{aula.nome}</CardTitle>
                    <p className="text-white/60 text-sm capitalize">{aula.esporte.replace('_', ' ')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={aula.status === 'ativa' ? 'default' : 'secondary'}
                      className={aula.status === 'ativa' ? 'bg-fitway-green text-white' : 'bg-gray-600 text-white'}
                    >
                      {aula.status === 'ativa' ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-4">
                  {/* Info Grid */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-white/70">Duração:</span>
                      <p className="text-white font-medium">{aula.duracao_min} min</p>
                    </div>
                    <div>
                      <span className="text-white/70">Capacidade:</span>
                      <p className="text-white font-medium">{aula.capacidade_max} alunos</p>
                    </div>
                    <div>
                      <span className="text-white/70">Nível:</span>
                      <p className="text-white font-medium capitalize">{aula.nivel || 'Livre'}</p>
                    </div>
                    <div>
                      <span className="text-white/70">Preço:</span>
                      <p className="text-white font-medium">
                        {aula.preco_unitario ? formatCurrency(aula.preco_unitario) : 'Incluso'}
                      </p>
                    </div>
                  </div>

                  {/* Horários Count */}
                  <div className="flex items-center justify-between p-3 bg-dashboard-bg rounded-lg">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-fitway-green" />
                      <span className="text-white/70 text-sm">Horários:</span>
                    </div>
                    <span className="text-white font-medium">{aula.horarios_count || 0}x/semana</span>
                  </div>

                  {/* Descrição */}
                  {aula.descricao && (
                    <p className="text-white/60 text-sm line-clamp-2">{aula.descricao}</p>
                  )}

                  {/* Actions - Grid responsivo 2x2 */}
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    {/* Linha 1: Horários + Gerar */}
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="border-fitway-green text-fitway-green hover:bg-fitway-green/10"
                      onClick={() => navigate(`/admin/aulas/${aula.id_aula}/horarios`)}
                    >
                      <Calendar className="mr-1.5 h-3.5 w-3.5" />
                      Horários
                    </Button>
                    
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="border-blue-500 text-blue-400 hover:bg-blue-500/10"
                      onClick={() => navigate(`/admin/aulas/${aula.id_aula}/gerar-ocorrencias`)}
                      title="Gerar ocorrências no calendário"
                    >
                      <Calendar className="mr-1.5 h-3.5 w-3.5" />
                      Gerar
                    </Button>
                    
                    {/* Linha 2: Ocorrências + Editar */}
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="border-purple-500 text-purple-400 hover:bg-purple-500/10"
                      onClick={() => {
                        // Navega para página de listagem de ocorrências (gerenciar individualmente OU em lote)
                        navigate(`/admin/aulas/${aula.id_aula}/ocorrencias`);
                      }}
                      title="Ver todas as datas geradas e gerenciar inscrições"
                    >
                      <Users className="mr-1.5 h-3.5 w-3.5" />
                      Ocorrências
                    </Button>
                    
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="border-dashboard-border text-white hover:bg-dashboard-border"
                      onClick={() => navigate(`/admin/aulas/editar/${aula.id_aula}`)}
                    >
                      <Edit className="mr-1.5 h-3.5 w-3.5" />
                      Editar
                    </Button>
                    
                    {/* Linha 3: Remover (span 2 colunas) */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="col-span-2 border-red-500 text-red-500 hover:bg-red-500/10"
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                          Remover Aula
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-dashboard-card border-dashboard-border">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-white">Confirmar inativação</AlertDialogTitle>
                          <AlertDialogDescription className="text-white/70">
                            Deseja realmente inativar a aula <span className="font-semibold text-white">{aula.nome}</span>? 
                            Ela não ficará mais visível para novos alunos.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-dashboard-border border-dashboard-border text-white hover:bg-dashboard-border/80">
                            Cancelar
                          </AlertDialogCancel>
                          <AlertDialogAction 
                            className="bg-red-500 hover:bg-red-600 text-white"
                            onClick={() => handleDelete(aula.id_aula, aula.nome)}
                          >
                            Inativar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminClasses;
