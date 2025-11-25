<?php

namespace App\Http\Controllers;

use App\Models\Aula;
use Illuminate\Http\Request;

class AulaController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = Aula::query();

        // Filtrar status (excluir "inativa" por padrão no admin, mas permitir buscar)
        if ($request->has('status')) {
            if ($request->status === 'all') {
                // Não filtrar, mostrar todas
            } else {
                $query->where('status', $request->status);
            }
        } else {
            // Padrão: apenas ativas
            $query->where('status', 'ativa');
        }

        // Filtro por esporte
        if ($request->filled('esporte')) {
            $query->where('esporte', $request->esporte);
        }

        // Filtro por nível
        if ($request->filled('nivel')) {
            $query->where('nivel', $request->nivel);
        }

        // Busca abrangente (nome, esporte, nível)
        if ($request->filled('search')) {
            $term = trim($request->search);
            $slug = str_replace(' ', '_', strtolower($term));
            $query->where(function ($q) use ($term, $slug) {
                $q->where('nome', 'ILIKE', '%' . $term . '%')
                  ->orWhere('esporte', 'ILIKE', '%' . $slug . '%')
                  ->orWhere('nivel', 'ILIKE', '%' . strtolower($term) . '%');
            });
        }

        // Ordenação
        $sortBy = $request->input('sort_by', 'nome');
        $sortOrder = $request->input('sort_order', 'asc');
        $query->orderBy($sortBy, $sortOrder);

        // Eager loading de relacionamentos
        $query->withCount(['horarios', 'ocorrencias', 'inscricoes']);

        $perPage = $request->input('per_page', 15);
        $aulas = $query->paginate($perPage);

        return response()->json([
            'data' => $aulas->items(),
            'meta' => [
                'current_page' => $aulas->currentPage(),
                'last_page' => $aulas->lastPage(),
                'per_page' => $aulas->perPage(),
                'total' => $aulas->total(),
            ],
        ], 200);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'nome' => 'required|string|max:255',
            'esporte' => 'required|string|max:100',
            'nivel' => 'nullable|string|in:iniciante,intermediario,avancado',
            'duracao_min' => 'required|integer|min:15|max:240',
            'capacidade_max' => 'required|integer|min:1|max:50',
            'preco_unitario' => 'nullable|numeric|min:0',
            'descricao' => 'nullable|string|max:1000',
            'requisitos' => 'nullable|string|max:500',
            'status' => 'nullable|string|in:ativa,inativa',
        ]);

        $aula = Aula::create($validated);

        return response()->json(['data' => $aula], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(int $id)
    {
        // Inclui contagem de horários para permitir bloqueio de geração de ocorrências no frontend
        $aula = Aula::with(['horarios.instrutor', 'horarios.quadra'])
            ->withCount(['horarios', 'ocorrencias', 'inscricoes'])
            ->findOrFail($id);

        return response()->json(['data' => $aula], 200);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, int $id)
    {
        $aula = Aula::findOrFail($id);

        $validated = $request->validate([
            'nome' => 'sometimes|required|string|max:255',
            'esporte' => 'sometimes|required|string|max:100',
            'nivel' => 'nullable|string|in:iniciante,intermediario,avancado',
            'duracao_min' => 'sometimes|required|integer|min:15|max:240',
            'capacidade_max' => 'sometimes|required|integer|min:1|max:50',
            'preco_unitario' => 'nullable|numeric|min:0',
            'descricao' => 'nullable|string|max:1000',
            'requisitos' => 'nullable|string|max:500',
            'status' => 'nullable|string|in:ativa,inativa',
        ]);

        $aula->update($validated);

        return response()->json(['data' => $aula], 200);
    }

    /**
     * Remove the specified resource from storage.
     * ⚠️ SOFT DELETE: Marca como "inativa" em vez de deletar
     */
    public function destroy(int $id)
    {
        $aula = Aula::findOrFail($id);

        // Soft delete: marcar como inativa
        $aula->update(['status' => 'inativa']);

        return response()->json(null, 204);
    }
}

