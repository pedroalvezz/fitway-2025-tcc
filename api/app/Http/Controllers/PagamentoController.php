<?php

namespace App\Http\Controllers;

use App\Models\Cobranca;
use App\Models\CobrancaParcela;
use App\Models\Pagamento;
use App\Services\PagamentoService;
use Illuminate\Http\Request;
use Carbon\Carbon;

class PagamentoController extends Controller
{
    protected $pagamentoService;

    public function __construct(PagamentoService $pagamentoService)
    {
        $this->pagamentoService = $pagamentoService;
    }

    /**
     * ALUNO: Listar minhas cobranças pendentes
     * GET /api/payments/pending
     */
    public function minhasCobrancasPendentes(Request $request)
    {
        $cobrancas = Cobranca::with(['parcelas.pagamentos', 'usuario'])
            ->where('id_usuario', auth()->id())
            ->whereIn('status', ['pendente', 'parcialmente_pago'])
            ->orderBy('vencimento', 'asc')
            ->get();

        return response()->json(['data' => $cobrancas], 200);
    }

    /**
     * ALUNO: Histórico de pagamentos
     * GET /api/payments/history
     */
    public function meuHistorico(Request $request)
    {
        $status = $request->input('status', 'all');

        $query = Cobranca::with(['parcelas.pagamentos', 'usuario'])
            ->where('id_usuario', auth()->id());

        if ($status !== 'all') {
            $query->where('status', $status);
        }

        $cobrancas = $query->orderBy('criado_em', 'desc')->paginate(20);

        return response()->json($cobrancas, 200);
    }

    /**
     * ALUNO: Obter detalhes de uma parcela
     * GET /api/payments/parcelas/{id_parcela}
     */
    public function getParcela($idParcela)
    {
        $parcela = CobrancaParcela::with(['cobranca', 'pagamentos'])
            ->findOrFail($idParcela);

        // Validar que a parcela pertence ao usuário logado
        if ($parcela->cobranca->id_usuario != auth()->id()) {
            return response()->json(['message' => 'Acesso negado'], 403);
        }

        return response()->json(['data' => $parcela], 200);
    }

    /**
     * ALUNO: Criar pagamento para uma parcela (simulação)
     * POST /api/payments/checkout/{id_parcela}
     */
    public function criarCheckout(Request $request, $idParcela)
    {
        $parcela = CobrancaParcela::with('cobranca')->findOrFail($idParcela);

        // Validar que a parcela pertence ao usuário logado
        if ($parcela->cobranca->id_usuario != auth()->id()) {
            return response()->json(['message' => 'Acesso negado'], 403);
        }

        // Validar que parcela está pendente
        if ($parcela->status !== 'pendente') {
            return response()->json(['message' => 'Parcela já foi paga ou cancelada'], 400);
        }

        // Criar pagamento simulado
        $pagamento = $this->pagamentoService->criarPagamentoSimulado($parcela);

        return response()->json([
            'data' => $pagamento,
            'message' => 'Pagamento criado! Agora você pode aprovar a simulação.',
        ], 201);
    }

    /**
     * ALUNO: Criar cobrança manual (para teste)
     * POST /api/payments/create-charge
     */
    public function criarCobrancaManual(Request $request)
    {
        $request->validate([
            'descricao' => 'required|string|max:255',
            'valor' => 'required|numeric|min:0.01',
            'vencimento' => 'required|date|after_or_equal:today',
            'observacoes' => 'nullable|string|max:500',
        ]);

        // Criar cobrança com tipo 'manual'
        $cobranca = $this->pagamentoService->criarCobranca(
            auth()->id(),
            'manual', // tipo fictício para cobranças manuais
            null, // sem referência
            (float) $request->valor,
            (string) $request->descricao,
            Carbon::parse($request->vencimento)
        );

        // Adicionar observações se houver
        if ($request->observacoes) {
            $cobranca->update(['observacoes' => $request->observacoes]);
        }

        return response()->json([
            'data' => $cobranca->load('parcelas'),
            'message' => 'Cobrança criada com sucesso!',
        ], 201);
    }

    /**
     * ALUNO: Aprovar pagamento simulado
     * POST /api/payments/{id_pagamento}/approve
     */
    public function aprovarSimulacao(Request $request, $idPagamento)
    {
        $pagamento = Pagamento::with('parcela.cobranca')->findOrFail($idPagamento);

        // Validar que pertence ao usuário
        if ($pagamento->parcela->cobranca->id_usuario != auth()->id()) {
            return response()->json(['message' => 'Acesso negado'], 403);
        }

        // Validar que é simulação
        if ($pagamento->provedor !== 'simulacao') {
            return response()->json(['message' => 'Só pagamentos simulados podem ser aprovados por aqui'], 400);
        }

        // Validar status
        if ($pagamento->status !== 'pendente') {
            return response()->json(['message' => 'Pagamento já foi processado'], 400);
        }

        // Aprovar
        $this->pagamentoService->aprovarPagamentoSimulado($pagamento);

        return response()->json([
            'message' => 'Pagamento aprovado com sucesso!',
            'data' => $pagamento->fresh(['parcela.cobranca']),
        ], 200);
    }

