<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class DashboardController extends Controller
{
    /**
     * Dashboard do Admin - Estatísticas gerais do sistema
     */
    public function adminDashboard()
    {
        $now = Carbon::now();
        $startOfMonth = $now->copy()->startOfMonth();
        $endOfMonth = $now->copy()->endOfMonth();

        // Total de usuários ativos
        $totalUsuarios = DB::table('usuarios')
            ->where('status', 'ativo')
            ->count();

        $totalAlunos = DB::table('usuarios')
            ->where('papel', 'aluno')
            ->where('status', 'ativo')
            ->count();

        $totalInstrutores = DB::table('instrutores')
            ->where('status', 'ativo')
            ->count();

        // Reservas de quadra
        $reservasHoje = DB::table('reservas_quadra')
            ->whereDate('inicio', $now->toDateString())
            ->whereIn('status', ['pendente', 'confirmada'])
            ->count();

        $reservasMes = DB::table('reservas_quadra')
            ->whereBetween('inicio', [$startOfMonth, $endOfMonth])
            ->whereIn('status', ['pendente', 'confirmada'])
            ->count();

        $totalReservas = DB::table('reservas_quadra')
            ->whereIn('status', ['pendente', 'confirmada'])
            ->count();

        // Sessões Personal
        $sessoesHoje = DB::table('sessoes_personal')
            ->whereDate('inicio', $now->toDateString())
            ->whereIn('status', ['pendente', 'confirmada'])
            ->count();

        $sessoesMes = DB::table('sessoes_personal')
            ->whereBetween('inicio', [$startOfMonth, $endOfMonth])
            ->whereIn('status', ['pendente', 'confirmada'])
            ->count();

        // Aulas ativas
        $totalAulas = DB::table('aulas')
            ->where('status', 'ativa')
            ->count();

        // Contagem de inscrições ativas: usar o status real 'inscrito'
        $inscricoesAtivas = DB::table('inscricoes_aula')
            ->where('status', 'inscrito')
            ->count();

        // Receita do mês (pagamentos aprovados)
        $receitaMes = DB::table('pagamentos')
            ->where('status', 'aprovado')
            ->whereBetween('criado_em', [$startOfMonth, $endOfMonth])
            ->sum('valor');

        // Assinaturas ativas
        $assinaturasAtivas = DB::table('assinaturas')
            ->where('status', 'ativa')
            ->count();

        // Quadras disponíveis
        $quadrasAtivas = DB::table('quadras')
            ->where('status', 'ativa')
            ->count();

        // Próximas reservas (hoje e amanhã)
        $proximasReservas = DB::table('reservas_quadra as r')
            ->join('quadras as q', 'r.id_quadra', '=', 'q.id_quadra')
            ->join('usuarios as u', 'r.id_usuario', '=', 'u.id_usuario')
            ->select(
                'r.id_reserva_quadra',
                'q.nome as quadra_nome',
                'u.nome as usuario_nome',
                'r.inicio',
                'r.fim',
                'r.status'
            )
            ->where('r.inicio', '>=', $now)
            ->where('r.inicio', '<=', $now->copy()->addDays(1)->endOfDay())
            ->whereIn('r.status', ['pendente', 'confirmada'])
            ->orderBy('r.inicio')
            ->limit(5)
            ->get();

        return response()->json([
            'data' => [
                'usuarios' => [
                    'total' => $totalUsuarios,
                    'alunos' => $totalAlunos,
                    'instrutores' => $totalInstrutores,
                ],
                'reservas' => [
                    'hoje' => $reservasHoje,
                    'mes' => $reservasMes,
                    'total' => $totalReservas,
                ],
                'sessoes_personal' => [
                    'hoje' => $sessoesHoje,
                    'mes' => $sessoesMes,
                ],
                'aulas' => [
                    'total' => $totalAulas,
                    'inscricoes_ativas' => $inscricoesAtivas,
                ],
                'financeiro' => [
                    'receita_mes' => (float) $receitaMes,
                    'assinaturas_ativas' => $assinaturasAtivas,
                ],
                'quadras' => [
                    'ativas' => $quadrasAtivas,
                ],
                'proximas_reservas' => $proximasReservas,
            ]
        ], 200);
    }

    /**
     * Dashboard do Aluno - Estatísticas pessoais
     */
    public function studentDashboard(Request $request)
    {
        $usuario = $request->user();
        $now = Carbon::now();
        $startOfMonth = $now->copy()->startOfMonth();

        // Minhas reservas de quadra
        $minhasReservas = DB::table('reservas_quadra')
            ->where('id_usuario', $usuario->id_usuario)
            ->whereIn('status', ['pendente', 'confirmada'])
            ->count();

        $reservasHoje = DB::table('reservas_quadra')
            ->where('id_usuario', $usuario->id_usuario)
            ->whereDate('inicio', $now->toDateString())
            ->whereIn('status', ['pendente', 'confirmada'])
            ->count();

        $reservasMes = DB::table('reservas_quadra')
            ->where('id_usuario', $usuario->id_usuario)
            ->whereBetween('inicio', [$startOfMonth, $now])
            ->whereIn('status', ['pendente', 'confirmada'])
            ->count();

        // Minhas sessões personal
        $minhasSessoes = DB::table('sessoes_personal')
            ->where('id_usuario', $usuario->id_usuario)
            ->whereIn('status', ['pendente', 'confirmada'])
            ->count();

        $sessoesMes = DB::table('sessoes_personal')
            ->where('id_usuario', $usuario->id_usuario)
            ->whereBetween('inicio', [$startOfMonth, $now])
            ->whereIn('status', ['pendente', 'confirmada'])
            ->count();

        // Minhas inscrições em aulas
        // Contar inscrições do usuário que estão ativas (status 'inscrito')
        $minhasInscricoes = DB::table('inscricoes_aula')
            ->where('id_usuario', $usuario->id_usuario)
            ->where('status', 'inscrito')
            ->count();

        // Minha assinatura
        $assinatura = DB::table('assinaturas as a')
            ->join('planos as p', 'a.id_plano', '=', 'p.id_plano')
            ->where('a.id_usuario', $usuario->id_usuario)
            ->where('a.status', 'ativa')
            ->select('p.nome', 'a.data_inicio', 'a.proximo_vencimento')
            ->first();

        // Pagamentos pendentes
        $pagamentosPendentes = DB::table('pagamentos as p')
            ->join('cobranca_parcelas as cp', 'p.id_parcela', '=', 'cp.id_parcela')
            ->join('cobrancas as c', 'cp.id_cobranca', '=', 'c.id_cobranca')
            ->where('c.id_usuario', $usuario->id_usuario)
            ->where('p.status', 'pendente')
            ->count();

        $valorPendente = DB::table('pagamentos as p')
            ->join('cobranca_parcelas as cp', 'p.id_parcela', '=', 'cp.id_parcela')
            ->join('cobrancas as c', 'cp.id_cobranca', '=', 'c.id_cobranca')
            ->where('c.id_usuario', $usuario->id_usuario)
            ->where('p.status', 'pendente')
            ->sum('p.valor');

        // Próximas atividades (reservas + sessões)
        $proximasReservas = DB::table('reservas_quadra as r')
            ->join('quadras as q', 'r.id_quadra', '=', 'q.id_quadra')
            ->where('r.id_usuario', $usuario->id_usuario)
            ->where('r.inicio', '>=', $now)
            ->whereIn('r.status', ['pendente', 'confirmada'])
            ->select(
                DB::raw("'reserva' as tipo"),
                'r.id_reserva_quadra as id',
                'q.nome as titulo',
                'r.inicio',
                'r.fim',
                'r.status'
            )
            ->limit(3);

        $proximasSessoes = DB::table('sessoes_personal as s')
            ->join('instrutores as i', 's.id_instrutor', '=', 'i.id_instrutor')
            ->where('s.id_usuario', $usuario->id_usuario)
            ->where('s.inicio', '>=', $now)
            ->whereIn('s.status', ['pendente', 'confirmada'])
            ->select(
                DB::raw("'sessao' as tipo"),
                's.id_sessao_personal as id',
                DB::raw("CONCAT('Personal com ', i.nome) as titulo"),
                's.inicio',
                's.fim',
                's.status'
            )
            ->limit(3);

        $proximasAtividades = $proximasReservas
            ->unionAll($proximasSessoes)
            ->orderBy('inicio')
            ->limit(5)
            ->get();

        return response()->json([
            'data' => [
                'reservas' => [
                    'total' => $minhasReservas,
                    'hoje' => $reservasHoje,
                    'mes' => $reservasMes,
                ],
                'sessoes_personal' => [
                    'total' => $minhasSessoes,
                    'mes' => $sessoesMes,
                ],
                'aulas' => [
                    'inscricoes_ativas' => $minhasInscricoes,
                ],
                'assinatura' => $assinatura,
                'pagamentos' => [
                    'pendentes' => $pagamentosPendentes,
                    'valor_pendente' => (float) $valorPendente,
                ],
                'proximas_atividades' => $proximasAtividades,
            ]
        ], 200);
    }

    /**
     * Dashboard do Instrutor - Estatísticas de trabalho
     */
    public function instructorDashboard(Request $request)
    {
        $usuario = $request->user();
        $now = Carbon::now();
        $startOfMonth = $now->copy()->startOfMonth();

        // Buscar instrutor vinculado ao usuário
        $instrutor = DB::table('instrutores')
            ->where('id_usuario', $usuario->id_usuario)
            ->first();

        if (!$instrutor) {
            return response()->json([
                'message' => 'Instrutor não encontrado'
            ], 404);
        }

        // Sessões personal
        $sessoesHoje = DB::table('sessoes_personal')
            ->where('id_instrutor', $instrutor->id_instrutor)
            ->whereDate('inicio', $now->toDateString())
            ->whereIn('status', ['pendente', 'confirmada'])
            ->count();

        $sessoesMes = DB::table('sessoes_personal')
            ->where('id_instrutor', $instrutor->id_instrutor)
            ->whereBetween('inicio', [$startOfMonth, $now])
            ->whereIn('status', ['pendente', 'confirmada'])
            ->count();

        $totalSessoes = DB::table('sessoes_personal')
            ->where('id_instrutor', $instrutor->id_instrutor)
            ->whereIn('status', ['pendente', 'confirmada'])
            ->count();

        // Aulas que ministra
        $minhasAulas = DB::table('horarios_aula')
            ->where('id_instrutor', $instrutor->id_instrutor)
            ->distinct('id_aula')
            ->count('id_aula');

        $aulasMes = DB::table('ocorrencias_aula')
            ->where('id_instrutor', $instrutor->id_instrutor)
            ->whereBetween('inicio', [$startOfMonth, $now])
            ->where('status', 'ativa')
            ->count();

        // Total de alunos atendidos (únicos)
        $alunosAtendidos = DB::table('sessoes_personal')
            ->where('id_instrutor', $instrutor->id_instrutor)
            ->whereIn('status', ['confirmada'])
            ->distinct('id_usuario')
            ->count('id_usuario');

        // Receita estimada do mês (sessões confirmadas)
        $receitaMes = DB::table('sessoes_personal')
            ->where('id_instrutor', $instrutor->id_instrutor)
            ->where('status', 'confirmada')
            ->whereBetween('inicio', [$startOfMonth, $now])
            ->sum('preco_total');

        // Próximas sessões
        $proximasSessoes = DB::table('sessoes_personal as s')
            ->join('usuarios as u', 's.id_usuario', '=', 'u.id_usuario')
            ->where('s.id_instrutor', $instrutor->id_instrutor)
            ->where('s.inicio', '>=', $now)
            ->whereIn('s.status', ['pendente', 'confirmada'])
            ->select(
                's.id_sessao_personal',
                'u.nome as aluno_nome',
                's.inicio',
                's.fim',
                's.status'
            )
            ->orderBy('s.inicio')
            ->limit(5)
            ->get();

        // Disponibilidade configurada
        $horariosDisponiveis = DB::table('disponibilidade_instrutor')
            ->where('id_instrutor', $instrutor->id_instrutor)
            ->count();

        return response()->json([
            'data' => [
                'sessoes_personal' => [
                    'hoje' => $sessoesHoje,
                    'mes' => $sessoesMes,
                    'total' => $totalSessoes,
                ],
                'aulas' => [
                    'turmas' => $minhasAulas,
                    'aulas_mes' => $aulasMes,
                ],
                'alunos' => [
                    'total_atendidos' => $alunosAtendidos,
                ],
                'financeiro' => [
                    'receita_mes' => (float) $receitaMes,
                    'valor_hora' => (float) $instrutor->valor_hora,
                ],
                'disponibilidade' => [
                    'horarios_configurados' => $horariosDisponiveis,
                ],
                'proximas_sessoes' => $proximasSessoes,
            ]
        ], 200);
    }
}
