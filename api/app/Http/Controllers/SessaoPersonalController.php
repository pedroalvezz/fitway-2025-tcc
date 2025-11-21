<?php

namespace App\Http\Controllers;

use App\Models\SessaoPersonal;
use App\Models\Cobranca;
use App\Http\Requests\CreateSessaoPersonalRequest;
use App\Http\Requests\UpdateSessaoPersonalRequest;
use App\Services\SessaoPersonalService;
use Illuminate\Http\Request;

class SessaoPersonalController extends Controller
{
    protected $service;

    public function __construct(SessaoPersonalService $service)
    {
        $this->service = $service;
    }

    /**
     * Listar sessões (com filtros)
     * GET /api/personal-sessions
     */
    public function index(Request $request)
    {
        $query = SessaoPersonal::with(['instrutor.usuario', 'usuario', 'quadra']);

        // Filtrar por instrutor
        if ($request->has('id_instrutor')) {
            $query->where('id_instrutor', $request->id_instrutor);
        }

        // Filtrar por aluno
        if ($request->has('id_usuario')) {
            $query->where('id_usuario', $request->id_usuario);
        }

        // Filtrar por status
        if ($request->has('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        // Filtrar por período (futuras/passadas)
        if ($request->has('periodo')) {
            if ($request->periodo === 'futuras') {
                $query->futuras();
            } elseif ($request->periodo === 'passadas') {
                $query->passadas();
            }
        }

        // Ordenar por data de início (mais recentes primeiro)
        $query->orderBy('inicio', 'desc');

        $sessoes = $query->paginate($request->get('per_page', 15));

        return response()->json($sessoes, 200);
    }

    /**
     * Buscar sessão específica
     * GET /api/personal-sessions/{id}
     */
    public function show($id)
    {
        $sessao = SessaoPersonal::with(['instrutor.usuario', 'usuario', 'quadra'])
            ->findOrFail($id);

        return response()->json(['data' => $sessao], 200);
    }

    /**
     * Criar nova sessão
     * POST /api/personal-sessions
     */
    public function store(CreateSessaoPersonalRequest $request)
    {
        try {
            $sessao = $this->service->criarSessao($request->validated());
            $sessao->load(['instrutor.usuario', 'usuario', 'quadra']);

            // Retornar sessão + cobrança (se criada)
            $response = ['data' => $sessao];
            if (isset($sessao->cobranca)) {
                $response['cobranca'] = $sessao->cobranca;
                $response['message'] = 'Sessão criada! Realize o pagamento para confirmá-la.';
            }

            return response()->json($response, 201);
        } catch (\Exception $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'code' => 'VALIDATION_ERROR'
            ], 422);
        }
    }

