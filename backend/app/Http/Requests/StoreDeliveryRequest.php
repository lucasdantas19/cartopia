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
            'duration_minutes' => [
                'required',
                'integer',
                'min:1',
                'max:'.config('deliveries.max_duration_minutes'),
            ],
        ];
    }
}
