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
import { usersService } from '@/services/users.service';
import { AdminUser, UserFormData } from '@/types';
import { formatCPF, formatPhone, formatDate, getErrorMessage, maskCPF, maskPhone, sanitizeNameInput, stripNonDigits, isValidEmail } from '@/lib/utils';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2,
  Loader2,
  CheckCircle,
  XCircle,
  User as UserIcon,
  Mail,
  Phone,
  Calendar,
  Shield
} from 'lucide-react';

const PAPEL_OPTIONS = [
  { value: 'aluno', label: 'Aluno' },
  { value: 'personal', label: 'Personal Trainer' },
  { value: 'instrutor', label: 'Instrutor' },
  { value: 'admin', label: 'Administrador' },
];

const AdminUsers = () => {
  const { toast } = useToast();
  
  // State
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPapel, setFilterPapel] = useState<string | undefined>(undefined);
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  
  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState<UserFormData>({
    nome: '',
    email: '',
    senha: '',
    telefone: '',
    documento: '',
    data_nascimento: '',
    papel: 'aluno',
    status: 'ativo',
  });

  const handleFormChange = (field: keyof UserFormData, value: string) => {
    let nextValue = value;

    if (field === 'nome') {
      nextValue = sanitizeNameInput(value);
    } else if (field === 'telefone') {
      nextValue = maskPhone(value);
    } else if (field === 'documento') {
      nextValue = maskCPF(value);
    }

    setFormData(prev => ({
      ...prev,
      [field]: nextValue,
    }));
  };

  const buildUserPayload = (): UserFormData => {
    const telefone = formData.telefone ? stripNonDigits(formData.telefone) : undefined;
    const documento = formData.documento ? stripNonDigits(formData.documento) : undefined;

    return {
      ...formData,
      nome: sanitizeNameInput(formData.nome).trim(),
      telefone,
      documento,
    };
  };

  // Load users
  useEffect(() => {
    loadUsers();
  }, [filterPapel, filterStatus]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await usersService.listUsers({
        papel: filterPapel as any,
        status: (filterStatus as 'ativo' | 'inativo') || undefined,
        search: searchTerm || undefined,
      });
      setUsers(response.data);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar usuários',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Handlers
  const handleSearch = () => {
    loadUsers();
  };

  const openCreateModal = () => {
    setFormData({
      nome: '',
      email: '',
      senha: '',
      telefone: '',
      documento: '',
      data_nascimento: '',
      papel: 'aluno',
      status: 'ativo',
    });
    setIsCreateModalOpen(true);
  };

  const openEditModal = (user: AdminUser) => {
    setSelectedUser(user);
    setFormData({
      nome: user.nome,
      email: user.email,
      senha: '', // N�o preencher senha ao editar
      telefone: user.telefone ? maskPhone(user.telefone) : '',
      documento: user.documento ? maskCPF(user.documento) : '',
      data_nascimento: user.data_nascimento || '',
      papel: user.papel,
      status: user.status,
    });
    setIsEditModalOpen(true);
  };

  const handleCreate = async () => {
    try {
      // Client-side validation: email format
      if (!formData.email || !isValidEmail(formData.email)) {
        toast({
          title: 'Email inválido',
          description: 'Informe um endereço de email válido (ex: nome@dominio.com).',
          variant: 'destructive',
        });
        return;
      }

      setSubmitting(true);
      const payload = buildUserPayload();
      await usersService.createUser(payload);
      
      toast({
        title: 'Usuário criado com sucesso!',
        description: `${formData.nome} foi adicionado.`,
      });
      
      setIsCreateModalOpen(false);
      loadUsers();
    } catch (error: any) {
      toast({
        title: 'Erro ao criar usuário',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedUser) return;
    
    try {
      setSubmitting(true);
      
      // Não enviar senha se estiver vazia
      const payload = buildUserPayload();
      if (!payload.senha) {
        delete payload.senha;
      }
      
      await usersService.updateUser(selectedUser.id_usuario, payload);
      
      toast({
        title: 'Usuário atualizado com sucesso!',
        description: `${formData.nome} foi modificado.`,
      });
      
      setIsEditModalOpen(false);
      loadUsers();
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar usuário',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = (user: AdminUser) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!userToDelete) return;
    
    try {
      setSubmitting(true);
      await usersService.deleteUser(userToDelete.id_usuario);
      
      toast({
        title: 'Usuário excluído com sucesso!',
        description: `${userToDelete.nome} foi removido.`,
      });
      
      setDeleteDialogOpen(false);
      setUserToDelete(null);
      loadUsers();
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir usuário',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: AdminUser) => {
    try {
      await usersService.toggleStatus(user.id_usuario);
      
      toast({
        title: 'Status alterado com sucesso!',
        description: `${user.nome} agora está ${user.status === 'ativo' ? 'inativo' : 'ativo'}.`,
      });
      
      loadUsers();
    } catch (error: any) {
      toast({
        title: 'Erro ao alterar status',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  // Filtered users (local search)
  const filteredUsers = users.filter(user => 
    user.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPapelBadge = (papel: string) => {
    switch (papel) {
      case 'admin':
        return <Badge variant="destructive"><Shield className="h-3 w-3 mr-1" /> Admin</Badge>;
      case 'personal':
        return <Badge className="bg-purple-600"><UserIcon className="h-3 w-3 mr-1" /> Personal</Badge>;
      case 'instrutor':
        return <Badge className="bg-blue-600"><UserIcon className="h-3 w-3 mr-1" /> Instrutor</Badge>;
      default:
        return <Badge variant="secondary"><UserIcon className="h-3 w-3 mr-1" /> Aluno</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestão de Usuários</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie alunos, personal trainers, instrutores e administradores
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="search">Buscar</Label>
              <div className="flex gap-2">
                <Input
                  id="search"
                  placeholder="Nome ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} variant="secondary">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div>
              <Label htmlFor="papel">Papel</Label>
              <Select value={filterPapel || 'all'} onValueChange={(val) => setFilterPapel(val === 'all' ? undefined : val)}>
                <SelectTrigger id="papel">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {PAPEL_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={filterStatus || 'all'} onValueChange={(val) => setFilterStatus(val === 'all' ? undefined : val)}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-fitway-green" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <p className="text-muted-foreground">Nenhum usuário encontrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.map(user => (
            <Card key={user.id_usuario} className="relative hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      <UserIcon className="h-5 w-5 text-fitway-green" />
                      {user.nome}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge variant={user.status === 'ativo' ? 'default' : 'secondary'}>
                        {user.status === 'ativo' ? (
                          <><CheckCircle className="h-3 w-3 mr-1" /> Ativo</>
                        ) : (
                          <><XCircle className="h-3 w-3 mr-1" /> Inativo</>
                        )}
                      </Badge>
                      {getPapelBadge(user.papel)}
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-3">
                {/* Email */}
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{user.email}</span>
                </div>

                {/* Telefone */}
                {user.telefone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{formatPhone(user.telefone)}</span>
                  </div>
                )}

                {/* Documento (CPF) */}
                {user.documento && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground text-xs">CPF:</span>
                    <span>{formatCPF(user.documento)}</span>
                  </div>
                )}

                {/* Data de Nascimento */}
                {user.data_nascimento && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{formatDate(user.data_nascimento)}</span>
                  </div>
                )}

                {/* Metadata */}
                <div className="text-xs text-muted-foreground pt-2 border-t">
                  Criado em {formatDate(user.criado_em)}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => openEditModal(user)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  <Button
                    variant={user.status === 'ativo' ? 'secondary' : 'default'}
                    size="sm"
                    onClick={() => handleToggleStatus(user)}
                  >
                    {user.status === 'ativo' ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => confirmDelete(user)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Modal - CONTINUA... */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar Novo Usuário</DialogTitle>
            <DialogDescription>
              Preencha os dados do novo usuário
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="create-nome">Nome Completo *</Label>
              <Input
                id="create-nome"
                placeholder="Ex: João Silva"
                value={formData.nome}
                onChange={(e) => handleFormChange('nome', e.target.value)}
                maxLength={80}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="create-email">Email *</Label>
                <Input
                  id="create-email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="create-senha">Senha *</Label>
                <Input
                  id="create-senha"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={formData.senha}
                  onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="create-telefone">Telefone</Label>
                <Input
                  id="create-telefone"
                  type="tel"
                  inputMode="numeric"
                  placeholder="(11) 98888-7777"
                  value={formData.telefone}
                  onChange={(e) => handleFormChange('telefone', e.target.value)}
                  maxLength={15}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="create-documento">CPF</Label>
                <Input
                  id="create-documento"
                  placeholder="000.000.000-00"
                  value={formData.documento}
                  onChange={(e) => handleFormChange('documento', e.target.value)}
                  inputMode="numeric"
                  maxLength={14}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="create-data-nascimento">Data de Nascimento</Label>
              <Input
                id="create-data-nascimento"
                type="date"
                value={formData.data_nascimento}
                onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="create-papel">Papel *</Label>
                <Select 
                  value={formData.papel} 
                  onValueChange={(val) => setFormData({ ...formData, papel: val as any })}
                >
                  <SelectTrigger id="create-papel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAPEL_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="create-status">Status</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(val) => setFormData({ ...formData, status: val as any })}
                >
                  <SelectTrigger id="create-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={submitting || !formData.nome || !formData.email || !formData.senha}>
              {submitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Criando...</>
              ) : (
                'Criar Usuário'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal - Similar ao Create */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Modifique os dados de {selectedUser?.nome}
            </DialogDescription>
          </DialogHeader>
          
          {/* Campos iguais ao create, mas senha opcional */}
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-nome">Nome Completo *</Label>
              <Input
                id="edit-nome"
                value={formData.nome}
                onChange={(e) => handleFormChange('nome', e.target.value)}
                maxLength={80}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-email">Email *</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-senha">Nova Senha (opcional)</Label>
                <Input
                  id="edit-senha"
                  type="password"
                  placeholder="Deixe vazio para não alterar"
                  value={formData.senha}
                  onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
              <Label htmlFor="edit-telefone">Telefone</Label>
              <Input
                id="edit-telefone"
                type="tel"
                inputMode="numeric"
                value={formData.telefone}
                onChange={(e) => handleFormChange('telefone', e.target.value)}
                maxLength={15}
              />
            </div>

              <div className="grid gap-2">
              <Label htmlFor="edit-documento">CPF</Label>
              <Input
                id="edit-documento"
                value={formData.documento}
                onChange={(e) => handleFormChange('documento', e.target.value)}
                inputMode="numeric"
                maxLength={14}
              />
            </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-data-nascimento">Data de Nascimento</Label>
              <Input
                id="edit-data-nascimento"
                type="date"
                value={formData.data_nascimento}
                onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-papel">Papel *</Label>
                <Select 
                  value={formData.papel} 
                  onValueChange={(val) => setFormData({ ...formData, papel: val as any })}
                >
                  <SelectTrigger id="edit-papel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAPEL_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(val) => setFormData({ ...formData, status: val as any })}
                >
                  <SelectTrigger id="edit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={handleEdit} disabled={submitting || !formData.nome || !formData.email}>
              {submitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>
              ) : (
                'Salvar Alterações'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o usuário <strong>{userToDelete?.nome}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={submitting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {submitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Excluindo...</>
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUsers;
