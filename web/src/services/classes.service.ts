import { apiClient } from '@/lib/api-client';
import type {
  Aula,
  AulaFormData,
  HorarioAula,
  HorarioAulaFormData,
  OcorrenciaAula,
  GerarOcorrenciasRequest,
  GerarOcorrenciasResponse,
  InscricaoAula,
  InscricaoAulaRequest,
} from '@/types';

// =====================================================================
// NORMALIZAÇÃO (ID conversions)
// =====================================================================

const normalizeDiaSemana = (dia: number): string => {
  const dias = ['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
  return dias[dia] || '';
};

const normalizeAula = (aula: any): Aula => ({
  ...aula,
  id_aula: String(aula.id_aula),
  preco_unitario: aula.preco_unitario ? Number(aula.preco_unitario) : undefined,
});

const normalizeHorarioAula = (horario: any): HorarioAula => ({
  ...horario,
  id_horario_aula: String(horario.id_horario_aula),
  id_aula: String(horario.id_aula),
  id_instrutor: String(horario.id_instrutor),
  id_quadra: String(horario.id_quadra),
  dia_semana_texto: normalizeDiaSemana(horario.dia_semana),
  aula: horario.aula ? normalizeAula(horario.aula) : undefined,
});

const normalizeOcorrenciaAula = (ocorrencia: any): OcorrenciaAula => ({
  ...ocorrencia,
  id_ocorrencia_aula: String(ocorrencia.id_ocorrencia_aula),
  id_aula: String(ocorrencia.id_aula),
  id_instrutor: String(ocorrencia.id_instrutor),
  id_quadra: String(ocorrencia.id_quadra),
  // Mapear contadores quando vierem do backend
  numero_inscritos: typeof ocorrencia.numero_inscritos === 'number'
    ? ocorrencia.numero_inscritos
    : (typeof ocorrencia.inscricoes_count === 'number' ? ocorrencia.inscricoes_count : undefined),
  aula: ocorrencia.aula ? normalizeAula(ocorrencia.aula) : undefined,
});

const normalizeInscricaoAula = (inscricao: any): InscricaoAula => ({
  ...inscricao,
  id_inscricao_aula: String(inscricao.id_inscricao_aula),
  id_ocorrencia_aula: inscricao.id_ocorrencia_aula ? String(inscricao.id_ocorrencia_aula) : undefined,
  id_aula: String(inscricao.id_aula),
  id_usuario: String(inscricao.id_usuario),
  ocorrencia: inscricao.ocorrencia ? normalizeOcorrenciaAula(inscricao.ocorrencia) : undefined,
  aula: inscricao.aula ? normalizeAula(inscricao.aula) : undefined,
});

// =====================================================================
// AULAS SERVICE (Admin CRUD)
// =====================================================================

class ClassesService {
  /**
   * Listar aulas (admin ou aluno)
   * Usa rota pública para homepage
   */
  async list(filters?: {
    status?: string;
    esporte?: string;
    nivel?: string;
    search?: string;
    per_page?: number;
  }) {
    // Para homepage (rota pública): quando sem filtros OU apenas status ("ativo"/"ativa")
    const onlyStatusFilter = !!filters && Object.keys(filters).every((k) => k === 'status');
    const statusValue = (filters?.status || '').toLowerCase();
    const isPublicStatus = statusValue === 'ativo' || statusValue === 'ativa';

    if (!filters || (onlyStatusFilter && isPublicStatus)) {
      // Enviar filtros (ex.: status=ativa) para a rota pública
      const response = await apiClient.get<any>('/public/classes', filters);
      const raw = Array.isArray(response) ? response : (response?.data || []);
      return {
        data: raw.map(normalizeAula),
        meta: Array.isArray(response) ? undefined : response?.meta,
      };
    }

    // Para admin/aluno autenticado, usar rota protegida
    const response = await apiClient.get<any>('/classes', filters);
    const raw = Array.isArray(response) ? response : (response?.data || []);
    return {
      data: raw.map(normalizeAula),
      meta: Array.isArray(response) ? undefined : response?.meta,
    };
  }

  /**
   * Obter detalhes de uma aula
   */
  async get(id: string) {
    const response = await apiClient.get<{ data: any }>(`/classes/${id}`);
    return normalizeAula(response.data);
  }

  /**
   * Criar aula (admin)
   */
  async create(data: AulaFormData) {
    const response = await apiClient.post<{ data: any }>('/admin/classes', data);
    return normalizeAula(response.data);
  }

  /**
   * Atualizar aula (admin)
   */
  async update(id: string, data: Partial<AulaFormData>) {
    const response = await apiClient.put<{ data: any }>(`/admin/classes/${id}`, data);
    return normalizeAula(response.data);
  }

  /**
   * Deletar aula (admin) - Soft delete
   */
  async delete(id: string) {
    await apiClient.delete(`/admin/classes/${id}`);
  }
}

// =====================================================================
// HORÁRIOS SERVICE (Admin)
// =====================================================================

class ClassSchedulesService {
  /**
   * Listar horários de uma aula
   */
  async list(filters?: { id_aula?: string; id_instrutor?: string; dia_semana?: number }) {
    const response = await apiClient.get<{ data: any[] }>('/admin/class-schedules', filters);
    return response.data.map(normalizeHorarioAula);
  }

  /**
   * Criar horário
   */
  async create(data: HorarioAulaFormData) {
    const response = await apiClient.post<{ data: any }>('/admin/class-schedules', data);
    return normalizeHorarioAula(response.data);
  }

  /**
   * Atualizar horário
   */
  async update(id: string, data: Partial<HorarioAulaFormData>) {
    const response = await apiClient.put<{ data: any }>(`/admin/class-schedules/${id}`, data);
    return normalizeHorarioAula(response.data);
  }

  /**
   * Deletar horário
   */
  async delete(id: string) {
    await apiClient.delete(`/admin/class-schedules/${id}`);
  }
}

// =====================================================================
// OCORRÊNCIAS SERVICE (Admin + Aluno)
// =====================================================================

class ClassOccurrencesService {
  /**
   * Listar ocorrências para o aluno (rota autenticada do aluno)
   * GET /classes/occurrences
   */
  async listForStudent(filters?: {
    id_aula?: string;
    id_instrutor?: string;
    id_quadra?: string;
    status?: string; // padrão do backend: exclui canceladas quando omitido
    data_inicio?: string; // YYYY-MM-DD
    data_fim?: string; // YYYY-MM-DD
    per_page?: number;
    search?: string;
  }) {
    const response = await apiClient.get<{ data: any[]; meta?: any }>(
      '/classes/occurrences',
      filters
    );
    // Normaliza e remove duplicações (mesma ocorrência retornando múltiplas vezes por joins)
    const normalized = (response.data || []).map(normalizeOcorrenciaAula);
    const seen = new Set<string>();
    const unique: OcorrenciaAula[] = [];
    for (const occ of normalized) {
      if (!seen.has(occ.id_ocorrencia_aula)) {
        seen.add(occ.id_ocorrencia_aula);
        unique.push(occ);
      }
    }
    return {
      data: unique,
      meta: (response as any).meta,
    };
  }
  /**
   * Listar ocorrências (ADMIN)
   */
  async list(filters?: {
    id_aula?: string;
    id_instrutor?: string;
    status?: string;
    data_inicio?: string;
    data_fim?: string;
    apenas_futuras?: boolean;
    per_page?: number;
  }) {
    const response = await apiClient.get<{ data: any[]; meta?: any }>('/admin/class-occurrences', filters);
    
    return {
      data: (response.data || []).map(normalizeOcorrenciaAula),
      meta: response.meta,
    };
  }

  /**
   * Obter detalhes de uma ocorrência (ADMIN)
   */
  async get(id: string) {
    const response = await apiClient.get<{ data: any }>(`/admin/class-occurrences/${id}`);
    return normalizeOcorrenciaAula(response.data);
  }

  /**
   * Gerar ocorrências (admin)
   */
  async gerar(data: GerarOcorrenciasRequest): Promise<GerarOcorrenciasResponse> {
    const response = await apiClient.post<any>('/admin/class-occurrences/generate', data);
    return {
      message: response.message,
      criadas: response.criadas,
      puladas: response.puladas,
      data: response.data.map(normalizeOcorrenciaAula),
    };
  }

  /**
   * Cancelar ocorrência (admin)
   */
  async cancelar(id: string) {
    const response = await apiClient.patch<{ data: any }>(`/admin/class-occurrences/${id}/cancel`, {});
    return normalizeOcorrenciaAula(response.data);
  }

  /**
   * Remover ocorrência (admin) - Soft delete
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/admin/class-occurrences/${id}`);
  }
}

// =====================================================================
// INSCRIÇÕES SERVICE (Aluno)
// =====================================================================

class ClassEnrollmentsService {
  /**
   * Minhas inscrições (aluno)
   */
  async myEnrollments(filters?: { status?: string; apenas_futuras?: boolean }) {
    const response = await apiClient.get<{ data: any[] }>('/class-enrollments/me', filters);
    return response.data.map(normalizeInscricaoAula);
  }

  /**
   * Inscrever-se em uma ocorrência
   */
  async enroll(data: InscricaoAulaRequest) {
    const response = await apiClient.post<{ 
      data: any;
      cobranca?: {
        id: number;
        valor: number;
        vencimento: string;
        status: string;
      };
    }>('/class-enrollments', data);
    
    return {
      inscricao: normalizeInscricaoAula(response.data),
      cobranca: response.cobranca,
    };
  }

  /**
   * Cancelar inscrição
   */
  async cancel(id: string): Promise<{ data: any; message: string }> {
    const response = await apiClient.delete<{ data: any; message: string }>(`/class-enrollments/${id}`);
    return response;
  }

  /**
   * Listar todas inscrições (admin)
   */
  async list(filters?: { id_aula?: string; id_ocorrencia_aula?: string; status?: string; per_page?: number }) {
    const response = await apiClient.get<{ data: any[]; meta?: any }>('/admin/class-enrollments', filters);
    return {
      data: response.data.map(normalizeInscricaoAula),
      meta: response.meta,
    };
  }
}

// =====================================================================
// EXPORTS
// =====================================================================

export const classesService = new ClassesService();
export const classSchedulesService = new ClassSchedulesService();
export const classOccurrencesService = new ClassOccurrencesService();
export const classEnrollmentsService = new ClassEnrollmentsService();
