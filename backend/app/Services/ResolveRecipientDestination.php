<?php

namespace App\Services;

use App\Models\DeliveryPreference;
use App\Models\SavedLocation;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class ResolveRecipientDestination
{
    /** @return array{recipient_user_id: int|null, destination: string, destination_location: array<string, mixed>|null, destination_source: string} */
    public function handle(array $attributes, ?int $senderUserId): array
    {
        $mode = $attributes['delivery_mode'] ?? 'real';
        $source = $attributes['destination_source'] ?? 'specific';
        $email = strtolower(trim((string) ($attributes['recipient_email'] ?? '')));
        $recipient = $email !== '' ? User::whereRaw('LOWER(email) = ?', [$email])->first() : null;

        if ($source === 'specific') {
            return [
                'recipient_user_id' => $recipient?->id,
                'destination' => $attributes['destination'],
                'destination_location' => $mode === 'playful' ? null : ($attributes['destination_location'] ?? null),
                'destination_source' => 'specific',
            ];
        }

        if ($recipient === null || ! $recipient->allow_contact_delivery) {
            throw ValidationException::withMessages([
                'destination_source' => 'Este destinatário ainda não autorizou entregas de contatos ou não possui uma conta.',
            ]);
        }

        if ($source === 'contact_preference') {
            if ($senderUserId === null) {
                throw ValidationException::withMessages(['destination_source' => 'Faça login para usar uma preferência salva para este contato.']);
            }

            $location = DeliveryPreference::query()
                ->where('recipient_user_id', $recipient->id)
                ->where('sender_user_id', $senderUserId)
                ->with('savedLocation')
                ->first()?->savedLocation;
        } else {
            $location = $recipient->savedLocations()->where('is_default', true)->first();
        }

        if (! $location instanceof SavedLocation) {
            throw ValidationException::withMessages(['destination_source' => 'O destinatário não possui um endereço disponível para esta opção.']);
        }

        return [
            'recipient_user_id' => $recipient->id,
            'destination' => $location->label,
            'destination_location' => [
                'label' => $location->label,
                'latitude' => $location->latitude,
                'longitude' => $location->longitude,
            ],
            'destination_source' => $source,
        ];
    }
}
