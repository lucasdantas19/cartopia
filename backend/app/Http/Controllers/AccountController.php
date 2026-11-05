<?php

namespace App\Http\Controllers;

use App\Models\Delivery;
use App\Models\SavedLocation;
use App\Models\SavedRecipient;
use App\Models\TrackedDelivery;
use App\Models\DeliveryPreference;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Carbon\CarbonImmutable;

class AccountController extends Controller
{
    public function activeMapDeliveries(Request $request): JsonResponse
    {
        $now = CarbonImmutable::now('UTC');
        $user = $request->user();
        $deliveries = Delivery::query()
            ->where('starts_at', '<=', $now)
            ->where('arrives_at', '>', $now)
            ->where(function ($query) use ($user): void {
                $query->where('user_id', $user->id)
                    ->orWhere('recipient_user_id', $user->id)
                    ->orWhereRaw('LOWER(recipient_email) = ?', [strtolower($user->email)])
                    ->orWhereHas('trackedByUsers', fn ($tracked) => $tracked->where('user_id', $user->id));
            })
            ->latest()
            ->limit(5)
            ->get();

        return response()->json(['data' => $deliveries->map(fn (Delivery $delivery): array => [
            'public_id' => $delivery->public_id,
            'recipient_name' => $delivery->recipient_name,
            'courier' => $delivery->courier,
            'origin' => $delivery->origin,
            'destination' => $delivery->destination,
            'origin_location' => $delivery->origin_location,
            'destination_location' => $delivery->destination_location,
            'starts_at' => $delivery->starts_at?->toISOString(),
            'arrives_at' => $delivery->arrives_at?->toISOString(),
            'status' => $delivery->status(),
            'progress' => $delivery->progress(),
        ])]);
    }

    public function deliveries(Request $request): JsonResponse
    {
        $query = Delivery::where('user_id', $request->user()->id);
        $recipientEmail = trim((string) $request->input('recipient_email'));
        $recipientName = trim((string) $request->input('recipient_name'));

        if ($recipientEmail !== '') {
            $query->where(function ($recipientQuery) use ($recipientEmail, $recipientName): void {
                $recipientQuery->whereRaw('LOWER(recipient_email) = ?', [strtolower($recipientEmail)]);

                if ($recipientName !== '') {
                    $recipientQuery->orWhere(function ($legacyQuery) use ($recipientName): void {
                        $legacyQuery->whereNull('recipient_email')
                            ->whereRaw('LOWER(recipient_name) = ?', [strtolower($recipientName)]);
                    });
                }
            });
        } elseif ($recipientName !== '') {
            $query->whereRaw('LOWER(recipient_name) = ?', [strtolower($recipientName)]);
        }

        $deliveries = $query->latest()->paginate($this->pageSize($request));

        return response()->json(['data' => $deliveries->getCollection()->map(fn (Delivery $delivery) => [
            'public_id' => $delivery->public_id, 'recipient_name' => $delivery->recipient_name,
            'recipient_email' => $delivery->recipient_email,
            'origin' => $delivery->origin, 'destination' => $delivery->destination, 'status' => $delivery->status(),
            'progress' => $delivery->progress(), 'starts_at' => $delivery->starts_at?->toISOString(),
            'arrives_at' => $delivery->arrives_at?->toISOString(),
        ]), 'meta' => $this->paginationMeta($deliveries)]);
    }

