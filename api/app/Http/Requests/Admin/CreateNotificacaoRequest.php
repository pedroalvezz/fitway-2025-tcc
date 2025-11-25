<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Http\Exceptions\HttpResponseException;

class CreateNotificacaoRequest extends FormRequest
{
    public function authorize(): bool
    {
        // A rota já está protegida por middleware role:admin
        return true;
    }

    public function rules(): array
    {
        return [
            'id_usuario' => 'required|integer|exists:usuarios,id_usuario',
            'tipo'       => 'required|string|in:cobranca,pagamento,sessao,reserva,aula,assinatura,sistema',
            'titulo'     => 'required|string|max:100',
            'mensagem'   => 'required|string|max:500',
            // For security and UX, only allow internal app routes as links.
            // Require links to be internal paths starting with a known prefix (e.g. /aluno/, /admin/, /instrutor/)
            'link'       => ['nullable', 'string', 'max:255', 'regex:/^(\/(aluno|admin|instrutor)\/[A-Za-z0-9\-\/\_\?\=\&]*)$/'],
        ];
    }

    /**
     * Força retorno JSON 422 ao invés de redirect 302 (padrão API do projeto)
     */
    protected function failedValidation(Validator $validator)
    {
        throw new HttpResponseException(
            response()->json([
                'message' => 'Dados inválidos',
                'errors'  => $validator->errors(),
            ], 422)
        );
    }
}
