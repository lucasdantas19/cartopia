<?php

return [
    'required' => 'O campo :attribute é obrigatório.',
    'string' => 'O campo :attribute deve ser um texto.',
    'integer' => 'O campo :attribute deve ser um número inteiro.',
    'max' => [
        'numeric' => 'O campo :attribute não pode ser maior que :max.',
        'string' => 'O campo :attribute não pode ter mais de :max caracteres.',
    ],
    'min' => [
        'numeric' => 'O campo :attribute deve ser no mínimo :min.',
        'string' => 'O campo :attribute deve ter pelo menos :min caracteres.',
    ],
    'in' => 'O valor selecionado para :attribute é inválido.',
    'different' => 'Os campos :attribute e :other devem ser diferentes.',

    'attributes' => [
        'message' => 'mensagem',
        'sender_name' => 'seu nome',
        'recipient_name' => 'nome do destinatário',
        'origin' => 'origem',
        'destination' => 'destino',
        'courier' => 'entregador',
        'duration_minutes' => 'duração da viagem',
    ],
];
