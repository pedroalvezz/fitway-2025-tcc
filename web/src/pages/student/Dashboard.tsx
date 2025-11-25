import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { StatCardSkeleton, CardSkeleton } from '@/components/LoadingSkeletons';
import { dashboardService, type StudentDashboardData } from '@/services/dashboard.service';
import { formatCurrency, formatDate, formatTime } from '@/lib/utils';
import { 
  Calendar, 
  Clock, 
  CreditCard, 
  AlertCircle,
  MapPin,
  BookOpen,
  User,
  Dumbbell
} from 'lucide-react';

const StudentDashboard = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<StudentDashboardData | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  // Listen for app-level data updates (e.g., enrollment changes) and refresh
  useEffect(() => {
    const handler = (e: any) => {
      if (!e || !e.detail) return;
      if (e.detail.type === 'enrollment') {
        loadDashboard();
      }
    };
    window.addEventListener('app:data-updated', handler as EventListener);
    return () => window.removeEventListener('app:data-updated', handler as EventListener);
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const dashboardData = await dashboardService.getStudentDashboard();
      setData(dashboardData);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar dashboard',
        description: error.message || 'Tente novamente mais tarde',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard do Aluno</h1>
        <p className="text-white/80">Bem-vindo de volta! Aqui está seu resumo esportivo.</p>
      </div>

      {/* Status Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Assinatura */}
            <Card className="bg-dashboard-card border-dashboard-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-dashboard-fg">Plano Atual</CardTitle>
                <CreditCard className="h-4 w-4 text-fitway-green" />
              </CardHeader>
              <CardContent>
                {data.assinatura ? (
                  <>
                    <div className="text-2xl font-bold text-fitway-green">{data.assinatura.nome}</div>
                    <Badge variant="default" className="mt-1 bg-fitway-green">
                      Ativo
                    </Badge>
                    <p className="text-xs text-white/60 mt-2">
                      Vence em: {formatDate(data.assinatura.proximo_vencimento)}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="text-2xl font-bold text-white/50">Sem Plano</div>
                    <Badge variant="outline" className="mt-1 border-white/30 text-white/60">
                      Inativo
                    </Badge>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Reservas */}
            <Card className="bg-dashboard-card border-dashboard-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-dashboard-fg">Reservas</CardTitle>
                <Calendar className="h-4 w-4 text-fitway-green" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{data.reservas.total}</div>
                <p className="text-xs text-white/70">
                  {data.reservas.mes} este mês
                </p>
              </CardContent>
            </Card>

            {/* Sessões Personal */}
            <Card className="bg-dashboard-card border-dashboard-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-dashboard-fg">Sessões Personal</CardTitle>
                <Dumbbell className="h-4 w-4 text-fitway-green" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{data.sessoes_personal.total}</div>
                <p className="text-xs text-white/70">
                  {data.sessoes_personal.mes} este mês
                </p>
              </CardContent>
            </Card>

            {/* Pagamentos */}
            <Card className="bg-dashboard-card border-dashboard-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-dashboard-fg">Pagamentos</CardTitle>
                <AlertCircle className="h-4 w-4 text-fitway-green" />
              </CardHeader>
              <CardContent>
                {data.pagamentos.pendentes > 0 ? (
                  <>
                    <div className="text-2xl font-bold text-yellow-500">{data.pagamentos.pendentes}</div>
                    <p className="text-xs text-white/70">
                      {formatCurrency(data.pagamentos.valor_pendente)} pendente
                    </p>
                  </>
                ) : (
                  <>
                    <div className="text-2xl font-bold text-green-500">0</div>
                    <p className="text-xs text-white/70">Tudo em dia!</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Próximas Atividades */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="bg-dashboard-card border-dashboard-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Calendar className="h-5 w-5 text-fitway-green" />
                  Próximas Atividades
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.proximas_atividades.length > 0 ? (
                  <div className="space-y-4">
                    {data.proximas_atividades.map((atividade) => (
                      <div key={`${atividade.tipo}-${atividade.id}`} className="flex items-center justify-between p-3 bg-dashboard-bg/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          {atividade.tipo === 'reserva' ? (
                            <MapPin className="h-5 w-5 text-fitway-green" />
                          ) : (
                            <Dumbbell className="h-5 w-5 text-fitway-green" />
                          )}
                          <div>
                            <p className="font-medium text-white">{atividade.titulo}</p>
                            <p className="text-xs text-white/60">
                              {formatDate(atividade.inicio, true)}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-fitway-green border-fitway-green capitalize">
                          {atividade.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-white/50 mx-auto mb-4" />
                    <p className="text-white/70">Nenhuma atividade agendada</p>
                    <Button variant="sport" size="sm" className="mt-4" asChild>
                      <Link to="/aluno/quadras">Reservar Quadra</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Aulas Inscritas */}
            <Card className="bg-dashboard-card border-dashboard-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <BookOpen className="h-5 w-5 text-fitway-green" />
                  Minhas Aulas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-6">
                  <div className="text-4xl font-bold text-fitway-green mb-2">
                    {data.aulas.inscricoes_ativas}
                  </div>
                  <p className="text-white/70 mb-4">aulas ativas</p>
                  <Button variant="sport" size="sm" asChild>
                    <Link to="/aluno/aulas">Ver Aulas</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-white/70">Erro ao carregar dashboard</p>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
