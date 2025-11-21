import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { MapPin, Calendar, Clock, Zap, Filter, Search, AlertCircle, Loader2 } from 'lucide-react';
import { courtsService } from '@/services/courts.service';
import { courtBookingsService } from '@/services/court-bookings.service';
import { formatCurrency, formatDate, formatTime, getErrorMessage } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import type { Court } from '@/types';
import { authService } from '@/services/auth.service';

 type CourtSlot = {
  time: string;
  available: boolean;
  price: number;
  motivo?: string;
};

const StudentCourts = () => {
  const [selectedCourt, setSelectedCourt] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSport, setSelectedSport] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [courts, setCourts] = useState<Court[]>([]);
  const [loadingCourts, setLoadingCourts] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);
  const [availability, setAvailability] = useState<Record<string, CourtSlot[]>>({});
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    court: Court | null;
    time: string;
    slot: CourtSlot | null;
  }>({
    open: false,
    court: null,
    time: '',
    slot: null,
  });

  useEffect(() => {
    const fetchCourts = async () => {
      try {
        setLoadingCourts(true);
        const response = await courtsService.getPublicCourts();
        setCourts(Array.isArray(response) ? response : []);
      } catch (error: any) {
        toast({
          title: 'Erro ao carregar quadras',
          description: getErrorMessage(error),
          variant: 'destructive',
        });
      } finally {
        setLoadingCourts(false);
      }
    };

    fetchCourts();
  }, []);

  const sports = useMemo(() => {
    // Coletar esportes existentes das quadras
    const values = courts.map(court => court.esporte).filter(Boolean);
    const set = new Set(values);
    // Remover esportes desativados do filtro
    ['tenis','futsal','basquete'].forEach(r => set.delete(r));
    // Garantir inclusão das novas modalidades
    set.add('futvolei');
    set.add('volei');
    return Array.from(set);
  }, [courts]);

  const minCourtPrice = useMemo(() => {
    const prices = courts
      .map(court => (typeof court.preco_hora === 'number' ? court.preco_hora : Number(court.preco_hora)))
      .filter(price => !Number.isNaN(price));
    return prices.length ? Math.min(...prices) : null;
  }, [courts]);

  const filteredCourts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return courts.filter((court) => {
      const matchesSearch = !normalizedSearch
        || court.nome?.toLowerCase().includes(normalizedSearch)
        || court.localizacao?.toLowerCase().includes(normalizedSearch);
      const matchesSport = selectedSport === 'all' || !selectedSport || court.esporte?.toLowerCase() === selectedSport.toLowerCase();
      return matchesSearch && matchesSport;
    });
  }, [courts, searchTerm, selectedSport]);

  const loadAvailabilityForCourt = async (court: Court, date: string): Promise<CourtSlot[]> => {
    const slots: CourtSlot[] = [];
    // ✨ NOVO: Usar endpoint otimizado que retorna TODOS os slots de uma vez
    try {
      setLoadingSlots(true);
      const response = await courtBookingsService.getAvailableSlots(
        court.id_quadra,
        date
      );

      const slots = response.data.slots.map(slot => ({
        time: slot.hora,
        available: slot.disponivel,
        price: slot.preco,
        motivo: slot.disponivel ? undefined : 'Indisponível',
      }));

      return slots;
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar horários',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      return [];
    } finally {
      setLoadingSlots(false);
    }
  };

  useEffect(() => {
    if (!selectedCourt || !selectedDate) return;
    const court = courts.find(c => String(c.id_quadra) === selectedCourt);
    if (!court) return;

    let active = true;
    setLoadingSlots(true);

    loadAvailabilityForCourt(court, selectedDate)
      .then((slots) => {
        if (!active) return;
        setAvailability(prev => ({ ...prev, [String(court.id_quadra)]: slots }));
      })
      .catch((error: any) => {
        toast({
          title: 'Erro ao carregar horarios',
          description: getErrorMessage(error),
          variant: 'destructive',
        });
      })
      .finally(() => {
        if (active) {
          setLoadingSlots(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedCourt, selectedDate, courts]);

  const handleSelectTime = (court: Court, slot: CourtSlot) => {
    setConfirmDialog({
      open: true,
      court,
      time: slot.time,
      slot,
    });
  };

  const handleConfirmBooking = async () => {
    const { court, time, slot } = confirmDialog;
    if (!court || !slot) return;

    try {
      setBooking(true);
        // Backend exige formato exato: Y-m-dTH:i:s (sem milissegundos / timezone)
        const inicio = `${selectedDate}T${time}:00`;
        // Calcular fim adicionando 60 minutos
        const startDateObj = new Date(`${selectedDate}T${time}:00`);
        startDateObj.setMinutes(startDateObj.getMinutes() + 60);
        const pad = (n: number) => String(n).padStart(2, '0');
        const fim = `${startDateObj.getFullYear()}-${pad(startDateObj.getMonth() + 1)}-${pad(startDateObj.getDate())}T${pad(startDateObj.getHours())}:${pad(startDateObj.getMinutes())}:${pad(startDateObj.getSeconds())}`;
        const currentUser = await authService.getCurrentUser();
        await courtBookingsService.create({
          id_quadra: Number(court.id_quadra),
          id_usuario: Number(currentUser.id),
          inicio,
          fim,
        });

      toast({
        title: 'Reserva confirmada!',
        description: `Quadra: ${court.nome}\nHorario: ${time}\nValor: ${formatCurrency(slot.price)}`,
      });

      setConfirmDialog({ open: false, court: null, time: '', slot: null });

      loadAvailabilityForCourt(court, selectedDate).then((slots) => {
        setAvailability(prev => ({ ...prev, [String(court.id_quadra)]: slots }));
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao reservar',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setBooking(false);
    }
  };

  return (
    <div className="min-h-screen bg-dashboard-bg text-dashboard-fg">
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Reservar Quadras</h1>
          <p className="text-white/80">Escolha uma quadra e horario para a sua proxima partida</p>
        </div>

        <Card className="mb-6 bg-dashboard-card border-dashboard-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Filter className="h-5 w-5 text-fitway-green" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label className="text-white">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-white/50" />
                  <Input
                    placeholder="Nome ou localizacao"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="pl-10 bg-dashboard-card border-dashboard-border text-white placeholder:text-white/50"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-white">Esporte</Label>
                <Select value={selectedSport} onValueChange={setSelectedSport}>
                  <SelectTrigger className="bg-dashboard-card border-dashboard-border text-white">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="bg-dashboard-card border-dashboard-border text-white">
                    <SelectItem value="all">Todos</SelectItem>
                    {sports.map(sport => (
                      <SelectItem key={sport} value={sport}>
                        {sport}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-white">Data</Label>
                <Input
                  type="date"
                  className="bg-dashboard-card border-dashboard-border text-white"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
          <div className="space-y-4">
            {loadingCourts ? (
              <Card className="bg-dashboard-card border-dashboard-border">
                <CardContent className="py-12 flex items-center justify-center gap-2 text-white/70">
                  <Loader2 className="h-5 w-5 animate-spin" /> Carregando quadras...
                </CardContent>
              </Card>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {filteredCourts.map((court) => (
                  <Card key={court.id_quadra} className="bg-dashboard-card border-dashboard-border">
                    <CardHeader>
                      <CardTitle className="text-white text-lg flex items-start justify-between">
                        <span>{court.nome}</span>
                        {court.esporte && (
                          <Badge className="bg-fitway-green/20 text-fitway-green">{court.esporte}</Badge>
                        )}
                      </CardTitle>
                      <p className="text-white/60 flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4" />
                        {court.localizacao || 'Localizacao nao informada'}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-white/70 text-sm space-y-1">
                        <p>Valor: <span className="text-fitway-green font-semibold">{formatCurrency(court.preco_hora || 0)}</span>/hora</p>
                        <p>Reservas futuras disponiveis</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {Array.isArray(court.caracteristicas_json)
                          ? court.caracteristicas_json.map((feature: string) => (
                              <span key={feature} className="text-xs bg-white/10 px-2 py-1 rounded text-white/70">
                                {feature}
                              </span>
                            ))
                          : null}
                      </div>
                      <Button
                        variant="sport"
                        className="w-full"
                        onClick={() => setSelectedCourt(String(court.id_quadra))}
                      >
                        {String(court.id_quadra) === selectedCourt ? 'Quadra selecionada' : 'Selecionar quadra'}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                {!filteredCourts.length && (
                  <Card className="bg-dashboard-card border-dashboard-border">
                    <CardContent className="py-12 text-white/70 text-center">
                      Nenhuma quadra encontrada com os filtros selecionados.
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <Card className="bg-dashboard-card border-dashboard-border sticky top-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Calendar className="h-5 w-5 text-fitway-green" /> Horarios disponiveis
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedCourt ? (
                  loadingSlots ? (
                    <div className="py-12 flex items-center justify-center gap-2 text-white/70">
                      <Loader2 className="h-5 w-5 animate-spin" /> Carregando horarios...
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {availability[selectedCourt]?.map((slot) => (
                        <div
                          key={slot.time}
                          className={`flex items-center justify-between p-3 rounded-md border ${
                            slot.available
                              ? 'border-fitway-green/30 hover:border-fitway-green/60 cursor-pointer'
                              : 'border-red-500/30 bg-red-500/10 cursor-not-allowed'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Clock className="h-4 w-4 text-fitway-green" />
                            <span className="text-white font-medium">{slot.time}</span>
                          </div>
                          <div className="text-right max-w-[160px]">
                            {slot.available ? (
                              <Button
                                variant="sport"
                                size="sm"
                                onClick={() => {
                                  const court = courts.find(c => String(c.id_quadra) === selectedCourt);
                                  if (court) handleSelectTime(court, slot);
                                }}
                              >
                                {formatCurrency(slot.price)}
                              </Button>
                            ) : (
                              <span className="text-xs text-red-400 block text-left">
                                {slot.motivo || 'Horario indisponivel'}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {!availability[selectedCourt]?.length && (
                        <p className="text-white/70 text-sm">Selecione uma data para carregar os horarios.</p>
                      )}
                    </div>
                  )
                ) : (
                  <div className="py-12 text-center text-white/70">
                    Selecione uma quadra para visualizar os horarios.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-dashboard-card border-dashboard-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Zap className="h-5 w-5 text-fitway-green" /> Beneficios do aluno
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm text-white/80">
                  <li>&bull; Valores a partir de <strong>{minCourtPrice !== null ? `${formatCurrency(minCourtPrice)}/hora` : '--'}</strong></li>
                  <li>&bull; Cancelamento sem multa ate 2h antes</li>
                  <li>&bull; Reservas com ate 30 dias de antecedencia</li>
                  <li>&bull; Suporte prioritario</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmDialog({ open: false, court: null, time: '', slot: null });
          }
        }}
      >
        <AlertDialogContent className="bg-dashboard-card border-dashboard-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-400" />
              Confirmar reserva
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/70">
              Ao confirmar, uma cobranca sera criada automaticamente na sua conta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirmDialog.court && confirmDialog.slot && (
            <div className="space-y-3 text-white">
              <div>
                <p className="font-semibold text-lg">{confirmDialog.court.nome}</p>
                <p className="text-sm text-white/70">{confirmDialog.court.localizacao}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm text-white/70">
                <div>
                  <p>Data</p>
                  <p className="text-white">{formatDate(`${selectedDate}T00:00:00`)}</p>
                </div>
                <div>
                  <p>Horario</p>
                  <p className="text-white">{confirmDialog.time}</p>
                </div>
              </div>
              <div className="flex justify-between text-sm text-white/70 border-t border-dashboard-border pt-2">
                <span>Valor da reserva</span>
                <span className="text-fitway-green font-semibold">{formatCurrency(confirmDialog.slot.price)}</span>
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={booking}>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmBooking} disabled={booking}>
              {booking ? 'Confirmando...' : 'Confirmar e gerar cobranca'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StudentCourts;

