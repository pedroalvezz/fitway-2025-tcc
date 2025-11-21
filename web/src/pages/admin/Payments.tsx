import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { paymentsService } from '@/services/payments.service';
import type { Cobranca, AdminPaymentFilters } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { usersService } from '@/services/users.service';
import type { AdminUser } from '@/types';
import { formatCurrency, formatDate, parseCurrency } from '@/lib/utils';
import { Loader2, Receipt, Search, Clock, CheckCircle, XCircle, AlertCircle, Plus, Pencil, Trash2, Link as LinkIcon, Check as CheckIcon } from 'lucide-react';
import { debounce } from '@/lib/utils';

export default function AdminPaymentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<AdminPaymentFilters>({
    status: 'all',
    tipo: 'all',
    search: '',
    page: 1,
    per_page: 50,
  });
  const [pagination, setPagination] = useState({
    total: 0,
    current_page: 1,
    last_page: 1,
  });
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    id_usuario: '',
    referencia_tipo: 'manual' as 'manual' | 'assinatura' | 'reserva_quadra' | 'sessao_personal' | 'inscricao_aula',
    referencia_id: '',
    descricao: '',
    valor_total: '',
    vencimento: new Date().toISOString().split('T')[0],
    observacoes: '',
  });
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    descricao: '',
    valor_total: '',
    vencimento: '',
    status: 'pendente' as Cobranca['status'],
    observacoes: '',
  });

  useEffect(() => {
    if (user?.role !== 'admin') {
      navigate('/');
      return;
    }
    loadPayments();
  }, [filters.status, filters.tipo, filters.page]);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const response = await paymentsService.listAll(filters);
      setCobrancas(response.data);
      setPagination({
        total: response.total,
        current_page: response.current_page,
        last_page: response.last_page,
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar pagamentos',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Debounce search
  const handleSearch = debounce((value: string) => {
    setFilters({ ...filters, search: value, page: 1 });
    loadPayments();
  }, 500);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'destructive' | 'outline' | 'secondary'; icon: any }> = {
      pendente: { variant: 'outline', icon: Clock },
      parcialmente_pago: { variant: 'secondary', icon: AlertCircle },
      pago: { variant: 'default', icon: CheckCircle },
      cancelado: { variant: 'destructive', icon: XCircle },
      estornado: { variant: 'destructive', icon: XCircle },
    };

    const config = variants[status] || variants.pendente;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {status === 'parcialmente_pago' ? 'Parc. Pago' : status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getTipoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      assinatura: 'Assinatura',
      reserva_quadra: 'Reserva',
      sessao_personal: 'Personal',
      inscricao_aula: 'Aula',
    };
    return labels[tipo] || tipo;
  };

  // Carregar lista de usuários (admin) para o Select do modal
  useEffect(() => {
    if (!showCreate) return;
    const run = async () => {
      setLoadingUsers(true);
      try {
        const resp = await usersService.listUsers({ search: userSearch, page: 1 });
        setUsers(resp.data);
      } catch (e) {
        // silencioso; toast não é crítico aqui
      } finally {
        setLoadingUsers(false);
      }
    };
    const deb = setTimeout(run, 400);
    return () => clearTimeout(deb);
  }, [showCreate, userSearch]);

  const openEdit = (c: Cobranca) => {
    setEditingId(String(c.id_cobranca));
    setEditForm({
      descricao: c.descricao || '',
      valor_total: String(c.valor_total ?? ''),
      vencimento: c.vencimento?.slice(0,10) || new Date().toISOString().split('T')[0],
      status: c.status,
      observacoes: c.observacoes || '',
    });
  };

  const handleCreate = async () => {
    if (!createForm.id_usuario || !createForm.descricao || !createForm.valor_total) {
      toast({ title: 'Campos obrigatórios', description: 'Selecione usuário, informe descrição e valor', variant: 'destructive' });
      return;
    }
    if (createForm.referencia_tipo !== 'manual' && !createForm.referencia_id) {
      toast({ title: 'Referência obrigatória', description: 'Informe a referência para este tipo', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      await paymentsService.createCharge({
        id_usuario: String(createForm.id_usuario),
        referencia_tipo: createForm.referencia_tipo,
        referencia_id: createForm.referencia_id ? String(createForm.referencia_id) : undefined,
        valor_total: createForm.valor_total ? parseCurrency(createForm.valor_total) : 0,
        descricao: createForm.descricao,
        vencimento: createForm.vencimento,
        observacoes: createForm.observacoes || undefined,
      });
      toast({ title: 'Cobrança criada com sucesso' });
      setShowCreate(false);
      setCreateForm({
        id_usuario: '', referencia_tipo: 'manual', referencia_id: '', descricao: '', valor_total: '',
        vencimento: new Date().toISOString().split('T')[0], observacoes: ''
      });
      loadPayments();
    } catch (error: any) {
      toast({ title: 'Erro ao criar', description: error.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    setEditing(true);
    try {
      const payload: any = {
        descricao: editForm.descricao,
        observacoes: editForm.observacoes || undefined,
      };
      if (editForm.valor_total) payload.valor_total = parseCurrency(editForm.valor_total);
      if (editForm.vencimento) payload.vencimento = editForm.vencimento;
      if (editForm.status) payload.status = editForm.status;

      await paymentsService.updateCharge(editingId, payload);
      toast({ title: 'Cobrança atualizada' });
      setEditingId(null);
      loadPayments();
    } catch (error: any) {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    } finally {
      setEditing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Cancelar esta cobrança?')) return;
    try {
      await paymentsService.deleteCharge(id);
      toast({ title: 'Cobrança cancelada' });
      loadPayments();
    } catch (error: any) {
      toast({ title: 'Erro ao cancelar', description: error.message, variant: 'destructive' });
    }
  };

  const handleGenerateLink = async (idCobranca: string) => {
    try {
      const res = await paymentsService.adminCreateCheckoutLink(String(idCobranca));
      if (res.url_checkout) {
        window.open(res.url_checkout, '_blank');
        toast({ title: 'Link gerado', description: 'Abrindo checkout do Mercado Pago...' });
      }
    } catch (error: any) {
      toast({ title: 'Erro ao gerar link', description: error.message, variant: 'destructive' });
    }
  };

  const handleMarkAsPaid = async (idCobranca: string) => {
    try {
      await paymentsService.adminMarkAsPaid(String(idCobranca));
      toast({ title: 'Cobrança marcada como paga' });
      loadPayments();
    } catch (error: any) {
      toast({ title: 'Erro ao marcar como paga', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Pagamentos</h1>
          <p className="text-muted-foreground">Gerenciar todas as cobranças do sistema</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-2" /> Nova Cobrança
          </Button>
          <Receipt className="w-8 h-8 text-muted-foreground" />
        </div>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Nome, email, descrição ou referência..."
                  className="pl-10"
                  onChange={(e) => handleSearch(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select
                value={filters.status || 'all'}
                onValueChange={(value) => setFilters({ ...filters, status: value === 'all' ? 'all' : value as any, page: 1 })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="parcialmente_pago">Parcialmente Pago</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                  <SelectItem value="estornado">Estornado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Tipo</label>
              <Select
                value={filters.tipo || 'all'}
                onValueChange={(value) => setFilters({ ...filters, tipo: value === 'all' ? 'all' : value as any, page: 1 })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="assinatura">Assinatura</SelectItem>
                  <SelectItem value="reserva_quadra">Reserva</SelectItem>
                  <SelectItem value="sessao_personal">Personal</SelectItem>
                  <SelectItem value="inscricao_aula">Aula</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estatísticas Rápidas */}
      {(() => {
        const toNumber = (v: any): number => {
          if (typeof v === 'number') return v;
          if (typeof v === 'string') {
            // suporta "150.00" ou "150,00" e remove símbolo
            const cleaned = v.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
            const n = parseFloat(cleaned);
            return isNaN(n) ? 0 : n;
          }
          return 0;
        };

        const totalRecebido = cobrancas.reduce((sum, c) => {
          if (c.status === 'pago') {
            const pago = toNumber(c.valor_pago);
            const total = toNumber(c.valor_total);
            return sum + (pago > 0 ? pago : total);
          }
          if (c.status === 'parcialmente_pago') {
            return sum + toNumber(c.valor_pago);
          }
          return sum;
        }, 0);
        return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{pagination.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{cobrancas.filter(c => c.status === 'pendente').length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pagos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{cobrancas.filter(c => c.status === 'pago').length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Recebido</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalRecebido)}</p>
          </CardContent>
        </Card>
      </div>
        );
      })()}

      {/* Loading */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Lista de Cobranças */}
          <div className="space-y-4">
            {cobrancas.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Receipt className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Nenhuma cobrança encontrada</p>
                </CardContent>
              </Card>
            ) : (
              cobrancas.map((cobranca) => (
                <Card key={cobranca.id_cobranca} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline">{getTipoLabel(cobranca.referencia_tipo)}</Badge>
                          {getStatusBadge(cobranca.status)}
                        </div>
                        <CardTitle className="text-lg">{cobranca.descricao}</CardTitle>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                          <span>{cobranca.usuario?.nome || 'Usuário desconhecido'}</span>
                          <span>•</span>
                          <span>Vencimento: {formatDate(cobranca.vencimento)}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">{formatCurrency(cobranca.valor_total)}</p>
                        {cobranca.valor_pago > 0 && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Pago: {formatCurrency(cobranca.valor_pago)}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-3 justify-end">
                          {(cobranca.status === 'pendente' || cobranca.status === 'parcialmente_pago') && (
                            <>
                              <Button variant="secondary" size="sm" onClick={() => handleGenerateLink(String(cobranca.id_cobranca))}>
                                <LinkIcon className="w-4 h-4 mr-1" /> Gerar Link
                              </Button>
                              <Button variant="default" size="sm" onClick={() => handleMarkAsPaid(String(cobranca.id_cobranca))}>
                                <CheckIcon className="w-4 h-4 mr-1" /> Marcar como Pago
                              </Button>
                            </>
                          )}
                          <Button variant="outline" size="sm" onClick={() => openEdit(cobranca)}>
                            <Pencil className="w-4 h-4 mr-1" /> Editar
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDelete(String(cobranca.id_cobranca))} disabled={cobranca.status === 'pago'}>
                            <Trash2 className="w-4 h-4 mr-1" /> Excluir
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))
            )}
          </div>

          {/* Paginação */}
          {pagination.last_page > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                disabled={pagination.current_page === 1}
                onClick={() => setFilters({ ...filters, page: pagination.current_page - 1 })}
              >
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {pagination.current_page} de {pagination.last_page}
              </span>
              <Button
                variant="outline"
                disabled={pagination.current_page === pagination.last_page}
                onClick={() => setFilters({ ...filters, page: pagination.current_page + 1 })}
              >
                Próxima
              </Button>
            </div>
          )}
        </>
      )}

      {/* Modal: Nova Cobrança */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Cobrança</DialogTitle>
            <DialogDescription>Preencha os dados para criar uma nova cobrança</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="md:col-span-2 space-y-2">
              <Label>Usuário</Label>
              <Input
                placeholder="Buscar por nome ou email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
              <Select
                value={createForm.id_usuario || ''}
                onValueChange={(v) => setCreateForm({ ...createForm, id_usuario: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={loadingUsers ? 'Carregando usuários...' : 'Selecione um usuário'} />
                </SelectTrigger>
                <SelectContent>
                  {users.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">Nenhum usuário encontrado</div>
                  ) : (
                    users.map((u) => (
                      <SelectItem key={u.id_usuario} value={String(u.id_usuario)}>
                        {u.nome} <span className="text-muted-foreground">({u.email})</span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={createForm.referencia_tipo}
                onValueChange={(v) => setCreateForm({ ...createForm, referencia_tipo: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="assinatura">Assinatura</SelectItem>
                  <SelectItem value="reserva_quadra">Reserva de Quadra</SelectItem>
                  <SelectItem value="sessao_personal">Sessão Personal</SelectItem>
                  <SelectItem value="inscricao_aula">Aula</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Referência ID</Label>
              <Input placeholder="opcional p/ manual" value={createForm.referencia_id}
                onChange={(e) => setCreateForm({ ...createForm, referencia_id: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>Descrição</Label>
              <Input placeholder="Ex: Mensalidade Outubro" value={createForm.descricao}
                onChange={(e) => setCreateForm({ ...createForm, descricao: e.target.value })} />
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input
                placeholder="R$ 150,00"
                value={createForm.valor_total}
                onChange={(e) => {
                  const raw = e.target.value;
                  const digits = raw.replace(/\D/g, '');
                  if (!digits) {
                    setCreateForm({ ...createForm, valor_total: '' });
                    return;
                  }
                  const cents = parseInt(digits, 10);
                  const value = (cents / 100).toFixed(2);
                  const formatted = 'R$ ' + value.replace('.', ',');
                  setCreateForm({ ...createForm, valor_total: formatted });
                }}
              />
            </div>
            <div>
              <Label>Vencimento</Label>
              <Input type="date" value={createForm.vencimento}
                onChange={(e) => setCreateForm({ ...createForm, vencimento: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>Observações</Label>
              <Textarea placeholder="Opcional" value={createForm.observacoes}
                onChange={(e) => setCreateForm({ ...createForm, observacoes: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Button className="w-full" onClick={handleCreate} disabled={creating}>
                {creating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/>Criando...</> : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Editar Cobrança */}
      <Dialog open={!!editingId} onOpenChange={(open) => !open && setEditingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Cobrança</DialogTitle>
            <DialogDescription>Atualize os dados da cobrança selecionada</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="md:col-span-2">
              <Label>Descrição</Label>
              <Input value={editForm.descricao}
                onChange={(e) => setEditForm({ ...editForm, descricao: e.target.value })} />
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input
                placeholder="R$ 150,00"
                value={editForm.valor_total}
                onChange={(e) => {
                  const raw = e.target.value;
                  const digits = raw.replace(/\D/g, '');
                  if (!digits) {
                    setEditForm({ ...editForm, valor_total: '' });
                    return;
                  }
                  const cents = parseInt(digits, 10);
                  const value = (cents / 100).toFixed(2);
                  const formatted = 'R$ ' + value.replace('.', ',');
                  setEditForm({ ...editForm, valor_total: formatted });
                }}
              />
            </div>
            <div>
              <Label>Vencimento</Label>
              <Input type="date" value={editForm.vencimento}
                onChange={(e) => setEditForm({ ...editForm, vencimento: e.target.value })} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={editForm.status}
                onValueChange={(v) => setEditForm({ ...editForm, status: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="parcialmente_pago">Parcialmente Pago</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                  <SelectItem value="estornado">Estornado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Observações</Label>
              <Textarea value={editForm.observacoes}
                onChange={(e) => setEditForm({ ...editForm, observacoes: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Button className="w-full" onClick={handleUpdate} disabled={editing}>
                {editing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/>Salvando...</> : 'Salvar alterações'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

