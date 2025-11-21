import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { classesService } from '@/services/classes.service';
import { ApiError } from '@/lib/api-client';
import type { AulaFormData } from '@/types';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { maskCurrency, parseCurrency, formatCurrency } from '@/lib/utils';

const AddClass = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState<AulaFormData>({
    nome: '',
    esporte: '',
    nivel: undefined,
    duracao_min: 60,
    capacidade_max: 10,
    preco_unitario: undefined,
    descricao: '',
    requisitos: '',
    status: 'ativa',
  });
  const [priceInput, setPriceInput] = useState('');

  const handlePriceChange = (raw: string) => {
    if (!raw) {
      setPriceInput('');
      setFormData(prev => ({ ...prev, preco_unitario: undefined }));
      return;
    }
    const masked = maskCurrency(raw);
    setPriceInput(masked);
    setFormData(prev => ({ ...prev, preco_unitario: parseCurrency(masked) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome || !formData.esporte) {
      toast({
        title: 'Erro de validação',
        description: 'Nome e esporte são obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      await classesService.create(formData);
      
      toast({
        title: 'Aula criada!',
        description: `${formData.nome} foi criada com sucesso.`,
      });
      
      navigate('/admin/aulas');
    } catch (error) {
      if (error instanceof ApiError) {
        toast({
          title: 'Erro ao criar aula',
          description: error.message,
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-8">
        <Button
          variant="outline"
          onClick={() => navigate('/admin/aulas')}
          className="border-dashboard-border text-white hover:bg-dashboard-border"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-white">Nova Aula</h1>
          <p className="text-white/80">Cadastre uma nova aula em grupo</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="bg-dashboard-card border-dashboard-border">
          <CardHeader>
            <CardTitle className="text-white">Informações Básicas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="nome" className="text-white">Nome da Aula *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                className="bg-dashboard-bg border-dashboard-border text-white"
                placeholder="Ex: Beach Tennis Iniciante"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="esporte" className="text-white">Esporte *</Label>
              <Input
                id="esporte"
                value={formData.esporte}
                onChange={(e) => setFormData({ ...formData, esporte: e.target.value })}
                className="bg-dashboard-bg border-dashboard-border text-white"
                placeholder="Ex: beach_tennis, funcional, tenis"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nivel" className="text-white">Nível</Label>
              <Select 
                value={formData.nivel || 'livre'} 
                onValueChange={(value) => setFormData({ ...formData, nivel: value === 'livre' ? undefined : value as any })}
              >
                <SelectTrigger className="bg-dashboard-bg border-dashboard-border text-white">
                  <SelectValue placeholder="Selecione o nível" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="livre">Livre</SelectItem>
                  <SelectItem value="iniciante">Iniciante</SelectItem>
                  <SelectItem value="intermediario">Intermediário</SelectItem>
                  <SelectItem value="avancado">Avançado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="duracao_min" className="text-white">Duração (min) *</Label>
                <Input
                  id="duracao_min"
                  type="number"
                  value={formData.duracao_min}
                  onChange={(e) => setFormData({ ...formData, duracao_min: Number(e.target.value) })}
                  className="bg-dashboard-bg border-dashboard-border text-white"
                  min="15"
                  max="240"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacidade_max" className="text-white">Capacidade Máxima *</Label>
                <Input
                  id="capacidade_max"
                  type="number"
                  value={formData.capacidade_max}
                  onChange={(e) => setFormData({ ...formData, capacidade_max: Number(e.target.value) })}
                  className="bg-dashboard-bg border-dashboard-border text-white"
                  min="1"
                  max="50"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="preco_unitario" className="text-white">Preço Unitário (R$)</Label>
              <Input
                id="preco_unitario"
                type="text"
                inputMode="numeric"
                placeholder="Deixe vazio se incluso no plano"
                value={priceInput}
                onChange={(e) => handlePriceChange(e.target.value)}
                onBlur={() => {
                  if (formData.preco_unitario) {
                    setPriceInput(formatCurrency(formData.preco_unitario));
                  }
                }}
                className="bg-dashboard-bg border-dashboard-border text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao" className="text-white">Descrição</Label>
              <Textarea
                id="descricao"
                value={formData.descricao || ''}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                className="bg-dashboard-bg border-dashboard-border text-white"
                placeholder="Descreva a aula, objetivos, metodologia..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="requisitos" className="text-white">Requisitos</Label>
              <Textarea
                id="requisitos"
                value={formData.requisitos || ''}
                onChange={(e) => setFormData({ ...formData, requisitos: e.target.value })}
                className="bg-dashboard-bg border-dashboard-border text-white"
                placeholder="Pré-requisitos, materiais necessários..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/admin/aulas')}
                className="border-dashboard-border text-white hover:bg-dashboard-border"
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-fitway-green hover:bg-fitway-green/90 text-white"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Salvar Aula
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
};

export default AddClass;
