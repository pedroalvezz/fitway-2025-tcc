<?php

namespace App\Http\Controllers;

use App\Models\OcorrenciaAula;
use App\Services\OcorrenciaAulaService;
use Carbon\Carbon;
use Illuminate\Http\Request;

class OcorrenciaAulaController extends Controller
{
    protected $ocorrenciaService;

    public function __construct(OcorrenciaAulaService $ocorrenciaService)
    {
        $this->ocorrenciaService = $ocorrenciaService;
    }

    /**
     * Listar ocorrências (com filtros)
     */
    public function index(Request $request)
    {
        $query = OcorrenciaAula::query()
            ->with(['aula', 'instrutor', 'quadra'])
            ->withCount([
                'inscricoes as numero_inscritos' => function ($q) {
                    $q->where('status', 'ativa');
                }
            ]);

        // Filtros
        if ($request->filled('id_aula')) {
            $query->where('id_aula', $request->id_aula);
        }

        if ($request->filled('id_instrutor')) {
            $query->where('id_instrutor', $request->id_instrutor);
        }

        if ($request->filled('id_quadra')) {
            $query->where('id_quadra', $request->id_quadra);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        } else {
            // Padrão: excluir apenas canceladas
            $query->where('status', '!=', 'cancelada');
        }

        // Filtro por data (início)
        if ($request->filled('data_inicio')) {
            $query->whereDate('inicio', '>=', $request->data_inicio);
        } elseif (!$request->filled('data_fim')) {
            // Padrão: mostrar apenas futuras (se não especificar data_inicio nem data_fim)
            $query->where('inicio', '>=', now());
        }

        if ($request->filled('data_fim')) {
            $query->whereDate('inicio', '<=', $request->data_fim);
        }

        // Busca textual: aula (nome, esporte, descricao) ou instrutor (nome)
        if ($request->filled('search')) {
            $search = mb_strtolower($request->search, 'UTF-8');
            $query->where(function ($sub) use ($search) {
                $sub->whereHas('aula', function ($q) use ($search) {
                    $q->whereRaw('LOWER(nome) LIKE ?', ["%{$search}%"])
                      ->orWhereRaw('LOWER(esporte) LIKE ?', ["%{$search}%"])
                      ->orWhereRaw('LOWER(descricao) LIKE ?', ["%{$search}%"]);
                })
                ->orWhereHas('instrutor', function ($q) use ($search) {
                    $q->whereRaw('LOWER(nome) LIKE ?', ["%{$search}%"]);
                });
            });
        }

        $query->orderBy('inicio', 'asc');

        $perPage = $request->input('per_page', 50);
        $ocorrencias = $query->paginate($perPage);

        return response()->json([
            'data' => $ocorrencias->items(),
            'meta' => [
                'current_page' => $ocorrencias->currentPage(),
                'last_page' => $ocorrencias->lastPage(),
                'per_page' => $ocorrencias->perPage(),
                'total' => $ocorrencias->total(),
            ],
        ], 200);
    }    /**
     * Gerar ocorrências de uma aula (admin)
     */
    public function gerar(Request $request)
    {
        $validated = $request->validate([
            'id_aula' => 'required|exists:aulas,id_aula',
            'data_inicio' => 'required|date|after_or_equal:today',
            'data_fim' => 'required|date|after:data_inicio',
        ]);

        try {
            $resultado = $this->ocorrenciaService->gerarOcorrencias(
                $validated['id_aula'],
                Carbon::parse($validated['data_inicio']),
                Carbon::parse($validated['data_fim'])
            );

            return response()->json([
                'message' => 'Ocorrências geradas com sucesso',
                'criadas' => $resultado['criadas'],
                'puladas' => $resultado['puladas'],
                'data' => $resultado['ocorrencias'],
            ], 201);
        } catch (\Exception $e) {
            // Propaga motivo real (ex.: "Aula não possui horários configurados") para UX mais clara
            return response()->json([
                'message' => $e->getMessage(),
                'code' => 'GENERATION_ERROR'
            ], 422);
        }
    }

    /**
     * Cancelar uma ocorrência específica
     */
    public function cancelar(int $id)
    {
        $ocorrencia = OcorrenciaAula::findOrFail($id);

        if ($ocorrencia->status === 'cancelada') {
            return response()->json([
                'message' => 'Ocorrência já está cancelada',
            ], 400);
        }

        if ($ocorrencia->inicio < now()) {
            return response()->json([
                'message' => 'Não é possível cancelar ocorrências passadas',
            ], 400);
        }

        $ocorrencia->update(['status' => 'cancelada']);

        // Cancelar inscrições
        $ocorrencia->inscricoes()->where('status', 'inscrito')->update(['status' => 'cancelado']);

        return response()->json([
            'message' => 'Ocorrência cancelada com sucesso',
            'data' => $ocorrencia,
        ], 200);
    }

    /**
     * Obter detalhes de uma ocorrência
     */
    public function show(int $id)
    {
        $ocorrencia = OcorrenciaAula::with(['aula', 'instrutor', 'quadra', 'inscricoes.usuario'])
            ->findOrFail($id);

        return response()->json(['data' => $ocorrencia], 200);
    }

    /**
     * ADMIN: Remover ocorrência (soft delete via status)
     * Remove a ocorrência e todas as inscrições associadas
     */
    public function destroy(int $id)
    {
        $ocorrencia = OcorrenciaAula::findOrFail($id);

        // Verificar se já está cancelada
        if ($ocorrencia->status === 'cancelada') {
            return response()->json([
                'message' => 'Ocorrência já está cancelada',
            ], 400);
        }

        // Soft delete: marcar como cancelada
        $ocorrencia->update(['status' => 'cancelada']);

        // Cancelar todas as inscrições dessa ocorrência
        $inscricoesRemovidas = $ocorrencia->inscricoes()
            ->where('status', 'inscrito')
            ->update(['status' => 'cancelado']);

        return response()->json([
            'message' => 'Ocorrência removida com sucesso',
            'inscricoes_removidas' => $inscricoesRemovidas,
        ], 200);
    }
}

