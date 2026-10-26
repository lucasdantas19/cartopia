<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreDeliveryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'message' => ['required', 'string', 'max:10000'],
            'sender_name' => ['nullable', 'string', 'max:120'],
            'recipient_name' => ['required', 'string', 'max:120'],
            'origin' => ['required', 'string', Rule::in(config('deliveries.origins'))],
            'destination' => [
                'required',
                'string',
                Rule::in(config('deliveries.destinations')),
                'different:origin',
            ],
            'courier' => ['sometimes', 'string', Rule::in(config('deliveries.couriers'))],
            'duration_minutes' => [
                'required_without_all:legs,steps',
                'integer',
                'min:1',
                'max:'.config('deliveries.max_duration_minutes'),
            ],
            'final_duration_minutes' => ['required_with:steps', 'integer', 'min:1', 'max:'.config('deliveries.max_duration_minutes')],
            'legs' => ['sometimes', 'array', 'min:1', 'max:8'],
            'legs.*.destination' => ['required', 'string', Rule::in(config('deliveries.destinations'))],
            'legs.*.duration_minutes' => ['required', 'integer', 'min:1', 'max:'.config('deliveries.max_duration_minutes')],
            'steps' => ['sometimes', 'array', 'min:1', 'max:12'],
            'steps.*.title' => ['required', 'string', 'max:120'],
            'steps.*.description' => ['nullable', 'string', 'max:500'],
            'steps.*.duration_minutes' => ['required', 'integer', 'min:1', 'max:'.config('deliveries.max_duration_minutes')],
            'steps.*.location' => ['nullable', 'array'],
            'steps.*.location.label' => ['required_with:steps.*.location', 'string', 'max:160'],
            'steps.*.location.latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'steps.*.location.longitude' => ['nullable', 'numeric', 'between:-180,180'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            $steps = $this->input('steps');
            if (! is_array($steps) || $validator->errors()->isNotEmpty()) {
                return;
            }

            $total = array_sum(array_map('intval', array_column($steps, 'duration_minutes'))) + (int) $this->input('final_duration_minutes');
            if ($total > config('deliveries.max_duration_minutes')) {
                $validator->errors()->add('steps', 'A duração total da aventura não pode ultrapassar 1440 minutos.');
            }
        });
    }
}