    public function incomingDeliveries(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = Delivery::where(function ($query) use ($user): void {
            $query->where('recipient_user_id', $user->id)
                ->orWhereRaw('LOWER(recipient_email) = ?', [strtolower($user->email)]);
        });

        if ($request->input('opened') === 'true') {
            $query->whereNotNull('opened_at');
        } elseif ($request->input('opened') === 'false') {
            $query->whereNull('opened_at');
        }

        $deliveries = $query->latest()->paginate($this->pageSize($request));

        return response()->json(['data' => $deliveries->getCollection()->map(fn (Delivery $delivery): array => [
            'public_id' => $delivery->public_id,
            'sender_name' => $delivery->sender_name,
            'recipient_name' => $delivery->recipient_name,
            'origin' => $delivery->origin,
            'destination' => $delivery->destination,
            'status' => $delivery->status(),
            'progress' => $delivery->progress(),
            'arrives_at' => $delivery->arrives_at?->toISOString(),
            'opened_at' => $delivery->opened_at?->toISOString(),
        ]), 'meta' => $this->paginationMeta($deliveries)]);
    }

    public function incomingDeliveryToken(Request $request, string $publicId): JsonResponse
    {
        $delivery = Delivery::where('public_id', $publicId)
            ->where(function ($query) use ($request): void {
                $query->where('recipient_user_id', $request->user()->id)
                    ->orWhereRaw('LOWER(recipient_email) = ?', [strtolower($request->user()->email)]);
            })
            ->firstOrFail();

        return response()->json(['data' => [
            'public_id' => $delivery->public_id,
            'role' => 'recipient',
            'access_token' => Crypt::decryptString($delivery->recipient_access_token_encrypted),
        ]]);
    }

    public function sentDeliveryToken(Request $request, string $publicId): JsonResponse
    {
        $delivery = $request->user()->deliveries()->where('public_id', $publicId)->firstOrFail();

        return response()->json(['data' => [
            'public_id' => $delivery->public_id,
            'role' => 'sender',
            'access_token' => $request->bearerToken(),
        ]]);
    }

    public function locations(Request $request): JsonResponse
    {
        $locations = $request->user()->savedLocations()->latest()->paginate($this->pageSize($request));
        return response()->json(['data' => $locations->getCollection(), 'meta' => $this->paginationMeta($locations)]);
    }

    public function deliverySettings(Request $request): JsonResponse
    {
        return response()->json(['data' => [
            'allow_contact_delivery' => (bool) $request->user()->allow_contact_delivery,
        ]]);
    }

    public function recipientDeliveryOptions(Request $request): JsonResponse
    {
        $data = $request->validate(['recipient_email' => ['required', 'email', 'max:255']]);
        $recipient = \App\Models\User::whereRaw('LOWER(email) = ?', [strtolower($data['recipient_email'])])->first();

        if ($recipient === null || ! $recipient->allow_contact_delivery) {
            return response()->json(['data' => [
                'available' => false,
                'recipient_name' => null,
                'recipient_default_available' => false,
                'contact_preference_available' => false,
            ]]);
        }

        return response()->json(['data' => [
            'available' => true,
            'recipient_name' => $recipient->name,
            'recipient_default_available' => $recipient->savedLocations()->where('is_default', true)->exists(),
            'contact_preference_available' => DeliveryPreference::query()
                ->where('recipient_user_id', $recipient->id)
                ->where('sender_user_id', $request->user()->id)
                ->exists(),
        ]]);
    }

    public function updateDeliverySettings(Request $request): JsonResponse
    {
        $data = $request->validate(['allow_contact_delivery' => ['required', 'boolean']]);
        $request->user()->update($data);

        return $this->deliverySettings($request);
    }

    public function deliveryPreferences(Request $request): JsonResponse
    {
        $preferences = $request->user()->deliveryPreferences()->with(['senderUser:id,name,email', 'savedLocation:id,name,label'])->latest()->paginate($this->pageSize($request));

        return response()->json(['data' => $preferences->getCollection()->map(fn (DeliveryPreference $preference): array => [
            'id' => $preference->id,
            'sender' => $preference->senderUser,
            'location' => $preference->savedLocation,
        ]), 'meta' => $this->paginationMeta($preferences)]);
    }

