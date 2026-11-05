<?php

namespace App\Http\Controllers;

use App\Models\Delivery;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminUserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('q', ''));
        $perPage = min(50, max(1, (int) $request->query('per_page', 20)));
        $query = User::query()
            ->select(['id', 'name', 'email', 'allow_contact_delivery', 'created_at'])
            ->withCount(['savedLocations', 'deliveries', 'recipientDeliveries'])
            ->latest('created_at');

        if ($search !== '') {
            $like = '%'.strtolower($search).'%';
            $query->where(function ($userQuery) use ($like): void {
                $userQuery
                    ->whereRaw('LOWER(name) LIKE ?', [$like])
                    ->orWhereRaw('LOWER(email) LIKE ?', [$like]);
            });
        }

        $users = $query->paginate($perPage);

        return response()->json([
            'data' => $users->getCollection()->map(fn (User $user): array => $this->userSummary($user))->values()->all(),
            'meta' => [
                'total' => $users->total(),
                'per_page' => $users->perPage(),
                'current_page' => $users->currentPage(),
                'last_page' => $users->lastPage(),
            ],
        ]);
    }

    public function show(int $userId): JsonResponse
    {
        $user = User::query()
            ->select(['id', 'name', 'email', 'allow_contact_delivery', 'created_at'])
            ->with([
                'savedLocations' => fn ($query) => $query->latest(),
                'deliveries' => fn ($query) => $query->latest('created_at')->limit(50),
                'recipientDeliveries' => fn ($query) => $query->latest('created_at')->limit(50),
                'trackedDeliveries.delivery',
            ])
            ->withCount(['savedLocations', 'deliveries', 'recipientDeliveries'])
            ->findOrFail($userId);

        return response()->json([
            'data' => [
                ...$this->userSummary($user),
                'locations' => $user->savedLocations->map(fn ($location): array => [
                    'id' => $location->id,
                    'name' => $location->name,
                    'label' => $location->label,
                    'latitude' => $location->latitude,
                    'longitude' => $location->longitude,
                    'is_default' => $location->is_default,
                ])->values()->all(),
                'sent_deliveries' => $user->deliveries->map(fn (Delivery $delivery): array => $this->deliverySummary($delivery))->values()->all(),
                'received_deliveries' => $user->recipientDeliveries->map(fn (Delivery $delivery): array => $this->deliverySummary($delivery))->values()->all(),
                'tracked_deliveries' => $user->trackedDeliveries->map(fn ($tracked): array => [
                    'id' => $tracked->id,
                    'label' => $tracked->label,
                    'role' => $tracked->role,
                    ...$this->deliverySummary($tracked->delivery),
                ])->values()->all(),
            ],
        ]);
    }

    /** @return array<string, mixed> */
    private function userSummary(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'allow_contact_delivery' => (bool) $user->allow_contact_delivery,
            'created_at' => $user->created_at?->toISOString(),
            'locations_count' => (int) ($user->saved_locations_count ?? 0),
            'sent_deliveries_count' => (int) ($user->deliveries_count ?? 0),
            'received_deliveries_count' => (int) ($user->recipient_deliveries_count ?? 0),
            'tracked_deliveries_count' => $user->trackedDeliveries()->count(),
        ];
    }

    /** @return array<string, mixed> */
    private function deliverySummary(Delivery $delivery): array
    {
        return [
            'public_id' => $delivery->public_id,
            'sender_name' => $delivery->sender_name,
            'recipient_name' => $delivery->recipient_name,
            'recipient_email' => $delivery->recipient_email,
            'origin' => $delivery->origin_location['label'] ?? $delivery->origin,
            'destination' => $delivery->destination_location['label'] ?? $delivery->destination,
            'status' => $delivery->status(),
            'progress' => $delivery->progress(),
            'starts_at' => $delivery->starts_at?->toISOString(),
            'arrives_at' => $delivery->arrives_at?->toISOString(),
            'created_at' => $delivery->created_at?->toISOString(),
        ];
    }
}