    /**
     * Atualizar sessão
     * PUT/PATCH /api/personal-sessions/{id}
     */
    public function update(UpdateSessaoPersonalRequest $request, $id)
    {
        $sessao = SessaoPersonal::findOrFail($id);

        try {
            $sessaoAtualizada = $this->service->atualizarSessao($sessao, $request->validated());
            $sessaoAtualizada->load(['instrutor.usuario', 'usuario', 'quadra']);

            return response()->json(['data' => $sessaoAtualizada], 200);
        } catch (\Exception $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'code' => 'VALIDATION_ERROR'
            ], 422);
        }
    }

    /**
     * Cancelar sessão
     * DELETE /api/personal-sessions/{id}
     *
     * Atualiza status para 'cancelada' (soft delete)
     * A reserva de quadra vinculada também é cancelada automaticamente via Service
     * A cobrança vinculada também é cancelada (se ainda não foi paga)
     */
    public function destroy($id)
    {
        $sessao = SessaoPersonal::findOrFail($id);

        // Verifica se tem cobrança não paga antes de cancelar
        $cobranca = Cobranca::where('referencia_tipo', 'sessao_personal')
            ->where('referencia_id', $sessao->id_sessao_personal)
            ->where('status', '!=', 'pago')
            ->first();

        // Usar service para cancelar sessão + cobrança
        $this->service->cancelarSessaoComCobranca($sessao);

        return response()->json([
            'data' => [
                'id_sessao_personal' => (string) $sessao->id_sessao_personal,
                'status' => 'cancelada',
                'cobranca_cancelada' => $cobranca ? true : false,
            ],
            'message' => $cobranca
                ? 'Sessão e cobrança canceladas com sucesso'
                : 'Sessão cancelada com sucesso',
        ], 200);
    }

    /**
     * Confirmar sessão
     * PATCH /api/personal-sessions/{id}/confirm
     */
    public function confirm($id)
    {
        $sessao = SessaoPersonal::findOrFail($id);
        $sessao->update(['status' => 'confirmada']);
        $sessao->load(['instrutor.usuario', 'usuario', 'quadra']);

        return response()->json(['data' => $sessao], 200);
    }

    /**
     * Verificar disponibilidade de um instrutor e quadra (se informada)
     * POST /api/personal-sessions/check-availability
     */
    public function checkAvailability(Request $request)
    {
        $request->validate([
            'id_instrutor' => 'required|exists:instrutores,id_instrutor',
            'inicio' => 'required|date',
            'fim' => 'required|date|after:inicio',
            'id_quadra' => 'nullable|exists:quadras,id_quadra',
        ]);

        $inicio = \Carbon\Carbon::parse($request->inicio);
        $fim = \Carbon\Carbon::parse($request->fim);
        $idQuadra = $request->id_quadra ?? null;

        $resultado = $this->service->validarDisponibilidade(
            $request->id_instrutor,
            $inicio,
            $fim,
            $idQuadra
        );

        if ($resultado['disponivel']) {
            $preco = $this->service->calcularPreco($request->id_instrutor, $inicio, $fim);
            return response()->json([
                'disponivel' => true,
                'preco_total' => $preco
            ], 200);
        }

        return response()->json([
            'disponivel' => false,
            'motivo' => $resultado['motivo']
        ], 200);
    }

    /**
     * Obter sessões do instrutor logado
     * GET /api/personal-sessions/me
     */
    public function mySessions(Request $request)
    {
        $user = auth()->user();

        // Buscar instrutor associado ao usuário
        $instrutor = \App\Models\Instrutor::where('id_usuario', $user->id_usuario)->first();

        if (!$instrutor) {
            return response()->json([
                'message' => 'Instrutor não encontrado para este usuário',
            ], 404);
        }

        $query = SessaoPersonal::with(['instrutor.usuario', 'usuario', 'quadra'])
            ->where('id_instrutor', $instrutor->id_instrutor);

        // Filtrar por status
        if ($request->has('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        // Filtrar por período
        if ($request->has('periodo')) {
            if ($request->periodo === 'futuras') {
                $query->futuras();
            } elseif ($request->periodo === 'passadas') {
                $query->passadas();
            }
        }

        // Ordenar por data de início (mais recentes primeiro)
        $query->orderBy('inicio', 'desc');

        $sessoes = $query->paginate($request->get('per_page', 15));

        return response()->json($sessoes, 200);
    }

    /**
     * Minhas sessões como ALUNO (não instrutor!)
     * GET /api/personal-sessions/me (quando aluno está logado)
     *
     * Retorna APENAS as sessões onde o usuário é o ALUNO
     * (não as sessões que ele ministra como instrutor)
     */
    public function myStudentSessions(Request $request)
    {
        $user = auth()->user();

        // Buscar sessões do aluno logado (onde id_usuario = auth()->id())
        $query = SessaoPersonal::with(['instrutor.usuario', 'usuario', 'quadra'])
            ->where('id_usuario', $user->id_usuario);

        // Filtrar por status (excluir canceladas por padrão)
        if ($request->has('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        } else {
            // Por padrão, não mostrar canceladas
            $query->where('status', '!=', 'cancelada');
        }

        // Filtrar por período
        if ($request->has('periodo')) {
            if ($request->periodo === 'futuras') {
                $query->where('inicio', '>=', now());
            } elseif ($request->periodo === 'passadas') {
                $query->where('inicio', '<', now());
            }
        }

        // Ordenar por data de início (mais próximas primeiro)
        $query->orderBy('inicio', 'asc');

        $sessoes = $query->paginate($request->get('per_page', 15));

        return response()->json($sessoes, 200);
    }

    /**
     * Obter todos os horários disponíveis de um instrutor para um dia específico
     * GET /api/personal-sessions/availability/daily/{id_instrutor}?date=YYYY-MM-DD
     *
     * Retorna:
     * - horarios_disponiveis: Array de slots de 30min disponíveis
     * - horarios_ocupados: Array de slots já reservados
     * - data: Data solicitada
     * - instrutor_nome: Nome do instrutor
     */
    public function getDailyAvailability(Request $request, $id_instrutor)
    {
        $request->validate([
            'date' => 'required|date_format:Y-m-d',
        ]);

        // Buscar instrutor (com eager loading de usuario)
        $instrutor = \App\Models\Instrutor::with('usuario')
            ->find($id_instrutor);

        // Verificar se instrutor existe
        if (!$instrutor) {
            return response()->json([
                'message' => 'Instrutor não encontrado',
                'horarios_disponiveis' => [],
                'horarios_ocupados' => [],
            ], 404);
        }

        // Verificar se instrutor tem usuário associado
        $instrutorNome = $instrutor->usuario?->nome ?? 'Instrutor #' . $instrutor->id_instrutor;

        $data = \Carbon\Carbon::parse($request->date)->startOfDay();

        // Verificar se a data é anterior a hoje (permitir hoje)
        if ($data->lt(\Carbon\Carbon::today())) {
            return response()->json([
                'message' => 'A data deve ser a partir de hoje',
                'horarios_disponiveis' => [],
                'horarios_ocupados' => [],
                'data' => $data->format('Y-m-d'),
                'instrutor_nome' => $instrutorNome,
            ], 200);
        }

        // 1. Buscar disponibilidade semanal do instrutor para este dia da semana
        // Usar dayOfWeekIso (1=Segunda ... 7=Domingo) para alinhar com a tabela disponibilidade_instrutor
        $diaSemana = $data->dayOfWeekIso;

        $disponibilidadeSemanal = \App\Models\DisponibilidadeInstrutor::where('id_instrutor', $id_instrutor)
            ->where('dia_semana', $diaSemana)
            ->first();

        if (!$disponibilidadeSemanal) {
            return response()->json([
                'message' => 'Instrutor não tem disponibilidade neste dia da semana',
                'horarios_disponiveis' => [],
                'horarios_ocupados' => [],
                'data' => $data->format('Y-m-d'),
                'instrutor_nome' => $instrutorNome,
            ], 200);
        }

        // 2. Gerar todos os slots de 30 minutos dentro da disponibilidade semanal
        $horaInicio = \Carbon\Carbon::parse($disponibilidadeSemanal->hora_inicio);
        $horaFim = \Carbon\Carbon::parse($disponibilidadeSemanal->hora_fim);

        $slots = [];
        $current = $horaInicio->clone();
        while ($current->lt($horaFim)) {
            $slots[] = [
                'inicio' => $current->format('H:i'),
                'fim' => $current->addMinutes(30)->format('H:i'),
            ];
        }

        // 3. Buscar sessões já agendadas neste dia para este instrutor
        $dataInicio = $data->clone()->startOfDay();
        $dataFim = $data->clone()->endOfDay();

        $sessoesAgendadas = SessaoPersonal::where('id_instrutor', $id_instrutor)
            ->whereBetween('inicio', [$dataInicio, $dataFim])
            ->where('status', '!=', 'cancelada')
            ->get();

        // 4. Dividir slots em disponíveis e ocupados
        $horariosDisponiveis = [];
        $horariosOcupados = [];

        foreach ($slots as $slot) {
            $slotInicio = $data->clone()->setTimeFromTimeString($slot['inicio']);
            $slotFim = $data->clone()->setTimeFromTimeString($slot['fim']);

            // Verificar se há sobreposição com alguma sessão agendada
            $temConflito = $sessoesAgendadas->some(function ($sessao) use ($slotInicio, $slotFim) {
                return !($slotFim <= $sessao->inicio || $slotInicio >= $sessao->fim);
            });

            if ($temConflito) {
                $horariosOcupados[] = [
                    'inicio' => $slot['inicio'],
                    'fim' => $slot['fim'],
                    'inicio_iso' => $slotInicio->toIso8601String(),
                    'fim_iso' => $slotFim->toIso8601String(),
                ];
            } else {
                $horariosDisponiveis[] = [
                    'inicio' => $slot['inicio'],
                    'fim' => $slot['fim'],
                    'inicio_iso' => $slotInicio->toIso8601String(),
                    'fim_iso' => $slotFim->toIso8601String(),
                ];
            }
        }

        return response()->json([
            'data' => $data->format('Y-m-d'),
            'instrutor_nome' => $instrutorNome,
            'instrutor_id' => (string) $instrutor->id_instrutor,
            'horarios_disponiveis' => $horariosDisponiveis,
            'horarios_ocupados' => $horariosOcupados,
            'total_slots' => count($slots),
            'total_disponiveis' => count($horariosDisponiveis),
            'total_ocupados' => count($horariosOcupados),
        ], 200);
    }
}
