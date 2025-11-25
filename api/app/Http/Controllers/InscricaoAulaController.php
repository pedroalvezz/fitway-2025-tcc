<?php

namespace App\Http\Controllers;

use App\Models\InscricaoAula;
use App\Models\OcorrenciaAula;
use App\Models\Cobranca;
use App\Services\PagamentoService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class InscricaoAulaController extends Controller
{
    /**
     * Listar inscrições do usuário logado
     */
    public function minhasInscricoes(Request $request)
    {
        $idUsuario = Auth::id();

        $query = InscricaoAula::with(['aula', 'ocorrencia.instrutor', 'ocorrencia.quadra'])
            ->where('id_usuario', $idUsuario);

        // Filtro por status
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        } else {
            // Padrão: apenas inscrições ativas
            $query->where('status', 'inscrito');
        }

        // Apenas futuras
        if ($request->boolean('apenas_futuras')) {
            $query->whereHas('ocorrencia', function ($q) {
                $q->where('inicio', '>', now());
            });
        }

        $query->orderBy('criado_em', 'desc');

        $inscricoes = $query->get();

        return response()->json(['data' => $inscricoes], 200);
    }

    /**
     * Inscrever-se em uma ocorrência de aula
     */
    public function inscrever(Request $request, PagamentoService $pagamentoService)
    {
        $validated = $request->validate([
            'id_ocorrencia_aula' => 'required|exists:ocorrencias_aula,id_ocorrencia_aula',
        ]);

        $idUsuario = Auth::id();
        $ocorrencia = OcorrenciaAula::with('aula')->findOrFail($validated['id_ocorrencia_aula']);

        // Validações
        if ($ocorrencia->status !== 'agendada') {
            return response()->json([
                'message' => 'Esta ocorrência não está disponível para inscrição',
            ], 400);
        }

        if ($ocorrencia->inicio < now()) {
            return response()->json([
                'message' => 'Não é possível se inscrever em aulas passadas',
            ], 400);
        }

        // Verificar se já está inscrito (ativo ou cancelado)
        $inscricaoExistente = InscricaoAula::where('id_ocorrencia_aula', $ocorrencia->id_ocorrencia_aula)
            ->where('id_usuario', $idUsuario)
            ->first(); // Buscar qualquer inscrição (inscrito ou cancelado)

        if ($inscricaoExistente && $inscricaoExistente->status === 'inscrito') {
            // Já está inscrito ativamente
            return response()->json([
                'message' => 'Você já está inscrito nesta aula',
            ], 409);
        }

        // Verificar capacidade
        $numeroInscritos = InscricaoAula::where('id_ocorrencia_aula', $ocorrencia->id_ocorrencia_aula)
            ->where('status', 'inscrito')
            ->count();

        if ($numeroInscritos >= $ocorrencia->aula->capacidade_max) {
            return response()->json([
                'message' => 'Esta aula já atingiu a capacidade máxima',
            ], 409);
        }

        // ✅ Criar inscrição + cobrança em transação (ou reativar se existia cancelada)
        try {
            $result = DB::transaction(function () use ($ocorrencia, $idUsuario, $pagamentoService, $inscricaoExistente) {
                // Se já existe inscrição cancelada, reativar
                if ($inscricaoExistente && $inscricaoExistente->status === 'cancelado') {
                    $inscricaoExistente->update(['status' => 'inscrito']);
                    $inscricao = $inscricaoExistente;
                } else {
                    // Criar nova inscrição
                    $inscricao = InscricaoAula::create([
                        'id_ocorrencia_aula' => $ocorrencia->id_ocorrencia_aula,
                        'id_aula' => $ocorrencia->id_aula,
                        'id_usuario' => $idUsuario,
                        'status' => 'inscrito',
                    ]);
                }
                $inscricao->load(['aula', 'ocorrencia']);

                // 2. ✅ Gerar cobrança SOMENTE se a aula possuir preço (não incluída no plano)
                $cobranca = null;
                if (!is_null($ocorrencia->aula->preco_unitario) && (float)$ocorrencia->aula->preco_unitario > 0) {
                    $descricao = sprintf(
                        'Aula: %s - %s',
                        $ocorrencia->aula->nome,
                        $ocorrencia->inicio->format('d/m/Y H:i')
                    );

                    $cobranca = $pagamentoService->criarCobranca(
                        idUsuario: $idUsuario,
                        tipo: 'inscricao_aula',
                        idReferencia: $inscricao->id_inscricao_aula,
                        valor: (float)$ocorrencia->aula->preco_unitario,
                        descricao: $descricao,
                        vencimento: now()->addDays(7) // Vence em 7 dias
                    );
                }

                return [
                    'inscricao' => $inscricao,
                    'cobranca' => $cobranca,
                ];
            });

            if ($result['cobranca']) {
                $mensagem = ($inscricaoExistente && $inscricaoExistente->status === 'cancelado')
                    ? 'Inscrição reativada com sucesso. Uma cobrança foi gerada.'
                    : 'Inscrição realizada com sucesso. Uma cobrança foi gerada.';
            } else {
                $mensagem = ($inscricaoExistente && $inscricaoExistente->status === 'cancelado')
                    ? 'Inscrição reativada (sem cobrança - incluída no plano).'
                    : 'Inscrição realizada (sem cobrança - incluída no plano).';
            }

            return response()->json([
                'message' => $mensagem,
                'data' => $result['inscricao'],
                'cobranca' => $result['cobranca'] ? [
                    'id' => $result['cobranca']->id_cobranca,
                    'valor' => $result['cobranca']->valor_total,
                    'vencimento' => $result['cobranca']->vencimento->format('Y-m-d'),
                    'status' => $result['cobranca']->status,
                ] : null,
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erro ao criar inscrição: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Cancelar inscrição
     * DELETE /api/class-enrollments/{id}
     *
     * ✨ NOVO: Se houver cobrança NÃO PAGA, cancela também!
     */
    public function cancelar(int $id)
    {
        $idUsuario = Auth::id();
        $inscricao = InscricaoAula::where('id_inscricao_aula', $id)
            ->where('id_usuario', $idUsuario)
            ->with('ocorrencia')
            ->firstOrFail();

        if ($inscricao->status !== 'inscrito') {
            return response()->json([
                'message' => 'Esta inscrição já foi cancelada',
            ], 400);
        }

        // Verificar se a aula já passou
        if ($inscricao->ocorrencia && $inscricao->ocorrencia->inicio < now()) {
            return response()->json([
                'message' => 'Não é possível cancelar inscrições de aulas passadas',
            ], 400);
        }

        // ✨ NOVO: Verifica se tem cobrança não paga antes de cancelar
        $cobranca = Cobranca::where('referencia_tipo', 'inscricao_aula')
            ->where('referencia_id', $inscricao->id_inscricao_aula)
            ->where('status', '!=', 'pago')
            ->first();

        // Se tem cobrança não paga, cancelar também
        if ($cobranca) {
            $cobranca->update(['status' => 'cancelado']);
        }

        $inscricao->update(['status' => 'cancelado']);

        return response()->json([
            'data' => [
                'id_inscricao_aula' => (string) $inscricao->id_inscricao_aula,
                'status' => 'cancelado',
                'cobranca_cancelada' => $cobranca ? true : false,
            ],
            'message' => $cobranca
                ? 'Inscrição e cobrança canceladas com sucesso'
                : 'Inscrição cancelada com sucesso',
        ], 200);
    }

    /**
     * Listar todas as inscrições (admin)
     * Se chamado via /class-occurrences/{occurrenceId}/enrollments, filtra por ocorrência
     */
    public function index(Request $request, $occurrenceId = null)
    {
        $query = InscricaoAula::with(['usuario', 'aula', 'ocorrencia']);

        // ✅ Se veio da rota nested (/class-occurrences/{id}/enrollments), filtrar por ocorrência
        if ($occurrenceId) {
            $query->where('id_ocorrencia_aula', $occurrenceId);
        }
        // Senão, permitir filtros via query string (listagem geral)
        else {
            // Filtro por aula
            if ($request->filled('id_aula')) {
                $query->where('id_aula', $request->id_aula);
            }

            // Filtro por ocorrência
            if ($request->filled('id_ocorrencia_aula')) {
                $query->where('id_ocorrencia_aula', $request->id_ocorrencia_aula);
            }
        }

        // Filtro por status
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        } else {
            // ✅ Padrão: apenas inscrições ativas (não canceladas)
            $query->where('status', '!=', 'cancelado');
        }

        $query->orderBy('criado_em', 'desc');

        $perPage = $request->input('per_page', 50);
        $inscricoes = $query->paginate($perPage);

        // ✅ Se for nested route, incluir informações da ocorrência no meta
        $meta = [
            'current_page' => $inscricoes->currentPage(),
            'last_page' => $inscricoes->lastPage(),
            'per_page' => $inscricoes->perPage(),
            'total' => $inscricoes->total(),
        ];

        if ($occurrenceId) {
            $ocorrencia = OcorrenciaAula::with(['aula', 'instrutor', 'quadra'])->findOrFail($occurrenceId);
            $capacidadeAtual = $inscricoes->total();
            $capacidadeMaxima = $ocorrencia->aula->capacidade_max;

            $meta['capacidade_atual'] = $capacidadeAtual;
            $meta['capacidade_maxima'] = $capacidadeMaxima;
            $meta['vagas_disponiveis'] = $capacidadeMaxima - $capacidadeAtual;
            $meta['ocorrencia'] = [
                'id' => (string)$ocorrencia->id_ocorrencia_aula,
                'inicio' => $ocorrencia->inicio,
                'fim' => $ocorrencia->fim,
                'aula_nome' => $ocorrencia->aula->nome,
                'instrutor_nome' => $ocorrencia->instrutor->nome,
                'quadra_nome' => $ocorrencia->quadra->nome,
            ];
        }

        return response()->json([
            'data' => $inscricoes->items(),
            'meta' => $meta,
        ], 200);
    }

    /**
     * ADMIN: Inscrever aluno em ocorrência
     */
    public function adminInscrever(Request $request, $occurrenceId)
    {
        $validated = $request->validate([
            'id_usuario' => 'required|exists:usuarios,id_usuario',
        ]);

        $ocorrencia = OcorrenciaAula::with('aula')->findOrFail($occurrenceId);
        $aula = $ocorrencia->aula;

        // ✅ Verificar se ocorrência está agendada ou confirmada (ambas aceitam inscrições)
        if (!in_array($ocorrencia->status, ['agendada', 'confirmada'])) {
            return response()->json([
                'message' => 'Apenas ocorrências agendadas ou confirmadas podem receber inscrições',
                'code' => 'INVALID_STATUS'
            ], 400);
        }

        // Verificar se já está inscrito
        $inscricaoExistente = InscricaoAula::where('id_ocorrencia_aula', $occurrenceId)
            ->where('id_usuario', $validated['id_usuario'])
            ->where('status', 'inscrito')
            ->first();

        if ($inscricaoExistente) {
            return response()->json([
                'message' => 'Aluno já está inscrito nesta ocorrência',
                'code' => 'ALREADY_ENROLLED'
            ], 409);
        }

        // Verificar capacidade
        $inscricoesAtuais = InscricaoAula::where('id_ocorrencia_aula', $occurrenceId)
            ->where('status', 'inscrito')
            ->count();

        if ($inscricoesAtuais >= $aula->capacidade_max) {
            return response()->json([
                'message' => 'Capacidade máxima da aula atingida',
                'code' => 'CAPACITY_EXCEEDED',
                'meta' => [
                    'capacidade_atual' => $inscricoesAtuais,
                    'capacidade_maxima' => $aula->capacidade_max
                ]
            ], 409);
        }

        // Criar inscrição
        $inscricao = InscricaoAula::create([
            'id_ocorrencia_aula' => $occurrenceId,
            'id_aula' => $aula->id_aula,
            'id_usuario' => $validated['id_usuario'],
            'status' => 'inscrito', // Admin inscreve diretamente como confirmada
        ]);

        $inscricao->load('usuario');

        return response()->json(['data' => $inscricao], 201);
    }

    /**
     * ADMIN: Remover inscrição
     */
    public function adminRemover($id)
    {
        $inscricao = InscricaoAula::findOrFail($id);

        // Soft delete: marcar como cancelado
        $inscricao->update(['status' => 'cancelado']);

        return response()->json(null, 204);
    }

    /**
     * ADMIN: Listar alunos disponíveis para inscrição
     * Se occurrence_id for fornecido: exclui alunos já inscritos nessa ocorrência
     * Se occurrence_id NÃO for fornecido: retorna todos os alunos ativos (para inscrição em lote)
     */
    public function alunosDisponiveis(Request $request)
    {
        $occurrenceId = $request->query('occurrence_id');

        // Buscar apenas usuários com papel=aluno e status=ativo
        $query = \App\Models\Usuario::where('papel', 'aluno')
            ->where('status', 'ativo');

        // Se occurrence_id fornecido, excluir alunos já inscritos nessa ocorrência específica
        if ($occurrenceId) {
            $inscritosIds = InscricaoAula::where('id_ocorrencia_aula', $occurrenceId)
                ->where('status', 'inscrito')
                ->pluck('id_usuario');

            $query->whereNotIn('id_usuario', $inscritosIds);
        }

        $alunosDisponiveis = $query->orderBy('nome')
            ->get(['id_usuario', 'nome', 'email']);

        return response()->json(['data' => $alunosDisponiveis], 200);
    }
}