    /**
     * ALUNO: Criar checkout Mercado Pago para uma parcela
     * POST /api/payments/checkout/mp/{id_parcela}
     */
    public function criarCheckoutMercadoPago(Request $request, $idParcela)
    {
        $parcela = CobrancaParcela::with('cobranca')->findOrFail($idParcela);

        // Validar owner
        if ($parcela->cobranca->id_usuario != auth()->id()) {
            return response()->json(['message' => 'Acesso negado'], 403);
        }

        if ($parcela->status !== 'pendente') {
            return response()->json(['message' => 'Parcela já foi paga ou cancelada'], 400);
        }

        // Criar preferência no MP
        $mpToken = config('services.mercadopago.access_token');
        if (!$mpToken) {
            return response()->json(['message' => 'Mercado Pago não configurado'], 500);
        }

        $notificationUrl = config('services.mercadopago.notification_url')
            ?: (config('app.url') . '/api/webhooks/mercadopago');

        $body = [
            'items' => [[
                'title' => $parcela->cobranca->descricao,
                'quantity' => 1,
                'currency_id' => 'BRL',
                'unit_price' => (float) $parcela->valor,
            ]],
            'payer' => [
                // ideal: enviar email do usuário
            ],
            'external_reference' => (string) $parcela->id_parcela,
            'notification_url' => $notificationUrl,
            'payment_methods' => [
                'excluded_payment_types' => [], // permitir cartão
                'installments' => 1,
            ],
            'auto_return' => 'approved',
            'back_urls' => [
                'success' => config('services.mercadopago.frontend_url') . '/aluno/pagamentos',
                'failure' => config('services.mercadopago.frontend_url') . '/aluno/pagamentos',
                'pending' => config('services.mercadopago.frontend_url') . '/aluno/pagamentos',
            ],
        ];

        $ch = curl_init('https://api.mercadopago.com/checkout/preferences');
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $mpToken,
            'Content-Type: application/json'
        ]);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        $result = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode < 200 || $httpCode >= 300) {
            return response()->json(['message' => 'Erro ao criar checkout MP', 'details' => $result], 500);
        }

        $data = json_decode($result, true);
        $initPoint = $data['init_point'] ?? $data['sandbox_init_point'] ?? null;
        if (!$initPoint) {
            return response()->json(['message' => 'Retorno inválido do MP'], 500);
        }

        // Registrar pagamento pendente vinculado à parcela
        $pagamento = Pagamento::create([
            'id_parcela' => $parcela->id_parcela,
            'provedor' => 'mercadopago',
            'metodo' => 'pix', // o MP permite Pix/Cartão; aqui marcamos genericamente
            'valor' => (float) $parcela->valor,
            'status' => 'pendente',
            'url_checkout' => $initPoint,
            'payload_json' => [ 'preference' => $data ],
        ]);

        return response()->json([
            'data' => [
                'pagamento' => $pagamento,
                'url_checkout' => $initPoint,
            ]
        ], 201);
    }

    /**
     * ADMIN: Listar todas cobranças
     * GET /api/admin/payments
     */
    public function index(Request $request)
    {
        $status = $request->input('status', 'all');
        $tipo = $request->input('tipo', 'all');
        $search = $request->input('search');

        $query = Cobranca::with(['usuario', 'parcelas.pagamentos']);

        if ($status !== 'all') {
            $query->where('status', $status);
        }

        if ($tipo !== 'all') {
            $query->where('referencia_tipo', $tipo);
        }

        if ($search) {
            $query->where(function ($q) use ($search) {
                // Buscar por nome ou email do usuário
                $q->whereHas('usuario', function ($uq) use ($search) {
                    $uq->where('nome', 'ILIKE', '%' . $search . '%')
                       ->orWhere('email', 'ILIKE', '%' . $search . '%');
                })
                // Também buscar pela descrição da cobrança
                ->orWhere('descricao', 'ILIKE', '%' . $search . '%')
                // Caso digite um número exato, permitir bater com referencia_id
                ->orWhere(function ($rq) use ($search) {
                    if (is_numeric($search)) {
                        $rq->where('referencia_id', (int) $search);
                    }
                });
            });
        }

        $cobrancas = $query->orderBy('criado_em', 'desc')->paginate(50);

        return response()->json($cobrancas, 200);
    }

    /**
     * ADMIN: Ver detalhes de uma cobrança
     * GET /api/admin/payments/{id}
     */
    public function show($id)
    {
        $cobranca = Cobranca::with(['usuario', 'parcelas.pagamentos'])->findOrFail($id);
        return response()->json(['data' => $cobranca], 200);
    }

    /**
     * ADMIN: Gerar link de checkout Mercado Pago para uma cobrança pendente
     * POST /api/admin/payments/{id}/create-checkout
     */
    public function adminCreateCheckout(Request $request, $id)
    {
        $cobranca = Cobranca::with('parcelas')->findOrFail($id);

        if (!in_array($cobranca->status, ['pendente', 'parcialmente_pago'])) {
            return response()->json(['message' => 'Cobrança não está pendente'], 400);
        }

        // pegar primeira parcela pendente
        $parcela = $cobranca->parcelas->where('status', 'pendente')->sortBy('numero_parcela')->first();
        if (!$parcela) {
            return response()->json(['message' => 'Nenhuma parcela pendente para gerar link'], 400);
        }

        // Delegar para o método de aluno (mesma lógica)
        // Forçar auth user como dono para reuso? Em admin vamos só criar via token MP, sem check owner
        $mpToken = config('services.mercadopago.access_token');
        if (!$mpToken) {
            return response()->json(['message' => 'Mercado Pago não configurado'], 500);
        }

        $notificationUrl = config('services.mercadopago.notification_url')
            ?: (config('app.url') . '/api/webhooks/mercadopago');

        $body = [
            'items' => [[
                'title' => $cobranca->descricao,
                'quantity' => 1,
                'currency_id' => 'BRL',
                'unit_price' => (float) $parcela->valor,
            ]],
            'external_reference' => (string) $parcela->id_parcela,
            'notification_url' => $notificationUrl,
            'payment_methods' => [ 'excluded_payment_types' => [], 'installments' => 1 ],
            'auto_return' => 'approved',
            'back_urls' => [
                'success' => config('services.mercadopago.frontend_url') . '/aluno/pagamentos',
                'failure' => config('services.mercadopago.frontend_url') . '/aluno/pagamentos',
                'pending' => config('services.mercadopago.frontend_url') . '/aluno/pagamentos',
            ],
        ];

        $ch = curl_init('https://api.mercadopago.com/checkout/preferences');
        curl_setopt($ch, CURLOPT_HTTPHEADER, [ 'Authorization: Bearer ' . $mpToken, 'Content-Type: application/json' ]);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        $result = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode < 200 || $httpCode >= 300) {
            return response()->json(['message' => 'Erro ao criar checkout MP', 'details' => $result], 500);
        }

        $data = json_decode($result, true);
        $initPoint = $data['init_point'] ?? $data['sandbox_init_point'] ?? null;
        if (!$initPoint) {
            return response()->json(['message' => 'Retorno inválido do MP'], 500);
        }

        // Registrar pagamento pendente vinculado à parcela
        $pagamento = Pagamento::create([
            'id_parcela' => $parcela->id_parcela,
            'provedor' => 'mercadopago',
            'metodo' => 'pix',
            'valor' => (float) $parcela->valor,
            'status' => 'pendente',
            'url_checkout' => $initPoint,
            'payload_json' => [ 'preference' => $data ],
        ]);

        return response()->json(['data' => ['url_checkout' => $initPoint, 'pagamento' => $pagamento]], 201);
    }

    /**
     * ADMIN: Marcar cobrança como paga manualmente (aprovação imediata via simulação)
     * POST /api/admin/payments/{id}/mark-paid
     */
    public function adminMarkAsPaid(Request $request, $id)
    {
        $cobranca = Cobranca::with('parcelas')->findOrFail($id);

        if (!in_array($cobranca->status, ['pendente', 'parcialmente_pago'])) {
            return response()->json(['message' => 'Cobrança não está pendente'], 400);
        }

        // Pegar primeira parcela pendente
        $parcela = $cobranca->parcelas->where('status', 'pendente')->sortBy('numero_parcela')->first();
        if (!$parcela) {
            return response()->json(['message' => 'Nenhuma parcela pendente para marcar como paga'], 400);
        }

        // Criar pagamento simulado e aprovar (reutiliza lógica centralizada: atualiza parcela/cobrança e confirma recurso)
        $pagamento = $this->pagamentoService->criarPagamentoSimulado($parcela);
        $this->pagamentoService->aprovarPagamentoSimulado($pagamento);

        return response()->json(['data' => $cobranca->fresh(['usuario', 'parcelas.pagamentos'])], 200);
    }

    /**
     * ADMIN: Criar cobrança manual para um usuário
     * POST /api/admin/payments
     */
    public function store(Request $request)
    {
        $request->validate([
            'id_usuario' => 'required|exists:usuarios,id_usuario',
            'referencia_tipo' => 'required|in:assinatura,reserva_quadra,sessao_personal,inscricao_aula,manual',
            'referencia_id' => 'nullable|integer',
            'valor_total' => 'required|numeric|min:0.01',
            'descricao' => 'required|string|max:255',
            'vencimento' => 'required|date|after_or_equal:today',
            'observacoes' => 'nullable|string|max:500',
        ]);

        $tipo = $request->input('referencia_tipo');
        $idRef = $request->input('referencia_id');

        // Para tipo diferente de 'manual', referencia_id é obrigatória
        if ($tipo !== 'manual' && empty($idRef)) {
            return response()->json([
                'message' => 'Dados inválidos',
                'errors' => ['referencia_id' => ['referencia_id é obrigatório para este tipo']]
            ], 422);
        }

        $cobranca = $this->pagamentoService->criarCobranca(
            (int) $request->id_usuario,
            $tipo,
            $idRef ? (int) $idRef : null,
            (float) $request->valor_total,
            (string) $request->descricao,
            \Carbon\Carbon::parse($request->vencimento)
        );

        if ($request->filled('observacoes')) {
            $cobranca->update(['observacoes' => $request->observacoes]);
        }

        return response()->json(['data' => $cobranca->load(['usuario', 'parcelas'])], 201);
    }

    /**
     * ADMIN: Atualizar cobrança (somente campos livres; não muda relacionamentos já pagos)
     * PUT/PATCH /api/admin/payments/{id}
     */
    public function update(Request $request, $id)
    {
        $cobranca = Cobranca::with('parcelas.pagamentos')->findOrFail($id);

        // Se já paga, permitir apenas observações
        if ($cobranca->status === 'pago') {
            $request->validate([
                'observacoes' => 'nullable|string|max:500',
            ]);
            $cobranca->update($request->only('observacoes'));
            return response()->json(['data' => $cobranca->fresh(['usuario', 'parcelas.pagamentos'])], 200);
        }

        $request->validate([
            'descricao' => 'sometimes|required|string|max:255',
            'valor_total' => 'sometimes|required|numeric|min:0.01',
            'vencimento' => 'sometimes|required|date|after_or_equal:today',
            'status' => 'sometimes|required|in:pendente,parcialmente_pago,pago,cancelado,estornado',
            'observacoes' => 'nullable|string|max:500',
        ]);

        $payload = [];
        if ($request->has('descricao')) $payload['descricao'] = $request->descricao;
        if ($request->has('observacoes')) $payload['observacoes'] = $request->observacoes;
        if ($request->has('vencimento')) $payload['vencimento'] = $request->vencimento;

        // Atualizar valor exige ajustar parcela quando ainda pendente
        if ($request->has('valor_total')) {
            if (!in_array($cobranca->status, ['pendente', 'parcialmente_pago'])) {
                return response()->json(['message' => 'Não é possível alterar valor desta cobrança'], 400);
            }
            $novoValor = (float) $request->valor_total;
            $payload['valor_total'] = $novoValor;
        }

        // Atualizar status manualmente (admin)
        if ($request->has('status')) {
            $payload['status'] = $request->status;
        }

        \DB::transaction(function () use ($cobranca, $payload, $request) {
            $cobranca->update($payload);

            // Se alterou valor_total, refletir na primeira parcela pendente
            if ($request->has('valor_total')) {
                $parcela = $cobranca->parcelas->first();
                if ($parcela && $parcela->status === 'pendente') {
                    $parcela->update(['valor' => (float) $request->valor_total]);
                }
            }
        });

        return response()->json(['data' => $cobranca->fresh(['usuario', 'parcelas.pagamentos'])], 200);
    }

    /**
     * ADMIN: Remover (cancelar) cobrança
     * DELETE /api/admin/payments/{id}
     */
    public function destroy($id)
    {
        $cobranca = Cobranca::with('parcelas.pagamentos')->findOrFail($id);

        if (in_array($cobranca->status, ['pago', 'estornado'])) {
            return response()->json(['message' => 'Cobrança já processada não pode ser removida'], 400);
        }

        // Cancelar cobrança e suas parcelas/pagamentos pendentes
        \DB::transaction(function () use ($cobranca) {
            // Cancelar pagamentos pendentes
            foreach ($cobranca->parcelas as $parcela) {
                foreach ($parcela->pagamentos ?? [] as $pg) {
                    if (in_array($pg->status, ['pendente', 'processando'])) {
                        $pg->update(['status' => 'cancelado']);
                    }
                }
                if ($parcela->status === 'pendente') {
                    $parcela->update(['status' => 'cancelado']);
                }
            }
            $cobranca->update(['status' => 'cancelado']);
        });

        return response()->json(null, 204);
    }
}
