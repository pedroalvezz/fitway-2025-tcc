<?php

namespace App\Services;

use App\Models\Notificacao;

class NotificacaoService
{
    /**
     * Criar notificação de nova cobrança
     */
    public function notificarNovaCobranca(int $idUsuario, string $descricao, float $valor, string $linkPagamento): Notificacao
    {
        return Notificacao::create([
            'id_usuario' => $idUsuario,
            'tipo' => 'cobranca',
            'titulo' => 'Nova Cobrança',
            'mensagem' => "Você tem uma nova cobrança: {$descricao} no valor de R$ " . number_format($valor, 2, ',', '.'),
            'link' => $linkPagamento,
            'lida' => false,
        ]);
    }

    /**
     * Criar notificação de pagamento aprovado
     */
    public function notificarPagamentoAprovado(int $idUsuario, string $descricao, float $valor): Notificacao
    {
        return Notificacao::create([
            'id_usuario' => $idUsuario,
            'tipo' => 'pagamento',
            'titulo' => 'Pagamento Confirmado',
            'mensagem' => "Seu pagamento de {$descricao} no valor de R$ " . number_format($valor, 2, ',', '.') . " foi confirmado!",
            'lida' => false,
        ]);
    }

    /**
     * Criar notificação de sessão personal agendada
     */
    public function notificarSessaoAgendada(int $idUsuario, string $instrutor, string $dataHora): Notificacao
    {
        return Notificacao::create([
            'id_usuario' => $idUsuario,
            'tipo' => 'sessao',
            'titulo' => 'Sessão Personal Agendada',
            'mensagem' => "Sua sessão com {$instrutor} foi agendada para {$dataHora}",
            'link' => '/aluno/personal',
            'lida' => false,
        ]);
    }

    /**
     * Criar notificação de reserva de quadra confirmada
     */
    public function notificarReservaConfirmada(int $idUsuario, string $quadra, string $dataHora): Notificacao
    {
        return Notificacao::create([
            'id_usuario' => $idUsuario,
            'tipo' => 'reserva',
            'titulo' => 'Reserva Confirmada',
            'mensagem' => "Sua reserva da quadra {$quadra} para {$dataHora} foi confirmada!",
            'link' => '/aluno/reservas',
            'lida' => false,
        ]);
    }

    /**
     * Criar notificação de assinatura ativada
     */
    public function notificarAssinaturaAtivada(int $idUsuario, string $plano): Notificacao
    {
        return Notificacao::create([
            'id_usuario' => $idUsuario,
            'tipo' => 'assinatura',
            'titulo' => 'Assinatura Ativada',
            'mensagem' => "Sua assinatura do plano {$plano} foi ativada com sucesso!",
            'link' => '/aluno/planos',
            'lida' => false,
        ]);
    }

    /**
     * Criar notificação de aula inscrita
     */
    public function notificarAulaInscrita(int $idUsuario, string $aula, string $dataHora): Notificacao
    {
        return Notificacao::create([
            'id_usuario' => $idUsuario,
            'tipo' => 'aula',
            'titulo' => 'Inscrição em Aula Confirmada',
            'mensagem' => "Você foi inscrito na aula {$aula} em {$dataHora}",
            'link' => '/aluno/aulas',
            'lida' => false,
        ]);
    }

    /**
     * Criar notificação genérica
     */
    public function criar(int $idUsuario, string $tipo, string $titulo, string $mensagem, ?string $link = null): Notificacao
    {
        return Notificacao::create([
            'id_usuario' => $idUsuario,
            'tipo' => $tipo,
            'titulo' => $titulo,
            'mensagem' => $mensagem,
            'link' => $link,
            'lida' => false,
        ]);
    }
}
