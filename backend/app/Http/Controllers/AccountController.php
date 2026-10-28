<?php

namespace App\Http\Controllers;

use App\Models\Delivery;
use App\Models\SavedLocation;
use App\Models\SavedRecipient;
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

    public function storeRecipient(Request $request): JsonResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:120'], 'nickname' => ['nullable', 'string', 'max:80']]);
        return response()->json(['data' => $request->user()->savedRecipients()->create($data)], 201);
    }

    public function deleteRecipient(Request $request, SavedRecipient $recipient): JsonResponse
    {
        abort_unless($recipient->user_id === $request->user()->id, 404);
        $recipient->delete();
        return response()->json(['data' => ['deleted' => true]]);
    }
}