    public function storeDeliveryPreference(Request $request): JsonResponse
    {
        $data = $request->validate([
            'sender_email' => ['required', 'email', 'max:255'],
            'location_id' => ['required', 'integer'],
        ]);
        $user = $request->user();
        $sender = \App\Models\User::whereRaw('LOWER(email) = ?', [strtolower($data['sender_email'])])->firstOrFail();
        $location = $user->savedLocations()->findOrFail($data['location_id']);

        if ($sender->id === $user->id) {
            return response()->json(['error' => ['message' => 'Escolha outro usuário para criar uma preferência.']], 422);
        }

        $preference = DeliveryPreference::updateOrCreate(
            ['recipient_user_id' => $user->id, 'sender_user_id' => $sender->id],
            ['saved_location_id' => $location->id],
        );

        return response()->json(['data' => $preference->load(['senderUser:id,name,email', 'savedLocation:id,name,label'])], 201);
    }

    public function deleteDeliveryPreference(Request $request, DeliveryPreference $preference): JsonResponse
    {
        abort_unless($preference->recipient_user_id === $request->user()->id, 404);
        $preference->delete();

        return response()->json(['data' => ['deleted' => true]]);
    }

    public function storeLocation(Request $request): JsonResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:80'], 'label' => ['required', 'string', 'max:255'], 'latitude' => ['required', 'numeric', 'between:-90,90'], 'longitude' => ['required', 'numeric', 'between:-180,180'], 'is_default' => ['sometimes', 'boolean']]);
        $location = $request->user()->savedLocations()->create($data);

        if ($location->is_default) {
            $request->user()->savedLocations()->where('id', '!=', $location->id)->update(['is_default' => false]);
        }

