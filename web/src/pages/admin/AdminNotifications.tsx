import { useState, useEffect } from 'react';
import { notificationsService } from '@/services/notifications.service';
import { usersService } from '@/services/users.service';
import type { NotificacaoFormData, AdminUser } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/utils';
import { Bell, Send, Loader2, Users } from 'lucide-react';

const tiposNotificacao = [
  { value: 'cobranca', label: '💳 Cobrança' },
  { value: 'pagamento', label: '✅ Pagamento' },
  { value: 'sessao', label: '🏋️ Sessão Personal' },
  { value: 'reserva', label: '🎾 Reserva Quadra' },
  { value: 'aula', label: '📚 Aula/Turma' },
  { value: 'assinatura', label: '⭐ Assinatura' },
  { value: 'sistema', label: '🔔 Sistema/Aviso' },
];

export default function AdminNotifications() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [formData, setFormData] = useState<NotificacaoFormData>({
    id_usuario: '',
    tipo: 'sistema',
    titulo: '',
    mensagem: '',
    link: '',
  });
  const [destino, setDestino] = useState<string>('none');
  

  useEffect(() => {
    loadUsers();
  }, []);

  function buildLink(dest: string) {
    if (!dest || dest === 'none') return '';
    switch (dest) {
      // Some destinations require a specific resource id (checkout, aula detail).
      // We no longer accept an explicit Destino ID in the UI — leave those empty
      // so the backend can auto-generate a safe internal link based on the
      // created notification id when appropriate.
      case 'checkout':
        return '';
      case 'pagamentos':
        return '/aluno/pagamentos';
      case 'planos':
        return '/aluno/planos';
      case 'aulas':
        return '/aluno/aulas';
      case 'personal':
        return '/aluno/personal';
      case 'reservas':
        return '/aluno/reservas';
      default:
        return '';
    }
  }

  const loadUsers = async () => {
    try {
      setLoadingUsers(true);
      const result = await usersService.listUsers();
      setUsers(result.data);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar usuários',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.id_usuario || !formData.titulo || !formData.mensagem) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha usuário, título e mensagem',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      await notificationsService.createManual(formData);
      toast({
        title: '✅ Notificação enviada!',
        description: 'O usuário receberá a notificação.',
      });
      // Reset form
      setFormData({
        id_usuario: '',
        tipo: 'sistema',
        titulo: '',
        mensagem: '',
        link: '',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao enviar notificação',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof NotificacaoFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-fitway-green/10 p-3 rounded-lg">
          <Bell className="h-6 w-6 text-fitway-green" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Criar Notificação Manual</h1>
          <p className="text-sm text-muted-foreground">
            Envie notificações personalizadas para os usuários
          </p>
        </div>
      </div>

      {/* Form Card */}
      <Card>
        <CardHeader>
          <CardTitle>Nova Notificação</CardTitle>
          <CardDescription>
            Preencha os campos abaixo para criar e enviar uma notificação
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Usuário */}
            <div className="space-y-2">
              <Label htmlFor="id_usuario">
                Usuário <span className="text-destructive">*</span>
              </Label>
              {loadingUsers ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando usuários...
                </div>
              ) : (
                <Select
                  value={formData.id_usuario}
                  onValueChange={(value) => handleChange('id_usuario', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={String(user.id_usuario)} value={String(user.id_usuario)}>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          <span>{user.nome}</span>
                          <span className="text-xs text-muted-foreground">({user.email})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-xs text-muted-foreground">
                A notificação será enviada apenas para este usuário
              </p>
            </div>

            {/* Tipo */}
            <div className="space-y-2">
              <Label htmlFor="tipo">
                Tipo <span className="text-destructive">*</span>
              </Label>
              <Select value={formData.tipo} onValueChange={(value) => handleChange('tipo', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tiposNotificacao.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                O tipo define o ícone exibido na notificação
              </p>
            </div>

            {/* Título */}
            <div className="space-y-2">
              <Label htmlFor="titulo">
                Título <span className="text-destructive">*</span>
              </Label>
              <Input
                id="titulo"
                value={formData.titulo}
                onChange={(e) => handleChange('titulo', e.target.value)}
                placeholder="Ex: Promoção de Fim de Ano!"
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">Máximo 100 caracteres</p>
            </div>

            {/* Mensagem */}
            <div className="space-y-2">
              <Label htmlFor="mensagem">
                Mensagem <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="mensagem"
                value={formData.mensagem}
                onChange={(e) => handleChange('mensagem', e.target.value)}
                placeholder="Digite a mensagem da notificação..."
                rows={4}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">Máximo 500 caracteres</p>
            </div>

            {/* Link (opcional) */}
            <div className="space-y-2">
              <Label htmlFor="link">Link de Redirecionamento (opcional)</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Destino</Label>
                  <Select value={destino} onValueChange={(v) => {
                    setDestino(v);
                    // build link when changing destination
                    const link = buildLink(v);
                    setFormData(prev => ({ ...prev, link } as any));
                  }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Manual / Nenhum</SelectItem>
                      <SelectItem value="checkout">Checkout (pagamento)</SelectItem>
                      <SelectItem value="pagamentos">Pagamentos</SelectItem>
                      <SelectItem value="planos">Planos</SelectItem>
                      <SelectItem value="aulas">Aulas</SelectItem>
                      <SelectItem value="personal">Sessões Personal</SelectItem>
                      <SelectItem value="reservas">Reservas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">Link Gerado</Label>
                  <Input value={formData.link || ''} readOnly />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                O sistema irá gerar um link interno válido com base no destino. Para destinos que precisam de um recurso específico (ex: checkout, detalhes de aula), deixe o destino selecionado e o campo ficará vazio — o backend irá gerar o link seguro automaticamente.
              </p>
            </div>

            {/* Preview */}
            {formData.titulo && formData.mensagem && (
              <Card className="bg-muted/50 border-dashed">
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Preview da Notificação</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <Bell className="h-5 w-5 text-fitway-green" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm mb-1">{formData.titulo}</h3>
                      <p className="text-sm text-muted-foreground">{formData.mensagem}</p>
                      {formData.link && (
                        <p className="text-xs text-blue-500 mt-2">🔗 {formData.link}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Enviar Notificação
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setFormData({
                    id_usuario: '',
                    tipo: 'sistema',
                    titulo: '',
                    mensagem: '',
                    link: '',
                  })
                }
              >
                Limpar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Help Card */}
      <Card className="mt-6 bg-muted/60 border-border/50">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Dicas de Uso
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-muted-foreground">
          <p>
            • <strong>Tipo Sistema:</strong> Use para avisos gerais, manutenção, novidades
          </p>
          <p>
            • <strong>Tipo Cobrança:</strong> Use para lembrar pagamentos pendentes
          </p>
          <p>
            • <strong>Link:</strong> Redirecione o usuário para páginas úteis (ex:{' '}
            <code className="bg-background/40 px-1 rounded border border-border/30">/aluno/pagamentos</code>)
          </p>
          <p>
            • As notificações aparecem no sino 🔔 no header e na página de notificações do usuário
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
