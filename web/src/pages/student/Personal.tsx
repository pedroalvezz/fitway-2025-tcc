import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Calendar, 
  Clock, 
  User,
  Star,
  DollarSign,
  Filter,
  AlertCircle,
  Loader2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { instructorsService } from '@/services/instructors.service';
import { personalSessionsService } from '@/services/personal-sessions.service';
import type { Instructor, PersonalSession } from '@/types';
import { formatCurrency, formatDate, formatTime, getErrorMessage } from '@/lib/utils';

interface AvailableSlot {
  time: string;
  available: boolean;
  price?: number;
}

const StudentPersonal = () => {
  const { toast } = useToast();
  const [mySessions, setMySessions] = useState<PersonalSession[]>([]);
  const [availableInstructors, setAvailableInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('');

  // Modal de agendamento - Seleção de data/horário
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [selectedInstructor, setSelectedInstructor] = useState<Instructor | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);

  // Modal de confirmação de pagamento
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmationData, setConfirmationData] = useState<{
    instructor: Instructor;
    date: string;
    time: string;
    priceTotal?: number;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Modal de cancelamento de sessão
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [sessionToCancel, setSessionToCancel] = useState<PersonalSession | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Carregar minhas sessões (exclui canceladas por padrão no backend)
      // ✅ NÃO passar 'status' - backend retorna todas exceto canceladas
      const sessionsResponse = await personalSessionsService.getMySessions({
        // Sem filtro de status - backend retorna pendente, confirmada, concluida, no_show
      });
      const sessionsList = sessionsResponse?.data || [];
      setMySessions(Array.isArray(sessionsList) ? sessionsList : []);
      
      // Carregar instrutores disponíveis (publicamente)
      const instructorsResponse = await instructorsService.listPublic();
      setAvailableInstructors(instructorsResponse.data || []);
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
      toast({
        title: 'Erro ao processar',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Carregar horários disponíveis do instrutor (OTIMIZADO - 1 requisição!)
  const loadAvailableSlots = async (instructor: Instructor, date: string) => {
    if (!instructor.id_instrutor) return;
    
    try {
      setLoadingSlots(true);

      console.log(`Carregando disponibilidade para ${instructor.nome} em ${date}`);

      // ✨ NOVA ROTA: Uma única requisição retorna todos os horários!
      const response = await personalSessionsService.getDailyAvailability(
        String(instructor.id_instrutor),
        date
      );

      // A resposta tem estrutura: { horarios_disponiveis: [...], horarios_ocupados: [...], ... }
      const horariosDisponiveis = response.horarios_disponiveis || [];
      const horariosOcupados = response.horarios_ocupados || [];

      // Combinar ambos os arrays (disponíveis + ocupados) com flag de disponibilidade
      const todosHorarios = [
        ...horariosDisponiveis.map((slot: any) => ({
          time: slot.inicio,
          available: true,
          price: instructor.valor_hora, // Usar valor do instrutor
        })),
        ...horariosOcupados.map((slot: any) => ({
          time: slot.inicio,
          available: false,
          price: instructor.valor_hora,
        })),
      ];

      // Ordenar por horário
      todosHorarios.sort((a, b) => a.time.localeCompare(b.time));

      setAvailableSlots(todosHorarios);
      
      console.log(`✅ Carregou ${horariosDisponiveis.length} horários disponíveis e ${horariosOcupados.length} ocupados`);
    } catch (error: any) {
      console.error('Erro ao carregar horários:', error);
      toast({
        title: 'Erro ao carregar disponibilidade',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleSelectInstructor = (instructor: Instructor) => {
    setSelectedInstructor(instructor);
    setSelectedDate(new Date().toISOString().split('T')[0]);
    setSelectedSlot(null);
    setScheduleModalOpen(true);
    loadAvailableSlots(instructor, new Date().toISOString().split('T')[0]);
  };

  const handleSelectSlot = (slot: AvailableSlot) => {
    if (!slot.available) {
      toast({
        title: 'Horário indisponível',
        description: 'Este horário não está disponível. Escolha outro.',
        variant: 'destructive',
      });
      return;
    }

    setSelectedSlot(slot);
    
    // Preparar dados de confirmação
    if (selectedInstructor) {
      setConfirmationData({
        instructor: selectedInstructor,
        date: selectedDate,
        time: slot.time,
        priceTotal: slot.price || selectedInstructor.valor_hora,
      });
      setScheduleModalOpen(false);
      setConfirmModalOpen(true);
    }
  };

  const handleConfirmBooking = async () => {
    if (!confirmationData || !selectedInstructor) return;

    try {
      setSubmitting(true);

      // Construir data/hora corretamente em ISO 8601
      const inicio = `${confirmationData.date}T${confirmationData.time}:00+00:00`;
      
      // Adicionar 1 hora para o fim
      const inicioDate = new Date(inicio);
      const fimDate = new Date(inicioDate.getTime() + 60 * 60 * 1000);
      const fim = fimDate.toISOString();

      console.log('Agendando sessão:', { 
        id_instrutor: selectedInstructor.id_instrutor, 
        inicio, 
        fim,
        preco: confirmationData.priceTotal 
      });

      // Criar sessão
      // O backend auto-preenche id_usuario com auth()->id()
      await personalSessionsService.create({
        id_instrutor: selectedInstructor.id_instrutor,
        inicio,
        fim,
      });

      toast({
        title: 'Sessão agendada com sucesso!',
        description: `Cobrança de ${formatCurrency(confirmationData.priceTotal || 0)} será gerada`,
      });

      setConfirmModalOpen(false);
      setScheduleModalOpen(false);
      setSelectedInstructor(null);
      setSelectedSlot(null);
      setConfirmationData(null);
      
      // Recarregar dados
      loadData();
    } catch (error: any) {
      console.error('Erro ao agendar:', error);
      toast({
        title: 'Erro ao agendar sessão',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelSession = async () => {
    if (!sessionToCancel) return;

    try {
      setCancelling(true);

      console.log('Cancelando sessão:', sessionToCancel.id_sessao_personal);

      // Cancelar sessão no backend (retorna flag de cobrança cancelada)
      const response = await personalSessionsService.cancel(sessionToCancel.id_sessao_personal);

      // Mostrar mensagem contextual baseada se a cobrança foi cancelada
      const description = response.data?.cobranca_cancelada
        ? 'Sessão e cobrança pendente canceladas com sucesso.'
        : 'Sessão cancelada com sucesso.';

      toast({
        title: 'Sucesso!',
        description,
      });

      setCancelModalOpen(false);
      setSessionToCancel(null);
      
      // Recarregar sessões
      loadData();
    } catch (error: any) {
      console.error('Erro ao cancelar sessão:', error);
      toast({
        title: 'Erro ao cancelar sessão',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setCancelling(false);
    }
  };

  const handleOpenCancelModal = (session: PersonalSession) => {
    setSessionToCancel(session);
    setCancelModalOpen(true);
  };

  // Filtrar instrutores
  const filteredInstructors = availableInstructors.filter(instructor => {
    const matchesSearch = instructor.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSpecialty = !selectedSpecialty || 
      (instructor.especialidades && instructor.especialidades.includes(selectedSpecialty));
    return matchesSearch && matchesSpecialty;
  });

  // Sessões futuras e passadas
  const futureSessionsData = mySessions.filter(s => new Date(s.inicio) >= new Date());
  const pastSessionsData = mySessions.filter(s => new Date(s.inicio) < new Date());

  // Estatísticas
  const allSpecialties = new Set<string>();
  availableInstructors.forEach(inst => {
    if (inst.especialidades) {
      inst.especialidades.forEach(spec => allSpecialties.add(spec));
    }
  });

  const avgPrice = availableInstructors.length > 0
    ? availableInstructors.reduce((sum, inst) => sum + (inst.valor_hora || 0), 0) / availableInstructors.length
    : 0;

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fitway-green"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dashboard-bg text-dashboard-fg">
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Personal Training</h1>
          <p className="text-white/80">Treine com os melhores personal trainers do FITWAY</p>
        </div>

        {/* My Training Sessions */}
        {futureSessionsData.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-white mb-4">Minhas Próximas Sessões</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {futureSessionsData.map((session) => (
                <Card key={session.id_sessao_personal} className="bg-dashboard-card border-dashboard-border border-fitway-green/50">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-white text-lg">{session.instrutor?.nome || 'N/A'}</CardTitle>
                        <div className="flex items-center gap-1 mt-1">
                          <Star className="h-4 w-4 text-yellow-500 fill-current" />
                          <span className="text-white text-sm">★★★★★</span>
                        </div>
                      </div>
                      <Badge 
                        variant="outline" 
                        className="border-fitway-green text-fitway-green"
                      >
                        {session.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <span className="text-white/70 text-sm block mb-1">Data e horário:</span>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-fitway-green" />
                          <span className="text-white">
                            {formatDate(session.inicio)} às {formatTime(session.inicio)}
                          </span>
                        </div>
                      </div>

                      <div>
                        <span className="text-white/70 text-sm block mb-1">Duração:</span>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-fitway-green" />
                          <span className="text-white">
                            {Math.round((new Date(session.fim).getTime() - new Date(session.inicio).getTime()) / 60000)} minutos
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center pt-3 border-t border-dashboard-border">
                        <span className="text-fitway-green font-bold">
                          {formatCurrency(session.preco_total || 0)}
                        </span>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="border-red-500 text-red-500 hover:bg-red-500/10"
                          onClick={() => handleOpenCancelModal(session)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {futureSessionsData.length === 0 && (
          <div className="mb-8 p-4 bg-yellow-500/10 border border-yellow-500/50 rounded-lg flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
            <div>
              <p className="text-white font-semibold">Nenhuma sessão agendada</p>
              <p className="text-white/70 text-sm">Escolha um personal trainer abaixo para agendar sua próxima sessão</p>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="mb-6 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-white/50" />
            <Input
              placeholder="Buscar personal trainers por nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-dashboard-card border-dashboard-border text-white placeholder:text-white/50"
            />
          </div>
          <select
            value={selectedSpecialty}
            onChange={(e) => setSelectedSpecialty(e.target.value)}
            className="px-4 py-2 bg-dashboard-card border border-dashboard-border text-white rounded-md"
          >
            <option value="">Todas as especialidades</option>
            {Array.from(allSpecialties).map(spec => (
              <option key={spec} value={spec}>{spec}</option>
            ))}
          </select>
        </div>

        {/* Available Trainers */}
        <div>
          <h2 className="text-xl font-bold text-white mb-4">Personal Trainers Disponíveis</h2>
          {filteredInstructors.length === 0 ? (
            <Card className="bg-dashboard-card border-dashboard-border">
              <CardContent className="text-center py-12">
                <User className="h-16 w-16 text-white/50 mx-auto mb-4" />
                <h3 className="text-white text-lg font-medium mb-2">Nenhum personal trainer encontrado</h3>
                <p className="text-white/60">Tente ajustar seus filtros de busca</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredInstructors.map((instructor) => (
                <Card key={instructor.id_instrutor} className="bg-dashboard-card border-dashboard-border">
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className="w-16 h-16 bg-fitway-green/20 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="h-8 w-8 text-fitway-green" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-white text-lg">{instructor.nome}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 text-yellow-500 fill-current" />
                            <span className="text-white text-sm">★★★★★</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-fitway-green font-bold text-lg">
                          {formatCurrency(instructor.valor_hora || 0)}
                        </div>
                        <span className="text-white/60 text-sm">/hora</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {instructor.bio && (
                        <p className="text-white/80 text-sm">{instructor.bio}</p>
                      )}

                      <div>
                        <span className="text-white/70 text-sm block mb-2">Especialidades:</span>
                        <div className="flex flex-wrap gap-1">
                          {instructor.especialidades && instructor.especialidades.map((specialty, index) => (
                            <Badge 
                              key={index} 
                              variant="outline" 
                              className="text-xs border-fitway-green/50 text-fitway-green"
                            >
                              {specialty}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2 pt-4 border-t border-dashboard-border">
                        <Button 
                          className="flex-1 bg-fitway-green hover:bg-fitway-green/90 text-white"
                          onClick={() => handleSelectInstructor(instructor)}
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          Agendar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <Card className="bg-dashboard-card border-dashboard-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-dashboard-fg">Próximas Sessões</CardTitle>
              <Calendar className="h-4 w-4 text-fitway-green" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {futureSessionsData.length}
              </div>
              <p className="text-xs text-white/70">sessões agendadas</p>
            </CardContent>
          </Card>

          <Card className="bg-dashboard-card border-dashboard-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-dashboard-fg">Personal Trainers</CardTitle>
              <User className="h-4 w-4 text-fitway-green" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{availableInstructors.length}</div>
              <p className="text-xs text-white/70">profissionais disponíveis</p>
            </CardContent>
          </Card>

          <Card className="bg-dashboard-card border-dashboard-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-dashboard-fg">Preço Médio</CardTitle>
              <DollarSign className="h-4 w-4 text-fitway-green" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {formatCurrency(avgPrice)}
              </div>
              <p className="text-xs text-white/70">por hora</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal de Seleção de Data/Horário */}
      <Dialog open={scheduleModalOpen} onOpenChange={setScheduleModalOpen}>
        <DialogContent className="max-w-2xl bg-dashboard-card border-dashboard-border">
          <DialogHeader>
            <DialogTitle className="text-white">Agendar sessão com {selectedInstructor?.nome}</DialogTitle>
            <DialogDescription className="text-white/70">
              Selecione a data e horário desejado
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-white mb-2 block">Data</Label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  if (selectedInstructor) {
                    loadAvailableSlots(selectedInstructor, e.target.value);
                  }
                }}
                min={new Date().toISOString().split('T')[0]}
                className="bg-dashboard-card border-dashboard-border text-white"
              />
            </div>

            <div>
              <Label className="text-white mb-2 block">Horários Disponíveis</Label>
              {loadingSlots ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 text-fitway-green animate-spin" />
                  <span className="ml-2 text-white">Carregando horários...</span>
                </div>
              ) : (
                availableSlots.length > 0 ? (
                  <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot.time}
                        onClick={() => handleSelectSlot(slot)}
                        disabled={!slot.available}
                        className={`py-2 px-3 rounded text-sm font-medium transition ${
                          slot.available
                            ? 'bg-fitway-green/20 text-fitway-green hover:bg-fitway-green/30 cursor-pointer'
                            : 'bg-red-500/10 text-red-500/50 cursor-not-allowed'
                        } ${selectedSlot?.time === slot.time ? 'ring-2 ring-fitway-green' : ''}`}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-white/70 border border-dashed border-dashboard-border rounded-md">
                    Nenhum horário disponível para esta data. Escolha outra data ou tente mais tarde.
                  </div>
                )
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setScheduleModalOpen(false)}
              className="border-dashboard-border text-white"
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação com Cobrança */}
      <AlertDialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
        <AlertDialogContent className="bg-dashboard-card border-dashboard-border max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Confirmar Agendamento</AlertDialogTitle>
            <AlertDialogDescription className="text-white/70">
              Revise os detalhes da sua sessão
            </AlertDialogDescription>
          </AlertDialogHeader>

          {confirmationData && (
            <div className="bg-dashboard-bg/50 p-4 rounded-lg space-y-3">
              <div>
                <p className="text-white/70 text-sm">Personal Trainer</p>
                <p className="text-white font-semibold">{confirmationData.instructor.nome}</p>
              </div>
              <div>
                <p className="text-white/70 text-sm">Data e Horário</p>
                <p className="text-white font-semibold">
                  {formatDate(confirmationData.date)} às {confirmationData.time}
                </p>
              </div>
              <div className="border-t border-dashboard-border pt-3">
                <p className="text-white/70 text-sm">Valor a Cobrar</p>
                <p className="text-fitway-green font-bold text-2xl">
                  {formatCurrency(confirmationData.priceTotal || 0)}
                </p>
              </div>
              <p className="text-white/60 text-xs">
                A cobrança será gerada automaticamente após a confirmação
              </p>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel className="border-dashboard-border text-white hover:bg-dashboard-border">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmBooking}
              disabled={submitting}
              className="bg-fitway-green hover:bg-fitway-green/90 text-white"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Agendando...
                </>
              ) : (
                'Confirmar Agendamento'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Cancelamento de Sessão */}
      <AlertDialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <AlertDialogContent className="bg-dashboard-card border-dashboard-border max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-500">Cancelar Sessão</AlertDialogTitle>
            <AlertDialogDescription className="text-white/70">
              Tem certeza que deseja cancelar esta sessão?
            </AlertDialogDescription>
          </AlertDialogHeader>

          {sessionToCancel && (
            <div className="bg-dashboard-bg/50 p-4 rounded-lg space-y-3">
              <div>
                <p className="text-white/70 text-sm">Personal Trainer</p>
                <p className="text-white font-semibold">{sessionToCancel.instrutor?.nome || 'N/A'}</p>
              </div>
              <div>
                <p className="text-white/70 text-sm">Data e Horário</p>
                <p className="text-white font-semibold">
                  {formatDate(sessionToCancel.inicio)} às {formatTime(sessionToCancel.inicio)}
                </p>
              </div>
              <div className="border-t border-dashboard-border pt-3">
                <p className="text-white/70 text-sm">Valor a Reembolsar</p>
                <p className="text-fitway-green font-bold text-2xl">
                  {formatCurrency(sessionToCancel.preco_total || 0)}
                </p>
              </div>
              <p className="text-white/60 text-xs">
                ⚠️ A cobrança também será cancelada (se ainda não tiver sido paga)
              </p>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel className="border-dashboard-border text-white hover:bg-dashboard-border">
              Manter Sessão
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelSession}
              disabled={cancelling}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {cancelling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelando...
                </>
              ) : (
                'Sim, Cancelar'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StudentPersonal;