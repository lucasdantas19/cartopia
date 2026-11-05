<?php

namespace App\Http\Controllers;

use App\Models\Delivery;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminDeliveryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = trim((string) $request->query('q', ''));
        $status = $request->query('status');
        $owner = $request->query('owner');
        $dateFrom = $request->query('date_from');
        $dateTo = $request->query('date_to');
        $page = max(1, (int) $request->query('page', 1));
        $perPage = min(50, max(1, (int) $request->query('per_page', 20)));
        $builder = Delivery::query()->latest('created_at');
        if ($query !== '') {
            $search = '%'.strtolower($query).'%';
            $builder->where(function ($builder) use ($search): void {
                $builder->whereRaw('LOWER(public_id::text) LIKE ?', [$search])
                    ->orWhereRaw('LOWER(recipient_name) LIKE ?', [$search])
                    ->orWhereRaw('LOWER(origin) LIKE ?', [$search])
                    ->orWhereRaw('LOWER(destination) LIKE ?', [$search]);
            });
        }
        if ($owner === 'anonymous') {
            $builder->whereNull('user_id');
        } elseif ($owner === 'account') {
            $builder->whereNotNull('user_id');
        }
        if (is_string($dateFrom) && $dateFrom !== '') {
            $builder->whereDate('created_at', '>=', $dateFrom);
        }
        if (is_string($dateTo) && $dateTo !== '') {
            $builder->whereDate('created_at', '<=', $dateTo);
        }
        $now = CarbonImmutable::now('UTC');
        if ($status === 'SCHEDULED') $builder->where('starts_at', '>', $now);
        if ($status === 'IN_TRANSIT') $builder->where('starts_at', '<=', $now)->where('arrives_at', '>', $now);
        if ($status === 'DELIVERED') $builder->where('arrives_at', '<=', $now);

        $total = $builder->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = min($page, $lastPage);
        $deliveries = $builder->forPage($page, $perPage)->get();

        return response()->json([
            'data' => $deliveries->map(fn (Delivery $delivery): array => $this->summary($delivery))->values()->all(),
            'meta' => ['total' => $total, 'per_page' => $perPage, 'current_page' => $page, 'last_page' => $lastPage],
        ]);
    }

    public function regenerateLinks(string $publicId): JsonResponse
    {
        $delivery = Delivery::where('public_id', $publicId)->firstOrFail();
        $recipientToken = bin2hex(random_bytes(32));
        $senderToken = bin2hex(random_bytes(32));
        $delivery->forceFill([
            'access_token_hash' => hash('sha256', $recipientToken),
            'sender_access_token_hash' => hash('sha256', $senderToken),
        ])->save();

        return response()->json([
            'data' => [
                'recipient_path' => '/d/'.$delivery->public_id.'#token='.$recipientToken,
                'sender_path' => '/d/'.$delivery->public_id.'#token='.$senderToken.'&role=sender',
            ],
        ]);
    }

    public function destroy(string $publicId): JsonResponse
    {
        $delivery = Delivery::where('public_id', $publicId)->firstOrFail();
        $delivery->delete();

        return response()->json(['data' => ['deleted' => true]]);
    }

    /** @return array<string, mixed> */
    private function summary(Delivery $delivery): array
    {
        return [
            'public_id' => $delivery->public_id,
            'recipient_name' => $delivery->recipient_name,
            'sender_name' => $delivery->sender_name,
            'origin' => $delivery->origin_location['label'] ?? $delivery->origin,
            'destination' => $delivery->destination_location['label'] ?? $delivery->destination,
            'status' => $delivery->status(),
            'progress' => $delivery->progress(),
            'starts_at' => $delivery->starts_at?->toISOString(),
            'arrives_at' => $delivery->arrives_at?->toISOString(),
            'steps_count' => count($delivery->routeSteps()),
            'route_visibility' => $delivery->route_visibility,
            'created_at' => $delivery->created_at?->toISOString(),
            'requester_type' => $delivery->user_id === null ? 'anonymous' : 'account',
        ];
    }
}
