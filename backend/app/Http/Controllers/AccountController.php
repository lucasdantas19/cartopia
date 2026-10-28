<?php

namespace App\Http\Controllers;

use App\Models\Delivery;
use App\Models\SavedLocation;
use App\Models\SavedRecipient;
use App\Models\TrackedDelivery;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccountController extends Controller
{
    public function deliveries(Request $request): JsonResponse
    {
        return response()->json(['data' => Delivery::where('user_id', $request->user()->id)->latest()->get()->map(fn (Delivery $delivery) => [
            'public_id' => $delivery->public_id, 'recipient_name' => $delivery->recipient_name,
            'origin' => $delivery->origin, 'destination' => $delivery->destination, 'status' => $delivery->status(),
            'progress' => $delivery->progress(), 'starts_at' => $delivery->starts_at?->toISOString(),
            'arrives_at' => $delivery->arrives_at?->toISOString(),
        ])]);
    }

    public function incomingDeliveries(Request $request): JsonResponse
    {
        return response()->json(['data' => Delivery::whereRaw('LOWER(recipient_email) = ?', [strtolower($request->user()->email)])->latest()->get()->map(fn (Delivery $delivery): array => [
            'public_id' => $delivery->public_id,
            'sender_name' => $delivery->sender_name,
            'recipient_name' => $delivery->recipient_name,
            'origin' => $delivery->origin,
            'destination' => $delivery->destination,
            'status' => $delivery->status(),
            'progress' => $delivery->progress(),
            'arrives_at' => $delivery->arrives_at?->toISOString(),
        ])]);
    }

    public function incomingDeliveryToken(Request $request, string $publicId): JsonResponse
    {
        $delivery = Delivery::where('public_id', $publicId)
            ->whereRaw('LOWER(recipient_email) = ?', [strtolower($request->user()->email)])
            ->firstOrFail();

        return response()->json(['data' => [
            'public_id' => $delivery->public_id,
            'role' => 'recipient',
            'access_token' => Crypt::decryptString($delivery->recipient_access_token_encrypted),
        ]]);
    }

    public function locations(Request $request): JsonResponse
    {
        return response()->json(['data' => $request->user()->savedLocations()->latest()->get()]);
    }

    public function storeLocation(Request $request): JsonResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:80'], 'label' => ['required', 'string', 'max:255'], 'latitude' => ['required', 'numeric', 'between:-90,90'], 'longitude' => ['required', 'numeric', 'between:-180,180']]);
        return response()->json(['data' => $request->user()->savedLocations()->create($data)], 201);
    }

    public function deleteLocation(Request $request, SavedLocation $location): JsonResponse
    {
        abort_unless($location->user_id === $request->user()->id, 404);
        $location->delete();
        return response()->json(['data' => ['deleted' => true]]);
    }

    public function recipients(Request $request): JsonResponse
    {
        return response()->json(['data' => $request->user()->savedRecipients()->latest()->get()]);
    }

    public function trackedDeliveries(Request $request): JsonResponse
    {
        $tracked = $request->user()->trackedDeliveries()->with('delivery')->latest()->get();

        return response()->json(['data' => $tracked->map(fn (TrackedDelivery $item): array => [
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
        ])]);
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
}