        return response()->json(['data' => $location->fresh()], 201);
    }

    public function setDefaultLocation(Request $request, SavedLocation $location): JsonResponse
    {
        abort_unless($location->user_id === $request->user()->id, 404);

        $request->user()->savedLocations()->update(['is_default' => false]);
        $location->update(['is_default' => true]);

        return response()->json(['data' => $location->fresh()]);
    }

    public function clearDefaultLocation(Request $request, SavedLocation $location): JsonResponse
    {
        abort_unless($location->user_id === $request->user()->id, 404);
        $location->update(['is_default' => false]);

        return response()->json(['data' => $location->fresh()]);
    }

    public function deleteLocation(Request $request, SavedLocation $location): JsonResponse
    {
        abort_unless($location->user_id === $request->user()->id, 404);
        $location->delete();
        return response()->json(['data' => ['deleted' => true]]);
    }

    public function updateLocation(Request $request, SavedLocation $location): JsonResponse
    {
        abort_unless($location->user_id === $request->user()->id, 404);
        $data = $request->validate(['name' => ['required', 'string', 'max:80'], 'label' => ['required', 'string', 'max:255'], 'latitude' => ['required', 'numeric', 'between:-90,90'], 'longitude' => ['required', 'numeric', 'between:-180,180']]);
        $location->update($data);

        return response()->json(['data' => $location->fresh()]);
    }

    public function recipients(Request $request): JsonResponse
    {
        $query = $request->user()->savedRecipients();
        $search = trim((string) $request->input('search'));
        if ($search !== '') {
            $like = '%'.strtolower($search).'%';
            $query->where(function ($recipientQuery) use ($like): void {
                $recipientQuery->whereRaw('LOWER(name) LIKE ?', [$like])
                    ->orWhereRaw('LOWER(COALESCE(nickname, \'\')) LIKE ?', [$like])
                    ->orWhereRaw('LOWER(COALESCE(email, \'\')) LIKE ?', [$like]);
            });
        }

        $recipients = $query->latest()->paginate($this->pageSize($request));
        return response()->json(['data' => $recipients->getCollection(), 'meta' => $this->paginationMeta($recipients)]);
    }

    public function trackedDeliveries(Request $request): JsonResponse
    {
        $tracked = $request->user()->trackedDeliveries()->with('delivery')->latest()->paginate($this->pageSize($request));

        return response()->json(['data' => $tracked->getCollection()->map(fn (TrackedDelivery $item): array => [
            'id' => $item->id,
            'public_id' => $item->delivery->public_id,
            'label' => $item->label,
            'role' => $item->role,
            'recipient_name' => $item->delivery->recipient_name,
            'origin' => $item->delivery->origin,
            'destination' => $item->delivery->destination,
            'status' => $item->delivery->status(),
            'progress' => $item->delivery->progress(),
            'arrives_at' => $item->delivery->arrives_at?->toISOString(),
        ]), 'meta' => $this->paginationMeta($tracked)]);
    }

    public function storeTrackedDelivery(Request $request): JsonResponse
    {
        $data = $request->validate([
            'public_id' => ['required', 'uuid'],
            'access_token' => ['required', 'string', 'max:255'],
            'role' => ['nullable', 'in:sender,recipient'],
            'label' => ['nullable', 'string', 'max:120'],
        ]);
        $delivery = \App\Models\Delivery::where('public_id', $data['public_id'])->first();
        $role = $data['role'] ?? 'recipient';
        $tokenHash = hash('sha256', $data['access_token']);
        $valid = $delivery && (($role === 'sender' && hash_equals((string) $delivery->sender_access_token_hash, $tokenHash)) || ($role === 'recipient' && hash_equals($delivery->access_token_hash, $tokenHash)));

        if (! $valid) {
            return response()->json(['error' => ['code' => 'INVALID_DELIVERY_LINK', 'message' => 'Esse link não é válido ou não dá acesso a esta entrega.']], 422);
        }

        $tracked = $request->user()->trackedDeliveries()->updateOrCreate(
            ['delivery_id' => $delivery->id, 'role' => $role],
            ['access_token_encrypted' => Crypt::encryptString($data['access_token']), 'label' => $data['label'] ?? null],
        );

        return response()->json(['data' => ['id' => $tracked->id, 'public_id' => $delivery->public_id, 'role' => $role]], 201);
    }

    public function trackedDeliveryToken(Request $request, TrackedDelivery $trackedDelivery): JsonResponse
    {
        abort_unless($trackedDelivery->user_id === $request->user()->id, 404);
        return response()->json(['data' => ['public_id' => $trackedDelivery->delivery->public_id, 'role' => $trackedDelivery->role, 'access_token' => Crypt::decryptString($trackedDelivery->access_token_encrypted)]]);
    }

    public function deleteTrackedDelivery(Request $request, TrackedDelivery $trackedDelivery): JsonResponse
    {
        abort_unless($trackedDelivery->user_id === $request->user()->id, 404);
        $trackedDelivery->delete();
        return response()->json(['data' => ['deleted' => true]]);
    }

    public function storeRecipient(Request $request): JsonResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:120'], 'email' => ['nullable', 'email', 'max:255'], 'nickname' => ['nullable', 'string', 'max:80']]);
        return response()->json(['data' => $request->user()->savedRecipients()->create($data)], 201);
    }

    public function deleteRecipient(Request $request, SavedRecipient $recipient): JsonResponse
    {
        abort_unless($recipient->user_id === $request->user()->id, 404);
        $recipient->delete();
        return response()->json(['data' => ['deleted' => true]]);
    }

    public function updateRecipient(Request $request, SavedRecipient $recipient): JsonResponse
    {
        abort_unless($recipient->user_id === $request->user()->id, 404);
        $data = $request->validate(['name' => ['required', 'string', 'max:120'], 'email' => ['nullable', 'email', 'max:255'], 'nickname' => ['nullable', 'string', 'max:80']]);
        $recipient->update($data);

        return response()->json(['data' => $recipient->fresh()]);
    }

    private function pageSize(Request $request): int
    {
        return min(20, max(1, (int) $request->input('per_page', 5)));
    }

    private function paginationMeta($paginator): array
    {
        return [
            'total' => $paginator->total(),
            'per_page' => $paginator->perPage(),
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
        ];
    }
}
