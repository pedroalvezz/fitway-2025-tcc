import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { courtsService } from '@/services/courts.service';
import { Court, CourtFormData } from '@/types';
import { formatCurrency, formatDate, getErrorMessage, maskCurrency, parseCurrency, sanitizeNameInput } from '@/lib/utils';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2,
  MapPin,
  Activity,
  DollarSign,
  Loader2,
  CheckCircle,
  XCircle
} from 'lucide-react';

// Lista de esportes disponível para criação/edição de quadras (removidos: tênis, futsal, basquete)
const ESPORTES = [
  { value: 'beach_tennis', label: 'Beach Tennis' },
  { value: 'futvolei', label: 'FutVôlei' },
  { value: 'volei', label: 'Vôlei' },
  { value: 'outros', label: 'Outros' },
];

const AdminCourts = () => {
  const { toast } = useToast();
  
  // State
  const [courts, setCourts] = useState<Court[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEsporte, setFilterEsporte] = useState<string | undefined>(undefined);
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  
  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [courtToDelete, setCourtToDelete] = useState<Court | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState<CourtFormData>({
    nome: '',
    localizacao: '',
    esporte: 'beach_tennis',
    preco_hora: 0,
    caracteristicas_json: {},
    status: 'ativa',
  });
  const [priceInput, setPriceInput] = useState('');

  const handleNameChange = (value: string) => {
    setFormData(prev => ({ ...prev, nome: sanitizeNameInput(value) }));
  };

  const handlePriceInputChange = (value: string) => {
    const masked = maskCurrency(value);
    setPriceInput(masked);
    setFormData(prev => ({ ...prev, preco_hora: parseCurrency(masked) }));
  };

  // Load courts
  useEffect(() => {
    loadCourts();
  }, [filterEsporte, filterStatus]);

  const loadCourts = async () => {
    try {
      setLoading(true);
      const response = await courtsService.getAdminCourts({
        esporte: filterEsporte || undefined,
        status: (filterStatus as 'ativa' | 'inativa') || undefined,
        search: searchTerm || undefined,
      });
      setCourts(response.data);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar quadras',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadCourts();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await courtsService.createCourt(formData);
      toast({
        title: 'Quadra criada!',
        description: `${formData.nome} foi criada com sucesso.`,
      });
      setIsCreateModalOpen(false);
      resetForm();
      loadCourts();
    } catch (error: any) {
      toast({
        title: 'Erro ao criar quadra',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourt) return;
    
    try {
      setSubmitting(true);
      await courtsService.updateCourt(selectedCourt.id_quadra, formData);
      toast({
        title: 'Quadra atualizada!',
        description: `${formData.nome} foi atualizada com sucesso.`,
      });
      setIsEditModalOpen(false);
      setSelectedCourt(null);
      resetForm();
      loadCourts();
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar quadra',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!courtToDelete) return;
    
    try {
      setSubmitting(true);
      await courtsService.deleteCourt(courtToDelete.id_quadra);
      toast({
        title: 'Quadra removida!',
        description: `${courtToDelete.nome} foi removida com sucesso.`,
      });
      setDeleteDialogOpen(false);
      setCourtToDelete(null);
      loadCourts();
    } catch (error: any) {
      toast({
        title: 'Erro ao remover quadra',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (court: Court) => {
    const newStatus = court.status === 'ativa' ? 'inativa' : 'ativa';
    try {
      await courtsService.updateCourtStatus(court.id_quadra, newStatus);
      toast({
        title: 'Status atualizado!',
        description: `${court.nome} está agora ${newStatus}.`,
      });
      loadCourts();
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar status',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const openEditModal = (court: Court) => {
    setSelectedCourt(court);
    setFormData({
      nome: court.nome,
      localizacao: court.localizacao || '',
      esporte: court.esporte,
      preco_hora: court.preco_hora,
      caracteristicas_json: court.caracteristicas_json || {},
      status: court.status,
    });
    setPriceInput(formatCurrency(court.preco_hora));
    setIsEditModalOpen(true);
  };

  const openDeleteDialog = (court: Court) => {
    setCourtToDelete(court);
    setDeleteDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      localizacao: '',
      esporte: 'beach_tennis',
      preco_hora: 0,
      caracteristicas_json: {},
      status: 'ativa',
    });
    setPriceInput('');
  };

  const filteredCourts = courts.filter(court =>
    court.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeCount = courts.filter(c => c.status === 'ativa').length;
  const totalRevenue = courts.reduce((sum, c) => sum + parseFloat(c.preco_hora.toString()), 0);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Gestão de Quadras</h1>
          <p className="text-white/80">Gerencie as quadras esportivas do FITWAY</p>
        </div>
        <Button 
          className="bg-fitway-green hover:bg-fitway-green/90 text-white"
          onClick={() => { resetForm(); setIsCreateModalOpen(true); }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nova Quadra
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-white">Total de Quadras</CardTitle>
            <Activity className="h-4 w-4 text-fitway-green" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{courts.length}</div>
            <p className="text-xs text-white/60 mt-1">{activeCount} ativas</p>
          </CardContent>
        </Card>

        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-white">Receita Potencial/Hora</CardTitle>
            <DollarSign className="h-4 w-4 text-fitway-green" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {formatCurrency(totalRevenue)}
            </div>
            <p className="text-xs text-white/60 mt-1">Todas as quadras ativas</p>
          </CardContent>
        </Card>

        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-white">Esportes</CardTitle>
            <MapPin className="h-4 w-4 text-fitway-green" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {[...new Set(courts.map(c => c.esporte))].length}
            </div>
            <p className="text-xs text-white/60 mt-1">Modalidades disponíveis</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-white/10 backdrop-blur-sm border-white/20 mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-white/40" />
                <Input
                  placeholder="Buscar por nome..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10 bg-white/5 border-white/20 text-white placeholder:text-white/40"
                />
              </div>
            </div>
            <Select value={filterEsporte ?? 'all'} onValueChange={(value) => setFilterEsporte(value === 'all' ? undefined : value)}>
              <SelectTrigger className="bg-white/5 border-white/20 text-white">
                <SelectValue placeholder="Todos os esportes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os esportes</SelectItem>
                {ESPORTES.map(e => (
                  <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus ?? 'all'} onValueChange={(value) => setFilterStatus(value === 'all' ? undefined : value)}>
              <SelectTrigger className="bg-white/5 border-white/20 text-white">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="ativa">Ativas</SelectItem>
                <SelectItem value="inativa">Inativas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Courts List */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-fitway-green" />
        </div>
      ) : filteredCourts.length === 0 ? (
        <Card className="bg-white/10 backdrop-blur-sm border-white/20">
          <CardContent className="py-12 text-center">
            <p className="text-white/60">Nenhuma quadra encontrada</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCourts.map((court) => (
            <Card key={court.id_quadra} className="bg-white/10 backdrop-blur-sm border-white/20 hover:bg-white/15 transition-colors">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="text-white text-lg">{court.nome}</CardTitle>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant={court.status === 'ativa' ? 'default' : 'secondary'} className="bg-fitway-green/20 text-fitway-green hover:bg-fitway-green/30">
                        {court.status === 'ativa' ? (
                          <><CheckCircle className="h-3 w-3 mr-1" /> Ativa</>
                        ) : (
                          <><XCircle className="h-3 w-3 mr-1" /> Inativa</>
                        )}
                      </Badge>
                      <Badge variant="outline" className="border-white/20 text-white">
                        {ESPORTES.find(e => e.value === court.esporte)?.label || court.esporte}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-white/80">
                  <MapPin className="h-4 w-4 text-fitway-green" />
                  <span className="text-sm">{court.localizacao || 'Sem localização'}</span>
                </div>
                <div className="flex items-center gap-2 text-white/80">
                  <DollarSign className="h-4 w-4 text-fitway-green" />
                  <span className="text-sm font-semibold">{formatCurrency(court.preco_hora)}/hora</span>
                </div>
                
                <div className="flex gap-2 pt-4">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 border-white/20 text-white hover:bg-white/10"
                    onClick={() => openEditModal(court)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className={`border-white/20 ${
                      court.status === 'ativa' 
                        ? 'text-orange-400 hover:bg-orange-400/10' 
                        : 'text-green-400 hover:bg-green-400/10'
                    }`}
                    onClick={() => handleToggleStatus(court)}
                  >
                    {court.status === 'ativa' ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-500/20 text-red-400 hover:bg-red-500/10"
                    onClick={() => openDeleteDialog(court)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="bg-gray-900 border-white/20 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova Quadra</DialogTitle>
            <DialogDescription className="text-white/60">
              Preencha os dados da nova quadra
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nome">Nome *</Label>
                  <Input
                    id="nome"
                    value={formData.nome}
                    onChange={(e) => handleNameChange(e.target.value)}
                    maxLength={80}
                    className="bg-white/5 border-white/20 text-white"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="localizacao">Localização</Label>
                  <Input
                    id="localizacao"
                    value={formData.localizacao}
                    onChange={(e) => setFormData({ ...formData, localizacao: e.target.value })}
                    className="bg-white/5 border-white/20 text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="esporte">Esporte *</Label>
                  <Select value={formData.esporte} onValueChange={(value) => setFormData({ ...formData, esporte: value })}>
                    <SelectTrigger className="bg-white/5 border-white/20 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ESPORTES.map(e => (
                        <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="preco_hora">Preço/Hora (R$) *</Label>
                                    <Input
                    id="preco_hora"
                    type="text"
                    inputMode="numeric"
                    placeholder="R$ 0,00"
                    value={priceInput}
                    onChange={(e) => handlePriceInputChange(e.target.value)}
                    className="bg-white/5 border-white/20 text-white"
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value: 'ativa' | 'inativa') => setFormData({ ...formData, status: value })}>
                  <SelectTrigger className="bg-white/5 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativa">Ativa</SelectItem>
                    <SelectItem value="inativa">Inativa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => { setIsCreateModalOpen(false); resetForm(); }}
                className="border-white/20 text-white hover:bg-white/10"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                className="bg-fitway-green hover:bg-fitway-green/90"
                disabled={submitting}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar Quadra
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="bg-gray-900 border-white/20 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar Quadra</DialogTitle>
            <DialogDescription className="text-white/60">
              Atualize os dados da quadra
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-nome">Nome *</Label>
                  <Input
                    id="edit-nome"
                    value={formData.nome}
                    onChange={(e) => handleNameChange(e.target.value)}
                    maxLength={80}
                    className="bg-white/5 border-white/20 text-white"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-localizacao">Localização</Label>
                  <Input
                    id="edit-localizacao"
                    value={formData.localizacao}
                    onChange={(e) => setFormData({ ...formData, localizacao: e.target.value })}
                    className="bg-white/5 border-white/20 text-white"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-esporte">Esporte *</Label>
                  <Select value={formData.esporte} onValueChange={(value) => setFormData({ ...formData, esporte: value })}>
                    <SelectTrigger className="bg-white/5 border-white/20 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ESPORTES.map(e => (
                        <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-preco_hora">Preço/Hora (R$) *</Label>
                                    <Input
                    id="edit-preco_hora"
                    type="text"
                    inputMode="numeric"
                    placeholder="R$ 0,00"
                    value={priceInput}
                    onChange={(e) => handlePriceInputChange(e.target.value)}
                    className="bg-white/5 border-white/20 text-white"
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-status">Status</Label>
                <Select value={formData.status} onValueChange={(value: 'ativa' | 'inativa') => setFormData({ ...formData, status: value })}>
                  <SelectTrigger className="bg-white/5 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativa">Ativa</SelectItem>
                    <SelectItem value="inativa">Inativa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => { setIsEditModalOpen(false); setSelectedCourt(null); resetForm(); }}
                className="border-white/20 text-white hover:bg-white/10"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                className="bg-fitway-green hover:bg-fitway-green/90"
                disabled={submitting}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-gray-900 border-white/20 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/60">
              Esta ação não pode ser desfeita. A quadra <strong>{courtToDelete?.nome}</strong> será permanentemente removida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/20 text-white hover:bg-white/10">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-red-500 hover:bg-red-600"
              disabled={submitting}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminCourts;
