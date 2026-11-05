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
            'recipient_email' => ['nullable', 'email', 'max:255'],
            'delivery_mode' => ['sometimes', 'string', Rule::in(['real', 'playful'])],
            'unlock_type' => ['sometimes', 'string', Rule::in(['none', 'password', 'hangman'])],
            'unlock_password' => ['nullable', 'string', 'min:1', 'max:120', 'required_if:unlock_type,password', 'required_if:unlock_type,hangman'],
            'destination_source' => ['sometimes', 'string', Rule::in(['specific', 'recipient_default', 'contact_preference'])],
            'origin' => ['required', 'string', 'max:160'],
            'origin_location' => ['sometimes', 'nullable', 'array'],
            'origin_location.label' => ['required_with:origin_location', 'string', 'max:160'],
            'origin_location.latitude' => ['required_with:origin_location', 'numeric', 'between:-90,90'],
            'origin_location.longitude' => ['required_with:origin_location', 'numeric', 'between:-180,180'],
            'destination' => ['nullable', 'string', 'max:160', 'required_if:destination_source,specific', 'required_if:delivery_mode,playful'],
            'destination_location' => ['sometimes', 'nullable', 'array'],
            'destination_location.label' => ['required_with:destination_location', 'string', 'max:160'],
            'destination_location.latitude' => ['required_with:destination_location', 'numeric', 'between:-90,90'],
            'destination_location.longitude' => ['required_with:destination_location', 'numeric', 'between:-180,180'],
            'route_visibility' => ['sometimes', 'string', Rule::in(['full', 'progressive'])],
            'courier' => ['sometimes', 'string', Rule::in(config('deliveries.couriers'))],
            'arrival_at' => [
                'nullable',
                'date',
                'after:now',
                'required_without_all:duration_minutes,legs,steps',
            ],
            'duration_minutes' => [
                'nullable',
                'required_without_all:arrival_at,legs,steps',
                'integer',
                'min:1',
                'max:'.config('deliveries.max_duration_minutes'),
            ],
            'final_duration_minutes' => ['required_with:steps', 'integer', 'min:1', 'max:'.config('deliveries.max_duration_minutes')],
            'legs' => ['sometimes', 'array', 'min:1', 'max:8'],
            'legs.*.destination' => ['required', 'string', Rule::in(config('deliveries.destinations'))],
            'legs.*.duration_minutes' => ['required', 'integer', 'min:1', 'max:'.config('deliveries.max_duration_minutes')],
            'steps' => ['sometimes', 'array', 'max:12'],
            'steps.*.title' => ['required', 'string', 'max:120'],
            'steps.*.description' => ['nullable', 'string', 'max:500'],
            'steps.*.duration_minutes' => ['required', 'integer', 'min:1', 'max:'.config('deliveries.max_duration_minutes')],
            'steps.*.location' => ['nullable', 'array'],
            'steps.*.location.label' => ['required_with:steps.*.location', 'string', 'max:160'],
            'steps.*.location.latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'steps.*.location.longitude' => ['nullable', 'numeric', 'between:-180,180'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'delivery_mode' => $this->input('delivery_mode', 'real'),
            'destination_source' => $this->input('destination_source', 'specific'),
        ]);
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            $originLocation = $this->input('origin_location');
            $destinationLocation = $this->input('destination_location');
            $source = $this->input('destination_source', 'specific');
            $mode = $this->input('delivery_mode', 'real');
            $sameCoordinates = is_array($originLocation)
                && is_array($destinationLocation)
                && (float) ($originLocation['latitude'] ?? null) === (float) ($destinationLocation['latitude'] ?? null)
                && (float) ($originLocation['longitude'] ?? null) === (float) ($destinationLocation['longitude'] ?? null);
            $sameEndpointLabels = $source === 'specific' && $this->input('origin') === $this->input('destination');
            $hasDifferentCustomEndpoints = is_array($originLocation)
                && is_array($destinationLocation)
                && ! $sameCoordinates;

            if (($sameEndpointLabels && ! $hasDifferentCustomEndpoints) || ($source === 'specific' && $sameCoordinates)) {
                $validator->errors()->add('destination', 'A origem e o destino devem ser diferentes.');
            }
            if ($mode === 'playful' && $source !== 'specific') {
                $validator->errors()->add('destination_source', 'Entregas lúdicas precisam de um destino informado na criação.');
            }
            if ($mode === 'playful' && (is_array($originLocation) || is_array($destinationLocation))) {
                $validator->errors()->add('delivery_mode', 'Entregas lúdicas não usam coordenadas de mapa.');
            }
            $steps = $this->input('steps');
            if (! is_array($steps)) {
                $legs = $this->input('legs');
                if (is_array($legs) && $legs !== [] && $validator->errors()->isEmpty()) {
                    $destinations = array_column($legs, 'destination');
                    if (end($destinations) !== $this->input('destination')) {
                        $validator->errors()->add('legs', 'O último trecho deve terminar no destino da entrega.');
                    }
                }
                return;
            }
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $total = array_sum(array_map('intval', array_column($steps, 'duration_minutes'))) + (int) $this->input('final_duration_minutes');
            if ($total > config('deliveries.max_duration_minutes')) {
                $validator->errors()->add('steps', 'A duração total da aventura não pode ultrapassar 1440 minutos.');
            }
        });
    }
}
